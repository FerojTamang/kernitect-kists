ALTER TABLE training_content
  ADD CONSTRAINT training_content_id_sequence_unique UNIQUE (id, sequence_order);

UPDATE training_content
SET sequence_order = sequence_order + 10
WHERE training_module_id = (SELECT id FROM training_modules WHERE slug = 'manual-handling');

UPDATE training_content
SET sequence_order = CASE sequence_order
  WHEN 11 THEN 1
  WHEN 12 THEN 2
  WHEN 13 THEN 4
  WHEN 14 THEN 5
  ELSE sequence_order
END
WHERE training_module_id = (SELECT id FROM training_modules WHERE slug = 'manual-handling');

INSERT INTO training_content
  (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT id, 'Assessing the Task and Load', 'text',
  'Before moving a load, assess what needs to be moved, including its size, shape, stability and weight. Plan a clear route, identify obstacles and consider the destination. Decide whether you need assistance or suitable handling equipment, and consider your own capability before starting.', 3, true
FROM training_modules
WHERE slug = 'manual-handling'
  AND NOT EXISTS (
    SELECT 1 FROM training_content c
    WHERE c.training_module_id = training_modules.id AND c.sequence_order = 3
  );

CREATE TABLE formative_questions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_content_id integer NOT NULL,
  question_text text NOT NULL CHECK (btrim(question_text) <> ''),
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (training_content_id, sequence_order)
    REFERENCES training_content(id, sequence_order) ON DELETE CASCADE,
  UNIQUE (training_content_id, sequence_order),
  UNIQUE (id, training_content_id)
);

CREATE TABLE formative_answer_options (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formative_question_id integer NOT NULL,
  option_text text NOT NULL CHECK (btrim(option_text) <> ''),
  is_correct boolean NOT NULL DEFAULT false,
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (formative_question_id) REFERENCES formative_questions(id) ON DELETE CASCADE,
  UNIQUE (formative_question_id, sequence_order),
  UNIQUE (id, formative_question_id)
);

CREATE TABLE formative_responses (
  trainee_id integer NOT NULL,
  training_assignment_id integer NOT NULL,
  training_module_id integer NOT NULL,
  training_content_id integer NOT NULL,
  formative_question_id integer NOT NULL,
  selected_option_id integer NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (training_assignment_id, formative_question_id),
  FOREIGN KEY (training_assignment_id, trainee_id, training_module_id)
    REFERENCES training_assignments(id, trainee_id, training_module_id) ON DELETE CASCADE,
  FOREIGN KEY (formative_question_id, training_content_id)
    REFERENCES formative_questions(id, training_content_id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id, formative_question_id)
    REFERENCES formative_answer_options(id, formative_question_id) ON DELETE RESTRICT
);
CREATE INDEX formative_responses_trainee_idx
  ON formative_responses(trainee_id, training_assignment_id, training_content_id);
