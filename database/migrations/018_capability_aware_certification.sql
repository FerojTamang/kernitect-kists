-- Certification follows each required module's active capabilities. Modules with
-- no active scenario have no scenario requirement; modules with active scenarios
-- require every such scenario to be completed for the assigned trainee.
CREATE OR REPLACE VIEW certification_eligibility AS
SELECT u.id AS trainee_id,
  EXISTS (
    SELECT 1
    FROM training_assignments ta
    WHERE ta.trainee_id = u.id
      AND ta.required
      AND ta.status = 'active'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM training_assignments ta
    LEFT JOIN progress p ON p.training_assignment_id = ta.id
    WHERE ta.trainee_id = u.id
      AND ta.required
      AND ta.status = 'active'
      AND (
        p.completed_at IS NULL
        OR p.percentage <> 100
        OR EXISTS (
          SELECT 1
          FROM scenarios s
          WHERE s.training_module_id = ta.training_module_id
            AND s.is_active
            AND NOT EXISTS (
              SELECT 1
              FROM scenario_attempts sa
              WHERE sa.training_assignment_id = ta.id
                AND sa.scenario_id = s.id
                AND sa.completed_at IS NOT NULL
            )
        )
        OR EXISTS (
          SELECT 1
          FROM assessments a
          WHERE a.training_module_id = ta.training_module_id
            AND a.is_active
            AND NOT EXISTS (
              SELECT 1
              FROM assessment_attempts aa
              WHERE aa.training_assignment_id = ta.id
                AND aa.assessment_id = a.id
                AND aa.submitted_at IS NOT NULL
                AND aa.passed
            )
        )
      )
  ) AS eligible
FROM users u
JOIN system_roles r ON r.id = u.system_role_id
WHERE r.name = 'trainee'
  AND u.is_active;
