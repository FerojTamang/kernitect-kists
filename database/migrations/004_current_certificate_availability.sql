-- Issued certificates remain historical evidence. Current availability additionally
-- requires coverage of today's required assignment and active assessment set.
CREATE VIEW available_certificates AS
SELECT c.* FROM certificates c
JOIN certification_eligibility eligibility ON eligibility.trainee_id = c.trainee_id AND eligibility.eligible
WHERE c.status = 'issued'
AND NOT EXISTS (
  SELECT 1 FROM training_assignments ta
  WHERE ta.trainee_id = c.trainee_id AND ta.required AND ta.status = 'active'
    AND (NOT EXISTS (
      SELECT 1 FROM certificate_assignments ca
      WHERE ca.certificate_id = c.id AND ca.training_assignment_id = ta.id
    ) OR EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.training_module_id = ta.training_module_id AND a.is_active
        AND NOT EXISTS (
          SELECT 1 FROM certificate_assessment_attempts evidence
          WHERE evidence.certificate_id = c.id AND evidence.training_assignment_id = ta.id
            AND evidence.assessment_id = a.id
        )
    ))
);
