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
