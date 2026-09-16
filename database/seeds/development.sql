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
SELECT id, 'Assessing the Task and Load', 'text',
  'Before moving a load, assess what needs to be moved, including its size, shape, stability and weight. Plan a clear route, identify obstacles and consider the destination. Decide whether you need assistance or suitable handling equipment, and consider your own capability before starting.', 3, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Safe Lifting Techniques', 'text',
  'Use these steps: plan the lift; assess the load and route; set stable footing; bend your knees; secure a firm grip; keep the load close; lift smoothly; avoid twisting; and ask for assistance or use equipment when the load or route requires it.', 4, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Practical Examples', 'text',
  'Safe example: bend your knees, keep your back steady and hold the carton close as you move. Unsafe example: bending from the waist, twisting while lifting or carrying a load that blocks your view. Choose the safe approach and ask for help when needed.', 5, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Forklift and pedestrian safety overview', 'text',
  'Development placeholder only. Replace with client-reviewed safety learning content before use.', 1, false
FROM training_modules WHERE slug = 'forklift-pedestrian-safety'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

-- Prototype Manual Handling scenario fixture. The resource reference is a
-- development placeholder until the Phase 6 viewer supplies a real panorama.
INSERT INTO scenarios
  (training_module_id, title, description, resource_reference, sequence_order, is_active)
SELECT id, 'Warehouse Manual Handling Scenario',
  'Prototype warehouse decision scenario for applying Manual Handling learning.',
  'prototype://manual-handling-warehouse', 1, true
FROM training_modules WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  resource_reference = EXCLUDED.resource_reference,
  is_active = EXCLUDED.is_active,
  updated_at = clock_timestamp();

INSERT INTO hazards
  (scenario_id, title, description, feedback, hotspot_yaw, hotspot_pitch, metadata, sequence_order)
SELECT s.id, hazard.title, hazard.description, hazard.feedback,
  hazard.hotspot_yaw, hazard.hotspot_pitch, hazard.metadata::jsonb, hazard.sequence_order
FROM scenarios s
JOIN training_modules m ON m.id = s.training_module_id
CROSS JOIN (VALUES
  (
    1,
    'Obstructed handling route',
    'Packaging has been left in the route between the load and its destination.',
    'Clear the route before moving the load so the handling path is unobstructed.',
    -70.000::numeric,
    -12.000::numeric,
    '{"decisionPrompt":"What should you do before moving the load?","decisionOptions":[{"key":"clear-route","label":"Clear the route before moving the load"},{"key":"step-around","label":"Carry the load and step around the obstruction"},{"key":"move-faster","label":"Move quickly before the route gets busier"}],"correctDecisionKey":"clear-route"}'
  ),
  (
    2,
    'Unstable stacked load',
    'A carton is leaning on top of an unstable stack and may shift when handled.',
    'Stabilise or restack the load before attempting to move it.',
    15.000::numeric,
    -8.000::numeric,
    '{"decisionPrompt":"What is the safer action?","decisionOptions":[{"key":"stabilise-load","label":"Stabilise or restack the load first"},{"key":"hold-top-box","label":"Hold the top box with one hand while carrying"},{"key":"pull-from-bottom","label":"Pull a lower carton out quickly"}],"correctDecisionKey":"stabilise-load"}'
  ),
  (
    3,
    'Awkward lifting posture',
    'A worker is reaching forward and bending mainly from the back to lift a carton.',
    'Reposition close to the load, use stable footing and avoid an awkward reach before lifting.',
    75.000::numeric,
    -15.000::numeric,
    '{"decisionPrompt":"Which response best reduces the handling risk?","decisionOptions":[{"key":"reposition-close","label":"Reposition close to the load and use stable footing"},{"key":"lift-from-reach","label":"Keep reaching and lift from the current position"},{"key":"twist-lift","label":"Twist while lifting to save time"}],"correctDecisionKey":"reposition-close"}'
  ),
  (
    4,
    'Load suited to handling equipment',
    'A bulky load would be difficult to carry safely by hand over the required distance.',
    'Use suitable handling equipment when the load or route makes manual carrying inappropriate.',
    140.000::numeric,
    -10.000::numeric,
    '{"decisionPrompt":"How should this load be moved?","decisionOptions":[{"key":"use-equipment","label":"Use suitable handling equipment"},{"key":"carry-alone","label":"Carry it alone even if it blocks your view"},{"key":"drag-floor","label":"Drag it across the floor by hand"}],"correctDecisionKey":"use-equipment"}'
  ),
  (
    5,
    'Load requires assistance',
    'The load is large enough that one person may not be able to control it safely.',
    'Pause the task and arrange appropriate assistance or another safer handling method.',
    -150.000::numeric,
    -6.000::numeric,
    '{"decisionPrompt":"What should the worker do?","decisionOptions":[{"key":"get-assistance","label":"Get appropriate assistance or use another safer method"},{"key":"try-alone","label":"Try the lift alone first"},{"key":"lift-higher","label":"Lift it higher so it is easier to see around"}],"correctDecisionKey":"get-assistance"}'
  )
) AS hazard(sequence_order, title, description, feedback, hotspot_yaw, hotspot_pitch, metadata)
WHERE m.slug = 'manual-handling' AND s.sequence_order = 1
ON CONFLICT (scenario_id, sequence_order) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  feedback = EXCLUDED.feedback,
  hotspot_yaw = EXCLUDED.hotspot_yaw,
  hotspot_pitch = EXCLUDED.hotspot_pitch,
  metadata = EXCLUDED.metadata,
  updated_at = clock_timestamp();

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

INSERT INTO formative_questions (training_content_id, question_text, sequence_order)
SELECT c.id, q.question_text, q.question_order
FROM training_content c
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  ('Introduction', 'Which activity is included in manual handling?', 1),
  ('Introduction', 'Why is safe manual handling important?', 2),
  ('Risks and Injuries', 'Which is a common manual-handling injury?', 1),
  ('Risks and Injuries', 'Which practice increases handling risk?', 2),
  ('Assessing the Task and Load', 'What should you check before moving a load?', 1),
  ('Assessing the Task and Load', 'When should handling equipment or help be considered?', 2),
  ('Safe Lifting Techniques', 'What should you do before lifting?', 1),
  ('Safe Lifting Techniques', 'How should you carry a load?', 2),
  ('Practical Examples', 'Which is the safer warehouse handling example?', 1),
  ('Practical Examples', 'What is the safest action when a load blocks your view?', 2)
) AS q(section_title, question_text, question_order)
  ON q.section_title = c.title
WHERE m.slug = 'manual-handling'
ON CONFLICT (training_content_id, sequence_order) DO NOTHING;

INSERT INTO formative_answer_options
  (formative_question_id, option_text, is_correct, sequence_order)
SELECT q.id, option.option_text, option.is_correct, option.option_order
FROM formative_questions q
JOIN training_content c ON c.id = q.training_content_id
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  ('Introduction', 1, 'Only lifting boxes', false, 1), ('Introduction', 1, 'Lifting, pushing, pulling and carrying objects', true, 2), ('Introduction', 1, 'Only driving a forklift', false, 3), ('Introduction', 1, 'Only office-based work', false, 4),
  ('Introduction', 2, 'It removes every workplace hazard', false, 1), ('Introduction', 2, 'It helps reduce avoidable injury', true, 2), ('Introduction', 2, 'It makes loads lighter', false, 3), ('Introduction', 2, 'It removes the need for training', false, 4),
  ('Risks and Injuries', 1, 'Back pain', true, 1), ('Risks and Injuries', 1, 'Sunburn only', false, 2), ('Risks and Injuries', 1, 'Hearing improvement', false, 3), ('Risks and Injuries', 1, 'Improved eyesight', false, 4),
  ('Risks and Injuries', 2, 'Planning the route', false, 1), ('Risks and Injuries', 2, 'Twisting while carrying a heavy load', true, 2), ('Risks and Injuries', 2, 'Using suitable equipment', false, 3), ('Risks and Injuries', 2, 'Asking for assistance', false, 4),
  ('Assessing the Task and Load', 1, 'Only the colour of the load', false, 1), ('Assessing the Task and Load', 1, 'Size, shape, stability, weight and route', true, 2), ('Assessing the Task and Load', 1, 'The time of day only', false, 3), ('Assessing the Task and Load', 1, 'Whether the load has a label', false, 4),
  ('Assessing the Task and Load', 2, 'When the load or route exceeds safe capability', true, 1), ('Assessing the Task and Load', 2, 'Only after an injury occurs', false, 2), ('Assessing the Task and Load', 2, 'Never; equipment is not useful', false, 3), ('Assessing the Task and Load', 2, 'Only when a colleague asks', false, 4),
  ('Safe Lifting Techniques', 1, 'Lift immediately without checking', false, 1), ('Safe Lifting Techniques', 1, 'Plan the lift and assess the route', true, 2), ('Safe Lifting Techniques', 1, 'Twist to reach the load', false, 3), ('Safe Lifting Techniques', 1, 'Block the route first', false, 4),
  ('Safe Lifting Techniques', 2, 'Keep it close and avoid twisting', true, 1), ('Safe Lifting Techniques', 2, 'Hold it away from your body', false, 2), ('Safe Lifting Techniques', 2, 'Carry it above shoulder height', false, 3), ('Safe Lifting Techniques', 2, 'Move as quickly as possible', false, 4),
  ('Practical Examples', 1, 'Bend your knees and keep the load close', true, 1), ('Practical Examples', 1, 'Bend from the waist and twist', false, 2), ('Practical Examples', 1, 'Carry a load that blocks your view', false, 3), ('Practical Examples', 1, 'Rush because the route is busy', false, 4),
  ('Practical Examples', 2, 'Continue and hope the route is clear', false, 1), ('Practical Examples', 2, 'Stop, make the route safe and get help if needed', true, 2), ('Practical Examples', 2, 'Turn sideways and run', false, 3), ('Practical Examples', 2, 'Lift it higher to see underneath', false, 4)
) AS option(section_title, question_order, option_text, is_correct, option_order)
  ON option.section_title = c.title AND option.question_order = q.sequence_order
WHERE m.slug = 'manual-handling'
ON CONFLICT (formative_question_id, sequence_order) DO NOTHING;
