-- Development fixtures, not client-approved content or assessment policy.
INSERT INTO system_roles (name, description) VALUES
  ('trainee', 'Uses assigned safety training'),
  ('administrator', 'Manages users, assignments and learning content')
ON CONFLICT (name) DO NOTHING;

INSERT INTO job_roles (name, description) VALUES
  ('Warehouse Operative', 'Example workplace function for development'),
  ('Forklift Operator', 'Example workplace function for development'),
  ('Supervisor', 'Example workplace function for development')
ON CONFLICT (name) DO NOTHING;

INSERT INTO training_modules (title, slug, description) VALUES
  ('Manual Handling', 'manual-handling', 'Main planned A7 prototype module. Learning content requires client review.'),
  ('Forklift and Pedestrian Safety', 'forklift-pedestrian-safety', 'Initial training scope. Learning content requires client review.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'DEMO: Introduction to ' || title, 'text',
  'Development placeholder only. Replace with client-reviewed safety learning content before use.', 1, false
FROM training_modules WHERE slug IN ('manual-handling', 'forklift-pedestrian-safety')
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO scenarios (training_module_id, title, description, sequence_order)
SELECT id, 'DEMO: Warehouse loading area', 'Draft scene. No panorama asset or viewer is implemented.', 1
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO hazards (scenario_id, title, description, feedback, hotspot_yaw, hotspot_pitch, sequence_order)
SELECT s.id, 'DEMO: Obstructed route', 'Fictional draft decision point.',
  'Placeholder feedback; requires client and safety-content review.', 25, -12, 1
FROM scenarios s JOIN training_modules m ON m.id = s.training_module_id
WHERE m.slug = 'manual-handling' AND s.sequence_order = 1
ON CONFLICT (scenario_id, sequence_order) DO NOTHING;

-- 75 is an arbitrary DEMO threshold, NOT a confirmed KISTS requirement. No schema default.
INSERT INTO assessments (training_module_id, title, description, pass_percentage, sequence_order, is_active)
SELECT id, 'DEMO: Knowledge check', 'Draft only. Demo threshold 75%; client must confirm assessment policy.', 75, 1, false
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO questions (assessment_id, question_text, question_type, sequence_order)
SELECT a.id, 'DEMO: Is this sample training content approved for operational use?', 'true_false', 1
FROM assessments a JOIN training_modules m ON m.id = a.training_module_id
WHERE m.slug = 'manual-handling' AND a.sequence_order = 1
ON CONFLICT (assessment_id, sequence_order) DO NOTHING;

INSERT INTO answer_options (question_id, option_text, is_correct, sequence_order)
SELECT q.id, option.option_text, option.is_correct, option.sequence_order
FROM questions q JOIN assessments a ON a.id = q.assessment_id
JOIN training_modules m ON m.id = a.training_module_id
CROSS JOIN (VALUES ('Yes', false, 1), ('No — it is development-only content.', true, 2))
  AS option(option_text, is_correct, sequence_order)
WHERE m.slug = 'manual-handling' AND a.sequence_order = 1 AND q.sequence_order = 1
ON CONFLICT (question_id, sequence_order) DO NOTHING;
