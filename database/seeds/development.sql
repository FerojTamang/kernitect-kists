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

INSERT INTO training_modules (title, slug, description, is_active) VALUES
  ('Manual Handling', 'manual-handling', 'Develop safe lifting, carrying and load-handling techniques to reduce injury risk in warehouse environments.', true),
  ('Forklift and Pedestrian Safety', 'forklift-pedestrian-safety', 'Covers safe pedestrian movement around forklift operations, including blind spots, safe distances, crossing points and warehouse traffic awareness.', true)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

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

-- Manual Handling 360-degree scenario fixture. The browser viewer uses the
-- local equirectangular panorama stored with the client assets.
INSERT INTO scenarios
  (training_module_id, title, description, resource_reference, sequence_order, is_active)
SELECT id, 'Warehouse Manual Handling Scenario',
  'Prototype warehouse decision scenario for applying Manual Handling learning.',
  'asset://scenarios/manual-handling/manual-handling-warehouse.jpg', 1, true
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

-- Phase 7A: Manual Handling final graded assessment.
--
-- The 75% pass mark is a prototype policy value only.
-- It remains configurable through assessments.pass_percentage
-- and should be updated if the client confirms a different threshold.

INSERT INTO assessments (
  training_module_id,
  title,
  description,
  pass_percentage,
  sequence_order,
  is_active
)
SELECT
  id,
  'Manual Handling Final Assessment',
  'Final graded assessment covering the Manual Handling learning content and interactive warehouse scenario. Prototype pass mark: 75%.',
  75,
  2,
  true
FROM training_modules
WHERE slug = 'manual-handling'
ON CONFLICT (training_module_id, sequence_order)
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  pass_percentage = EXCLUDED.pass_percentage,
  is_active = EXCLUDED.is_active,
  updated_at = clock_timestamp();


-- ------------------------------------------------------------
-- Questions
-- ------------------------------------------------------------

INSERT INTO questions (
  assessment_id,
  question_text,
  question_type,
  sequence_order
)
SELECT
  a.id,
  question.question_text,
  'single_choice',
  question.question_order
FROM assessments a
JOIN training_modules m
  ON m.id = a.training_module_id
CROSS JOIN (
  VALUES
    (
      1,
      'What should you assess before moving a load manually?'
    ),
    (
      2,
      'What should you do if the planned handling route is obstructed?'
    ),
    (
      3,
      'What is the safest action when a stacked load appears unstable?'
    ),
    (
      4,
      'Which lifting technique provides the safest handling posture?'
    ),
    (
      5,
      'How should you change direction while carrying a load?'
    ),
    (
      6,
      'What should you do if a load blocks your view of the route?'
    ),
    (
      7,
      'When should suitable handling equipment be used?'
    ),
    (
      8,
      'What should you do when a load cannot be safely handled by one person?'
    ),
    (
      9,
      'What should you do before beginning a lift?'
    ),
    (
      10,
      'How should a load normally be positioned while carrying it?'
    )
) AS question(question_order, question_text)
WHERE
  m.slug = 'manual-handling'
  AND a.sequence_order = 2
ON CONFLICT (assessment_id, sequence_order)
DO UPDATE SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  updated_at = clock_timestamp();


-- ------------------------------------------------------------
-- Answer options
-- Exactly one correct option is provided for each question.
-- ------------------------------------------------------------

INSERT INTO answer_options (
  question_id,
  option_text,
  is_correct,
  sequence_order
)
SELECT
  q.id,
  option.option_text,
  option.is_correct,
  option.option_order
FROM questions q
JOIN assessments a
  ON a.id = q.assessment_id
JOIN training_modules m
  ON m.id = a.training_module_id
JOIN (
  VALUES

    -- Question 1
    (
      1,
      1,
      'Only the weight of the load',
      false
    ),
    (
      1,
      2,
      'The size, shape, stability, weight and planned route',
      true
    ),
    (
      1,
      3,
      'Only where the load will be placed',
      false
    ),
    (
      1,
      4,
      'Nothing if the load looks small',
      false
    ),

    -- Question 2
    (
      2,
      1,
      'Carry the load and carefully step around the obstruction',
      false
    ),
    (
      2,
      2,
      'Clear the route before moving the load',
      true
    ),
    (
      2,
      3,
      'Move faster so the obstruction causes less delay',
      false
    ),
    (
      2,
      4,
      'Ignore the obstruction if another worker can see it',
      false
    ),

    -- Question 3
    (
      3,
      1,
      'Move the load immediately before it falls',
      false
    ),
    (
      3,
      2,
      'Stabilise or restack the load before attempting to move it',
      true
    ),
    (
      3,
      3,
      'Remove a box from the bottom of the stack',
      false
    ),
    (
      3,
      4,
      'Carry the unstable boxes one-handed',
      false
    ),

    -- Question 4
    (
      4,
      1,
      'Keep the legs straight and bend from the waist',
      false
    ),
    (
      4,
      2,
      'Use a stable stance, bend the knees and keep the load close',
      true
    ),
    (
      4,
      3,
      'Hold the load away from the body to improve visibility',
      false
    ),
    (
      4,
      4,
      'Twist the upper body while lifting',
      false
    ),

    -- Question 5
    (
      5,
      1,
      'Twist from the waist while keeping your feet still',
      false
    ),
    (
      5,
      2,
      'Move your feet and turn your whole body',
      true
    ),
    (
      5,
      3,
      'Lean backwards while turning',
      false
    ),
    (
      5,
      4,
      'Hold the load with one hand while turning',
      false
    ),

    -- Question 6
    (
      6,
      1,
      'Continue as long as you remember where the route is',
      false
    ),
    (
      6,
      2,
      'Stop, make the route safe and obtain help if needed',
      true
    ),
    (
      6,
      3,
      'Raise the load higher so you can see underneath it',
      false
    ),
    (
      6,
      4,
      'Walk backwards while carrying the load',
      false
    ),

    -- Question 7
    (
      7,
      1,
      'Only after a worker has already attempted the manual lift',
      false
    ),
    (
      7,
      2,
      'When it can reduce the physical effort and handling risk',
      true
    ),
    (
      7,
      3,
      'Only for empty containers',
      false
    ),
    (
      7,
      4,
      'Never when manual handling is possible',
      false
    ),

    -- Question 8
    (
      8,
      1,
      'Attempt the lift alone to test the weight',
      false
    ),
    (
      8,
      2,
      'Get appropriate assistance or use a suitable handling aid',
      true
    ),
    (
      8,
      3,
      'Drag the load across the floor',
      false
    ),
    (
      8,
      4,
      'Lift it quickly before becoming tired',
      false
    ),

    -- Question 9
    (
      9,
      1,
      'Plan the lift and check the route and destination',
      true
    ),
    (
      9,
      2,
      'Lift immediately and decide where to place it afterwards',
      false
    ),
    (
      9,
      3,
      'Stand as far away from the load as possible',
      false
    ),
    (
      9,
      4,
      'Twist the load to determine whether it is heavy',
      false
    ),

    -- Question 10
    (
      10,
      1,
      'As far away from the body as possible',
      false
    ),
    (
      10,
      2,
      'Close to the body with a secure grip',
      true
    ),
    (
      10,
      3,
      'Above shoulder height',
      false
    ),
    (
      10,
      4,
      'Supported on one side of the body only',
      false
    )

) AS option(
  question_order,
  option_order,
  option_text,
  is_correct
)
  ON option.question_order = q.sequence_order
WHERE
  m.slug = 'manual-handling'
  AND a.sequence_order = 2
ON CONFLICT (question_id, sequence_order)
DO UPDATE SET
  option_text = EXCLUDED.option_text,
  is_correct = EXCLUDED.is_correct,
  updated_at = clock_timestamp();

-- Forklift and Pedestrian Safety Phase 1 fixtures (kept aligned with migration 016).
-- Phase 1: Forklift and Pedestrian Safety awareness learning and assessment.
-- This module intentionally has no interactive scenario.

UPDATE training_modules
SET is_active = true, updated_at = clock_timestamp()
WHERE slug = 'forklift-pedestrian-safety';

INSERT INTO training_content
  (training_module_id, title, content_type, body, resource_reference, sequence_order, is_active)
SELECT m.id, content.title, 'text', content.body,
  'asset://images/dashboard/forklift-pedestrian-safety.jpg', content.sequence_order, true
FROM training_modules m
CROSS JOIN (VALUES
  (1, 'Working Safely Around Forklifts', 'Forklift and pedestrian safety is a shared responsibility. Forklifts can turn, reverse and stop differently from pedestrians, so everyone must stay alert around vehicle operating areas and follow the site traffic plan.'),
  (2, 'Pedestrian Routes and Walkways', 'Use designated pedestrian routes, marked walkways and protected areas. Respect barriers and signs, and do not take shortcuts through vehicle-only operating zones.'),
  (3, 'Forklift Blind Spots', 'Forklift operators have limited visibility to the sides and rear, and a load may block the forward view. Never assume an operator has seen you; remain in a safe place until awareness is confirmed.'),
  (4, 'Safe Separation', 'Keep clear of operating forklifts and allow enough room for turning, reversing and manoeuvring. Hazard areas change as vehicles and loads move, so continually reassess your position rather than relying on one universal distance.'),
  (5, 'Crossing Points and Intersections', 'Use designated crossings. Stop, look and listen before entering a vehicle route, take extra care at corners and racking intersections, and never step suddenly into a forklift path.'),
  (6, 'Visibility and Communication', 'Confirm that the operator is aware of you before approaching or crossing. Use agreed workplace signals and procedures, wear visibility PPE required by the site, and never rely only on alarms.'),
  (7, 'Loads and Operating Areas', 'Never walk beneath a raised load. Keep clear of loading and unloading operations, watch for unstable loads, and recognise that the hazard zone changes while a forklift is moving or handling materials.'),
  (8, 'Unsafe Behaviour and Reporting', 'Avoid distractions, shortcuts through vehicle routes, horseplay and unsafe riding. Report damaged barriers or signs, poor visibility and other unsafe conditions through the workplace reporting process.')
) AS content(sequence_order, title, body)
WHERE m.slug = 'forklift-pedestrian-safety'
ON CONFLICT (training_module_id, sequence_order) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  resource_reference = EXCLUDED.resource_reference, is_active = true,
  updated_at = clock_timestamp();

INSERT INTO formative_questions (training_content_id, question_text, sequence_order)
SELECT c.id, check_data.question_text, 1
FROM training_content c
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  (2, 'Which route should pedestrians use in a warehouse?'),
  (3, 'What should you do if you are unsure whether a forklift operator has seen you?'),
  (5, 'What should you do before entering a forklift operating area?'),
  (7, 'Is walking beneath a raised load acceptable?')
) AS check_data(section_order, question_text) ON check_data.section_order = c.sequence_order
WHERE m.slug = 'forklift-pedestrian-safety'
ON CONFLICT (training_content_id, sequence_order) DO UPDATE SET
  question_text = EXCLUDED.question_text, updated_at = clock_timestamp();

INSERT INTO formative_answer_options
  (formative_question_id, option_text, is_correct, sequence_order)
SELECT fq.id, option_data.option_text, option_data.is_correct, option_data.option_order
FROM formative_questions fq
JOIN training_content c ON c.id = fq.training_content_id
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  (2, 1, 'The designated pedestrian route or marked walkway', true),
  (2, 2, 'The shortest route through the vehicle area', false),
  (2, 3, 'Any route if no forklift is visible', false),
  (3, 1, 'Wait in a safe place and confirm the operator is aware of you', true),
  (3, 2, 'Walk closer so the operator notices you', false),
  (3, 3, 'Rely on the reversing alarm', false),
  (5, 1, 'Stop, look, listen and use the designated crossing procedure', true),
  (5, 2, 'Cross quickly before a vehicle arrives', false),
  (5, 3, 'Follow another pedestrian without checking', false),
  (7, 1, 'No, remain clear of raised loads and loading operations', true),
  (7, 2, 'Yes, if the operator is watching', false),
  (7, 3, 'Yes, when wearing high-visibility clothing', false)
) AS option_data(section_order, option_order, option_text, is_correct)
  ON option_data.section_order = c.sequence_order
WHERE m.slug = 'forklift-pedestrian-safety' AND fq.sequence_order = 1
ON CONFLICT (formative_question_id, sequence_order) DO UPDATE SET
  option_text = EXCLUDED.option_text, is_correct = EXCLUDED.is_correct,
  updated_at = clock_timestamp();

INSERT INTO assessments
  (training_module_id, title, description, pass_percentage, sequence_order, is_active)
SELECT id, 'Forklift and Pedestrian Safety Final Assessment',
  'Final graded assessment for Forklift and Pedestrian Safety awareness training.',
  75, 1, true
FROM training_modules WHERE slug = 'forklift-pedestrian-safety'
ON CONFLICT (training_module_id, sequence_order) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  pass_percentage = EXCLUDED.pass_percentage, is_active = true,
  updated_at = clock_timestamp();

INSERT INTO questions (assessment_id, question_text, question_type, sequence_order)
SELECT a.id, question_data.question_text, 'single_choice', question_data.question_order
FROM assessments a
JOIN training_modules m ON m.id = a.training_module_id
CROSS JOIN (VALUES
  (1, 'Where should pedestrians normally walk in a warehouse?'),
  (2, 'What is safest when you cannot tell whether a forklift operator has seen you?'),
  (3, 'How should pedestrians manage separation from an operating forklift?'),
  (4, 'What should you do at a designated vehicle crossing?'),
  (5, 'Which statement about forklift alarms is correct?'),
  (6, 'When is it acceptable to walk beneath a raised forklift load?'),
  (7, 'What should a pedestrian do near an active loading area?'),
  (8, 'Which behaviour increases risk around forklifts?'),
  (9, 'What should you do if a pedestrian barrier is damaged?'),
  (10, 'Who is responsible for safety where forklifts and pedestrians share a workplace?')
) AS question_data(question_order, question_text)
WHERE m.slug = 'forklift-pedestrian-safety' AND a.sequence_order = 1
ON CONFLICT (assessment_id, sequence_order) DO UPDATE SET
  question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type,
  updated_at = clock_timestamp();

INSERT INTO answer_options (question_id, option_text, is_correct, sequence_order)
SELECT q.id, option_data.option_text, option_data.is_correct, option_data.option_order
FROM questions q
JOIN assessments a ON a.id = q.assessment_id
JOIN training_modules m ON m.id = a.training_module_id
JOIN (VALUES
  (1,1,'On designated pedestrian routes and marked walkways',true),(1,2,'Through vehicle-only zones when quiet',false),(1,3,'Wherever the route is shortest',false),(1,4,'Immediately behind a moving forklift',false),
  (2,1,'Remain safe and confirm the operator is aware before proceeding',true),(2,2,'Assume eye contact is unnecessary',false),(2,3,'Move into the operator''s path and wave',false),(2,4,'Rely only on the horn or alarm',false),
  (3,1,'Keep clear and allow space for turning and manoeuvring',true),(3,2,'Use one fixed distance in every workplace',false),(3,3,'Walk beside the forklift to stay visible',false),(3,4,'Stand close to reduce travel time',false),
  (4,1,'Stop, check for traffic and follow the site crossing procedure',true),(4,2,'Cross without stopping if you hear no alarm',false),(4,3,'Run across to spend less time in the route',false),(4,4,'Follow the person ahead without checking',false),
  (5,1,'Alarms support awareness but do not replace looking and following procedures',true),(5,2,'An alarm guarantees the operator can see every pedestrian',false),(5,3,'Pedestrians may ignore crossings when an alarm is silent',false),(5,4,'Alarms remove the need for separation',false),
  (6,1,'Never',true),(6,2,'When wearing a hard hat',false),(6,3,'When the load appears stable',false),(6,4,'When the operator gives a hand signal',false),
  (7,1,'Remain clear and follow controls for the changing operating area',true),(7,2,'Walk between the forklift and its load',false),(7,3,'Stand beside stacked goods to observe',false),(7,4,'Enter whenever loading pauses briefly',false),
  (8,1,'Using a phone while walking through a vehicle area',true),(8,2,'Using a marked walkway',false),(8,3,'Stopping at a crossing',false),(8,4,'Reporting poor visibility',false),
  (9,1,'Keep clear and report it through the workplace process',true),(9,2,'Move it aside and continue without reporting',false),(9,3,'Use the damaged area as a shortcut',false),(9,4,'Wait until someone is injured',false),
  (10,1,'Operators, pedestrians and the organisation share responsibility',true),(10,2,'Only forklift operators',false),(10,3,'Only pedestrians',false),(10,4,'Only visitors',false)
) AS option_data(question_order, option_order, option_text, is_correct)
  ON option_data.question_order = q.sequence_order
WHERE m.slug = 'forklift-pedestrian-safety' AND a.sequence_order = 1
ON CONFLICT (question_id, sequence_order) DO UPDATE SET
  option_text = EXCLUDED.option_text, is_correct = EXCLUDED.is_correct,
  updated_at = clock_timestamp();

-- Complete Forklift formative checks (kept aligned with migration 017).
-- Complete the Forklift and Pedestrian Safety formative learning checks.
-- Each of the eight sections has two single-choice practice questions.

INSERT INTO formative_questions (training_content_id, question_text, sequence_order)
SELECT c.id, check_data.question_text, check_data.question_order
FROM training_content c
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  (1,1,'Who is responsible for maintaining awareness in shared warehouse areas?'),
  (1,2,'What should a pedestrian do when entering an area used by forklifts?'),
  (2,1,'Which route should a pedestrian normally use?'),
  (2,2,'When should a pedestrian leave a designated walkway?'),
  (3,1,'Why should pedestrians avoid assuming a forklift operator has seen them?'),
  (3,2,'What can further restrict a forklift operator''s forward visibility?'),
  (4,1,'Why should pedestrians maintain separation from a moving forklift?'),
  (4,2,'What should a pedestrian consider when a forklift is turning?'),
  (5,1,'Where should pedestrians cross a vehicle route when a designated crossing exists?'),
  (5,2,'What should a pedestrian do before entering an obscured intersection?'),
  (6,1,'What should a pedestrian do if unsure whether a forklift operator is aware of them?'),
  (6,2,'Why should alarms not be the only safety measure relied upon?'),
  (7,1,'Is it acceptable to walk beneath a raised forklift load?'),
  (7,2,'Why should pedestrians remain clear of loading and unloading operations?'),
  (8,1,'What should a worker do if a pedestrian barrier is damaged?'),
  (8,2,'Which behaviour increases risk around warehouse vehicles?')
) AS check_data(section_order, question_order, question_text)
  ON check_data.section_order = c.sequence_order
WHERE m.slug = 'forklift-pedestrian-safety' AND c.is_active
ON CONFLICT (training_content_id, sequence_order) DO UPDATE SET
  question_text = EXCLUDED.question_text, updated_at = clock_timestamp();

INSERT INTO formative_answer_options
  (formative_question_id, option_text, is_correct, sequence_order)
SELECT fq.id, option_data.option_text, option_data.is_correct, option_data.option_order
FROM formative_questions fq
JOIN training_content c ON c.id = fq.training_content_id
JOIN training_modules m ON m.id = c.training_module_id
JOIN (VALUES
  (1,1,1,'Operators, pedestrians and the organisation share responsibility',true),(1,1,2,'Only forklift operators',false),(1,1,3,'Only supervisors',false),
  (1,2,1,'Stay alert and follow the site traffic controls',true),(1,2,2,'Enter quickly before traffic builds up',false),(1,2,3,'Assume vehicles will always stop',false),
  (2,1,1,'The designated pedestrian route or marked walkway',true),(2,1,2,'The shortest route through the vehicle area',false),(2,1,3,'Any route when no vehicle is visible',false),
  (2,2,1,'Only when an authorised site procedure safely directs them',true),(2,2,2,'Whenever the walkway is busy',false),(2,2,3,'To take a shortcut through a vehicle zone',false),
  (3,1,1,'Forklifts have blind spots and the operator may not see them',true),(3,1,2,'Operators can always see directly behind the vehicle',false),(3,1,3,'High-visibility clothing guarantees they are seen',false),
  (3,2,1,'A carried load blocking the forward view',true),(3,2,2,'A clear pedestrian walkway',false),(3,2,3,'A stationary safety barrier',false),
  (4,1,1,'Forklifts need space to stop, turn and manoeuvre',true),(4,1,2,'It allows pedestrians to walk faster',false),(4,1,3,'It makes alarms louder',false),
  (4,2,1,'The rear and load may swing into a changing hazard area',true),(4,2,2,'The forklift always stays within its original footprint',false),(4,2,3,'Turning removes the operator''s blind spots',false),
  (5,1,1,'At the designated crossing',true),(5,1,2,'Between parked loads',false),(5,1,3,'At the nearest convenient point',false),
  (5,2,1,'Stop, look, listen and follow the site crossing procedure',true),(5,2,2,'Continue if no alarm can be heard',false),(5,2,3,'Follow the person ahead without checking',false),
  (6,1,1,'Wait safely and confirm the operator is aware before proceeding',true),(6,1,2,'Approach the forklift to attract attention',false),(6,1,3,'Rely on the reversing alarm',false),
  (6,2,1,'Alarms may not confirm that an operator has seen a pedestrian',true),(6,2,2,'Alarms remove the need to look for traffic',false),(6,2,3,'Alarms create a pedestrian right of way',false),
  (7,1,1,'No, remain clear of every raised load',true),(7,1,2,'Yes, when wearing a hard hat',false),(7,1,3,'Yes, if the operator is stationary',false),
  (7,2,1,'Loads and vehicle movements can create changing hazard zones',true),(7,2,2,'Pedestrians are expected to guide every load',false),(7,2,3,'Loading areas are always vehicle-free',false),
  (8,1,1,'Keep clear and report it through the workplace process',true),(8,1,2,'Move it aside and continue without reporting',false),(8,1,3,'Use the damaged area as a shortcut',false),
  (8,2,1,'Using a phone while walking through a vehicle area',true),(8,2,2,'Stopping at a designated crossing',false),(8,2,3,'Reporting poor visibility',false)
) AS option_data(section_order, question_order, option_order, option_text, is_correct)
  ON option_data.section_order = c.sequence_order
 AND option_data.question_order = fq.sequence_order
WHERE m.slug = 'forklift-pedestrian-safety' AND c.is_active
ON CONFLICT (formative_question_id, sequence_order) DO UPDATE SET
  option_text = EXCLUDED.option_text, is_correct = EXCLUDED.is_correct,
  updated_at = clock_timestamp();
