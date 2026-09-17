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