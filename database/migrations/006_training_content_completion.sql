ALTER TABLE training_content
  ADD CONSTRAINT training_content_id_module_unique UNIQUE (id, training_module_id);

CREATE TABLE training_content_completion (
  trainee_id integer NOT NULL,
  training_assignment_id integer NOT NULL,
  training_module_id integer NOT NULL,
  training_content_id integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (training_assignment_id, training_content_id),
  FOREIGN KEY (training_assignment_id, trainee_id, training_module_id)
    REFERENCES training_assignments(id, trainee_id, training_module_id) ON DELETE CASCADE,
  FOREIGN KEY (training_content_id, training_module_id)
    REFERENCES training_content(id, training_module_id) ON DELETE CASCADE
);
CREATE INDEX training_content_completion_trainee_idx
  ON training_content_completion(trainee_id, training_assignment_id);
