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
