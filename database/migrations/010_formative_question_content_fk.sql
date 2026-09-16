ALTER TABLE formative_questions
  DROP CONSTRAINT formative_questions_training_content_id_sequence_order_fkey;

ALTER TABLE formative_questions
  ADD CONSTRAINT formative_questions_training_content_id_fkey
  FOREIGN KEY (training_content_id) REFERENCES training_content(id) ON DELETE CASCADE;
