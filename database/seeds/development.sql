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
SELECT id, 'Introduction', 'text',
  'Manual handling is the movement of objects by hand, including lifting, lowering, pushing, pulling, carrying and holding. It matters because poor technique can cause injury in warehouses, distribution centres and delivery work. Everyday examples include moving cartons, loading pallets and placing stock on shelving.', 1, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Risks and Injuries', 'text',
  'Poor manual handling can cause back pain, muscle strain, joint injury and longer-term musculoskeletal disorders. Warning: do not rush a lift or work around a load that is too heavy, unstable or difficult to reach. Stop, make the area safe and use the correct technique or equipment.', 2, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Safe Lifting Techniques', 'text',
  'Use these steps: plan the lift; assess the load and route; set stable footing; bend your knees; secure a firm grip; keep the load close; lift smoothly; avoid twisting; and ask for assistance or use equipment when the load or route requires it.', 3, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Practical Examples', 'text',
  'Safe example: bend your knees, keep your back steady and hold the carton close as you move. Unsafe example: bending from the waist, twisting while lifting or carrying a load that blocks your view. Choose the safe approach and ask for help when needed.', 4, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Forklift and pedestrian safety overview', 'text',
  'Development placeholder only. Replace with client-reviewed safety learning content before use.', 1, false
FROM training_modules WHERE slug = 'forklift-pedestrian-safety'
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
