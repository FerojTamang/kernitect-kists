-- Read model: optional/cancelled assignments and unassigned modules do not count.
-- Inactive MODULES do not waive an existing required assignment.
CREATE VIEW certification_eligibility AS
SELECT u.id AS trainee_id,
  EXISTS (SELECT 1 FROM training_assignments ta
    WHERE ta.trainee_id = u.id AND ta.required AND ta.status = 'active')
  AND NOT EXISTS (
    SELECT 1 FROM training_assignments ta
    LEFT JOIN progress p ON p.training_assignment_id = ta.id
    WHERE ta.trainee_id = u.id AND ta.required AND ta.status = 'active'
      AND (p.completed_at IS NULL OR EXISTS (
        SELECT 1 FROM assessments a
        WHERE a.training_module_id = ta.training_module_id AND a.is_active
          AND NOT EXISTS (SELECT 1 FROM assessment_attempts aa
            WHERE aa.training_assignment_id = ta.id AND aa.assessment_id = a.id
              AND aa.submitted_at IS NOT NULL AND aa.passed)
      ))
  ) AS eligible
FROM users u JOIN system_roles r ON r.id = u.system_role_id
WHERE r.name = 'trainee' AND u.is_active;

CREATE FUNCTION validate_certificate() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.trainee_id, NEW.certificate_number, NEW.issued_at)
      IS DISTINCT FROM (OLD.id, OLD.trainee_id, OLD.certificate_number, OLD.issued_at)
      OR OLD.status = 'revoked' THEN
      RAISE EXCEPTION 'Certificate identity is immutable; revoked certificates cannot be reactivated' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- A short database-wide issuance lock is deliberately simple for this foundation.
  -- SHARE prevents concurrent writes to the eligibility inputs until this transaction ends.
  LOCK TABLE users, training_assignments, progress, assessments, assessment_attempts IN SHARE MODE;
  IF NEW.status <> 'issued' OR NOT EXISTS (
    SELECT 1 FROM certification_eligibility WHERE trainee_id = NEW.trainee_id AND eligible
  ) THEN
    RAISE EXCEPTION 'All active required assignments and their active assessments must be completed before certification' USING ERRCODE = '23514';
  END IF;
  NEW.issued_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_certificate BEFORE INSERT OR UPDATE ON certificates
FOR EACH ROW EXECUTE FUNCTION validate_certificate();

CREATE FUNCTION snapshot_certificate_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  INSERT INTO certificate_assignments (certificate_id, training_assignment_id, completed_at_snapshot)
  SELECT NEW.id, ta.id, p.completed_at FROM training_assignments ta
  JOIN progress p ON p.training_assignment_id = ta.id
  WHERE ta.trainee_id = NEW.trainee_id AND ta.required AND ta.status = 'active';

  INSERT INTO certificate_assessment_attempts
    (certificate_id, training_assignment_id, assessment_id, assessment_attempt_id)
  SELECT NEW.id, ca.training_assignment_id, a.id, result.id
  FROM certificate_assignments ca
  JOIN training_assignments ta ON ta.id = ca.training_assignment_id
  JOIN assessments a ON a.training_module_id = ta.training_module_id AND a.is_active
  CROSS JOIN LATERAL (
    SELECT aa.id FROM assessment_attempts aa
    WHERE aa.training_assignment_id = ta.id AND aa.assessment_id = a.id AND aa.passed
      AND aa.submitted_at IS NOT NULL
    ORDER BY aa.submitted_at DESC, aa.id DESC LIMIT 1
  ) result
  WHERE ca.certificate_id = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER snapshot_certificate_evidence AFTER INSERT ON certificates
FOR EACH ROW EXECUTE FUNCTION snapshot_certificate_evidence();

CREATE FUNCTION protect_certificate_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Certificate evidence is immutable and created only by certificate issuance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_certificate_assignments BEFORE INSERT OR UPDATE OR DELETE ON certificate_assignments
FOR EACH ROW EXECUTE FUNCTION protect_certificate_evidence();
CREATE TRIGGER protect_certificate_attempts BEFORE INSERT OR UPDATE OR DELETE ON certificate_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION protect_certificate_evidence();
