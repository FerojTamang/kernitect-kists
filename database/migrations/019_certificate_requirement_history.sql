-- Preserve the exact module set and display titles represented at issuance.
-- A canonical, sorted module-id fingerprint makes requirement-set identity
-- independent of assignment order.
DROP TRIGGER protect_certificate_assignments ON certificate_assignments;

ALTER TABLE certificate_assignments
  ADD COLUMN training_module_id_snapshot integer,
  ADD COLUMN module_title_snapshot text;

UPDATE certificate_assignments evidence
SET training_module_id_snapshot = assignment.training_module_id,
  module_title_snapshot = module.title
FROM training_assignments assignment
JOIN training_modules module ON module.id = assignment.training_module_id
WHERE assignment.id = evidence.training_assignment_id;

ALTER TABLE certificate_assignments
  ALTER COLUMN training_module_id_snapshot SET NOT NULL,
  ALTER COLUMN module_title_snapshot SET NOT NULL,
  ADD CONSTRAINT certificate_assignment_module_title_nonempty
    CHECK (btrim(module_title_snapshot) <> '');

CREATE TRIGGER protect_certificate_assignments
BEFORE INSERT OR UPDATE OR DELETE ON certificate_assignments
FOR EACH ROW EXECUTE FUNCTION protect_certificate_evidence();

-- The existing validation trigger intentionally rejects every update to a
-- revoked certificate. Remove it only for this atomic metadata backfill, then
-- recreate it after installing the snapshot-aware validation function below.
DROP TRIGGER validate_certificate ON certificates;

ALTER TABLE certificates
  ADD COLUMN requirement_fingerprint text;

UPDATE certificates certificate
SET requirement_fingerprint = snapshot.fingerprint
FROM (
  SELECT certificate_id,
    string_agg(
      training_module_id_snapshot::text,
      ',' ORDER BY training_module_id_snapshot
    ) AS fingerprint
  FROM certificate_assignments
  GROUP BY certificate_id
) snapshot
WHERE snapshot.certificate_id = certificate.id;

ALTER TABLE certificates
  ALTER COLUMN requirement_fingerprint SET NOT NULL,
  ADD CONSTRAINT certificate_requirement_fingerprint_nonempty
    CHECK (btrim(requirement_fingerprint) <> '');

DROP INDEX certificates_one_current_idx;
CREATE UNIQUE INDEX certificates_requirement_snapshot_unique_idx
  ON certificates(trainee_id, requirement_fingerprint);

CREATE FUNCTION current_requirement_fingerprint(requested_trainee_id integer)
RETURNS text
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  SELECT string_agg(
    required_assignment.training_module_id::text,
    ',' ORDER BY required_assignment.training_module_id
  )
  FROM training_assignments required_assignment
  WHERE required_assignment.trainee_id = requested_trainee_id
    AND required_assignment.required
    AND required_assignment.status = 'active';
$$;

CREATE OR REPLACE FUNCTION validate_certificate() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE current_fingerprint text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.trainee_id, NEW.certificate_number, NEW.issued_at,
        NEW.requirement_fingerprint)
      IS DISTINCT FROM
       (OLD.id, OLD.trainee_id, OLD.certificate_number, OLD.issued_at,
        OLD.requirement_fingerprint)
      OR OLD.status = 'revoked' THEN
      RAISE EXCEPTION 'Certificate identity is immutable; revoked certificates cannot be reactivated' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  LOCK TABLE users, training_assignments, progress, scenarios,
    scenario_attempts, assessments, assessment_attempts IN SHARE MODE;
  SELECT current_requirement_fingerprint(NEW.trainee_id)
    INTO current_fingerprint;
  IF NEW.requirement_fingerprint IS NULL THEN
    NEW.requirement_fingerprint := current_fingerprint;
  END IF;
  IF NEW.status <> 'issued'
    OR current_fingerprint IS NULL
    OR NEW.requirement_fingerprint IS DISTINCT FROM current_fingerprint
    OR NOT EXISTS (
      SELECT 1
      FROM certification_eligibility
      WHERE trainee_id = NEW.trainee_id
        AND eligible
    ) THEN
    RAISE EXCEPTION 'All active required assignments and their active requirements must be completed before certification' USING ERRCODE = '23514';
  END IF;
  NEW.issued_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_certificate
BEFORE INSERT OR UPDATE ON certificates
FOR EACH ROW EXECUTE FUNCTION validate_certificate();

CREATE OR REPLACE FUNCTION snapshot_certificate_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  INSERT INTO certificate_assignments (
    certificate_id,
    training_assignment_id,
    completed_at_snapshot,
    training_module_id_snapshot,
    module_title_snapshot
  )
  SELECT NEW.id,
    assignment.id,
    progress.completed_at,
    assignment.training_module_id,
    module.title
  FROM training_assignments assignment
  JOIN progress ON progress.training_assignment_id = assignment.id
  JOIN training_modules module ON module.id = assignment.training_module_id
  WHERE assignment.trainee_id = NEW.trainee_id
    AND assignment.required
    AND assignment.status = 'active';

  INSERT INTO certificate_assessment_attempts
    (certificate_id, training_assignment_id, assessment_id, assessment_attempt_id)
  SELECT NEW.id, evidence.training_assignment_id, assessment.id, result.id
  FROM certificate_assignments evidence
  JOIN training_assignments assignment
    ON assignment.id = evidence.training_assignment_id
  JOIN assessments assessment
    ON assessment.training_module_id = assignment.training_module_id
   AND assessment.is_active
  CROSS JOIN LATERAL (
    SELECT attempt.id
    FROM assessment_attempts attempt
    WHERE attempt.training_assignment_id = assignment.id
      AND attempt.assessment_id = assessment.id
      AND attempt.passed
      AND attempt.submitted_at IS NOT NULL
    ORDER BY attempt.submitted_at DESC, attempt.id DESC
    LIMIT 1
  ) result
  WHERE evidence.certificate_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW available_certificates AS
SELECT certificate.*
FROM certificates certificate
JOIN certification_eligibility eligibility
  ON eligibility.trainee_id = certificate.trainee_id
 AND eligibility.eligible
WHERE certificate.status = 'issued'
  AND certificate.requirement_fingerprint =
    current_requirement_fingerprint(certificate.trainee_id);
