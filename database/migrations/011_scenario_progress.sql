-- Scenario progress is intentionally separate from learning-content completion
-- and graded assessment attempts. A scenario attempt belongs to one trainee's
-- assignment and records the latest response to each required hazard/objective.

ALTER TABLE scenarios
  ADD CONSTRAINT scenarios_id_module_unique UNIQUE (id, training_module_id);

ALTER TABLE hazards
  ADD CONSTRAINT hazards_id_scenario_unique UNIQUE (id, scenario_id);

CREATE TABLE scenario_attempts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL,
  training_assignment_id integer NOT NULL,
  training_module_id integer NOT NULL,
  scenario_id integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (training_assignment_id, trainee_id, training_module_id)
    REFERENCES training_assignments(id, trainee_id, training_module_id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id, training_module_id)
    REFERENCES scenarios(id, training_module_id) ON DELETE RESTRICT,
  UNIQUE (training_assignment_id, scenario_id),
  UNIQUE (id, scenario_id),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX scenario_attempts_trainee_idx
  ON scenario_attempts(trainee_id, training_assignment_id);
CREATE INDEX scenario_attempts_scenario_idx
  ON scenario_attempts(scenario_id, training_module_id);

CREATE TABLE scenario_hazard_responses (
  scenario_attempt_id integer NOT NULL,
  scenario_id integer NOT NULL,
  hazard_id integer NOT NULL,
  selected_decision_key text NOT NULL CHECK (btrim(selected_decision_key) <> ''),
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_attempt_id, hazard_id),
  FOREIGN KEY (scenario_attempt_id, scenario_id)
    REFERENCES scenario_attempts(id, scenario_id) ON DELETE CASCADE,
  FOREIGN KEY (hazard_id, scenario_id)
    REFERENCES hazards(id, scenario_id) ON DELETE RESTRICT
);
CREATE INDEX scenario_hazard_responses_scenario_idx
  ON scenario_hazard_responses(scenario_id, hazard_id);
