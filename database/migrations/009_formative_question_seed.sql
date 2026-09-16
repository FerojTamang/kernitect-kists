-- Formative definitions are applied by the repeatable development seed after
-- migrations have created the schema.
/* INSERT INTO formative_questions (training_content_id, question_text, sequence_order)
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
  ('Introduction', 1, 'Only lifting boxes', false, 1),
  ('Introduction', 1, 'Lifting, pushing, pulling and carrying objects', true, 2),
  ('Introduction', 1, 'Only driving a forklift', false, 3),
  ('Introduction', 1, 'Only office-based work', false, 4),
  ('Introduction', 2, 'It removes every workplace hazard', false, 1),
  ('Introduction', 2, 'It helps reduce avoidable injury', true, 2),
  ('Introduction', 2, 'It makes loads lighter', false, 3),
  ('Introduction', 2, 'It removes the need for training', false, 4),
  ('Risks and Injuries', 1, 'Back pain', true, 1),
  ('Risks and Injuries', 1, 'Sunburn only', false, 2),
  ('Risks and Injuries', 1, 'Hearing improvement', false, 3),
  ('Risks and Injuries', 1, 'Improved eyesight', false, 4),
  ('Risks and Injuries', 2, 'Planning the route', false, 1),
  ('Risks and Injuries', 2, 'Twisting while carrying a heavy load', true, 2),
  ('Risks and Injuries', 2, 'Using suitable equipment', false, 3),
  ('Risks and Injuries', 2, 'Asking for assistance', false, 4),
  ('Assessing the Task and Load', 1, 'Only the colour of the load', false, 1),
  ('Assessing the Task and Load', 1, 'Size, shape, stability, weight and route', true, 2),
  ('Assessing the Task and Load', 1, 'The time of day only', false, 3),
  ('Assessing the Task and Load', 1, 'Whether the load has a label', false, 4),
  ('Assessing the Task and Load', 2, 'When the load or route exceeds safe capability', true, 1),
  ('Assessing the Task and Load', 2, 'Only after an injury occurs', false, 2),
  ('Assessing the Task and Load', 2, 'Never; equipment is not useful', false, 3),
  ('Assessing the Task and Load', 2, 'Only when a colleague asks', false, 4),
  ('Safe Lifting Techniques', 1, 'Lift immediately without checking', false, 1),
  ('Safe Lifting Techniques', 1, 'Plan the lift and assess the route', true, 2),
  ('Safe Lifting Techniques', 1, 'Twist to reach the load', false, 3),
  ('Safe Lifting Techniques', 1, 'Block the route first', false, 4),
  ('Safe Lifting Techniques', 2, 'Keep it close and avoid twisting', true, 1),
  ('Safe Lifting Techniques', 2, 'Hold it away from your body', false, 2),
  ('Safe Lifting Techniques', 2, 'Carry it above shoulder height', false, 3),
  ('Safe Lifting Techniques', 2, 'Move as quickly as possible', false, 4),
  ('Practical Examples', 1, 'Bend your knees and keep the load close', true, 1),
  ('Practical Examples', 1, 'Bend from the waist and twist', false, 2),
  ('Practical Examples', 1, 'Carry a load that blocks your view', false, 3),
  ('Practical Examples', 1, 'Rush because the route is busy', false, 4),
  ('Practical Examples', 2, 'Continue and hope the route is clear', false, 1),
  ('Practical Examples', 2, 'Stop, make the route safe and get help if needed', true, 2),
  ('Practical Examples', 2, 'Turn sideways and run', false, 3),
  ('Practical Examples', 2, 'Lift it higher to see underneath', false, 4)
) AS option(section_title, question_order, option_text, is_correct, option_order)
  ON option.section_title = c.title AND option.question_order = q.sequence_order
WHERE m.slug = 'manual-handling'
ON CONFLICT (formative_question_id, sequence_order) DO NOTHING;
*/
