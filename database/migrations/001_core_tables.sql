-- Integer identity keys keep joins and node-postgres IDs straightforward.
-- All objects live in the runner's dedicated kists schema.
CREATE TABLE system_roles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('trainee', 'administrator')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_roles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  system_role_id integer NOT NULL REFERENCES system_roles(id) ON DELETE RESTRICT,
  job_role_id integer REFERENCES job_roles(id) ON DELETE RESTRICT,
  first_name text NOT NULL CHECK (btrim(first_name) <> ''),
  last_name text NOT NULL CHECK (btrim(last_name) <> ''),
  email text NOT NULL CHECK (email = btrim(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  password_hash text NOT NULL CHECK (length(password_hash) >= 20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_system_role_idx ON users(system_role_id);
CREATE INDEX users_job_role_idx ON users(job_role_id);

CREATE TABLE training_modules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (btrim(title) <> ''),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE training_assignments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  training_module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE RESTRICT,
  assigned_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  required boolean NOT NULL DEFAULT true,
  -- Lifecycle only. Learning completion belongs to progress, not a duplicate status.
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, training_module_id),
  UNIQUE (id, trainee_id, training_module_id),
  CHECK (due_at IS NULL OR due_at >= assigned_at)
);
CREATE INDEX training_assignments_module_idx ON training_assignments(training_module_id);
CREATE INDEX training_assignments_assigner_idx ON training_assignments(assigned_by);
CREATE INDEX training_assignments_due_idx ON training_assignments(due_at) WHERE status = 'active';

CREATE TABLE training_content (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  content_type text NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'document', 'link')),
  body text,
  resource_reference text,
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_module_id, sequence_order),
  CHECK (nullif(btrim(body), '') IS NOT NULL OR nullif(btrim(resource_reference), '') IS NOT NULL)
);

CREATE TABLE scenarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  resource_reference text,
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_module_id, sequence_order),
  CHECK (NOT is_active OR nullif(btrim(resource_reference), '') IS NOT NULL)
);

CREATE TABLE hazards (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scenario_id integer NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  feedback text NOT NULL,
  hotspot_yaw numeric(7,3) NOT NULL CHECK (hotspot_yaw BETWEEN -180 AND 180),
  hotspot_pitch numeric(6,3) NOT NULL CHECK (hotspot_pitch BETWEEN -90 AND 90),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, sequence_order)
);

CREATE TABLE assessments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  pass_percentage numeric(5,2) NOT NULL CHECK (pass_percentage > 0 AND pass_percentage <= 100),
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_module_id, sequence_order),
  UNIQUE (id, training_module_id)
);

CREATE TABLE questions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id integer NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text text NOT NULL CHECK (btrim(question_text) <> ''),
  question_type text NOT NULL CHECK (question_type IN ('single_choice', 'true_false', 'free_text')),
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, sequence_order),
  UNIQUE (id, assessment_id)
);

CREATE TABLE answer_options (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id integer NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text text NOT NULL CHECK (btrim(option_text) <> ''),
  is_correct boolean NOT NULL DEFAULT false,
  sequence_order integer NOT NULL CHECK (sequence_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, sequence_order),
  UNIQUE (id, question_id)
);

CREATE TABLE assessment_attempts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL,
  training_assignment_id integer NOT NULL,
  training_module_id integer NOT NULL,
  assessment_id integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score_percentage numeric(5,2) CHECK (score_percentage BETWEEN 0 AND 100),
  -- Snapshot: changing an assessment threshold must not rewrite past results.
  pass_percentage_snapshot numeric(5,2) NOT NULL CHECK (pass_percentage_snapshot > 0 AND pass_percentage_snapshot <= 100),
  passed boolean GENERATED ALWAYS AS (score_percentage >= pass_percentage_snapshot) STORED,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  FOREIGN KEY (training_assignment_id, trainee_id, training_module_id)
    REFERENCES training_assignments(id, trainee_id, training_module_id) ON DELETE RESTRICT,
  FOREIGN KEY (assessment_id, training_module_id)
    REFERENCES assessments(id, training_module_id) ON DELETE RESTRICT,
  UNIQUE (trainee_id, assessment_id, attempt_number),
  UNIQUE (id, assessment_id),
  UNIQUE (id, training_assignment_id, assessment_id),
  CHECK ((submitted_at IS NULL AND score_percentage IS NULL) OR
    (submitted_at IS NOT NULL AND score_percentage IS NOT NULL AND submitted_at >= started_at))
);
CREATE INDEX assessment_attempts_assignment_idx ON assessment_attempts(training_assignment_id);
CREATE INDEX assessment_attempts_assessment_idx ON assessment_attempts(assessment_id, training_module_id);

CREATE TABLE assessment_responses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_attempt_id integer NOT NULL,
  assessment_id integer NOT NULL,
  question_id integer NOT NULL,
  selected_answer_option_id integer,
  response_text text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_attempt_id, assessment_id)
    REFERENCES assessment_attempts(id, assessment_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, assessment_id)
    REFERENCES questions(id, assessment_id) ON DELETE RESTRICT,
  FOREIGN KEY (selected_answer_option_id, question_id)
    REFERENCES answer_options(id, question_id) ON DELETE RESTRICT,
  UNIQUE (assessment_attempt_id, question_id),
  CHECK (num_nonnulls(selected_answer_option_id, response_text) <= 1)
);
CREATE INDEX assessment_responses_question_idx ON assessment_responses(question_id, assessment_id);
CREATE INDEX assessment_responses_option_idx ON assessment_responses(selected_answer_option_id, question_id);

CREATE TABLE progress (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL,
  training_module_id integer NOT NULL,
  training_assignment_id integer NOT NULL UNIQUE,
  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (training_assignment_id, trainee_id, training_module_id)
    REFERENCES training_assignments(id, trainee_id, training_module_id) ON DELETE RESTRICT,
  UNIQUE (trainee_id, training_module_id),
  CHECK ((percentage = 100) = (completed_at IS NOT NULL)),
  CHECK (percentage = 0 OR started_at IS NOT NULL),
  CHECK (completed_at IS NULL OR (started_at IS NOT NULL AND completed_at >= started_at)),
  CHECK (last_accessed_at IS NULL OR (started_at IS NOT NULL AND last_accessed_at >= started_at))
);
CREATE INDEX progress_module_idx ON progress(training_module_id);

CREATE TABLE certificates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  certificate_number text NOT NULL UNIQUE CHECK (btrim(certificate_number) <> ''),
  issued_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
  revoked_at timestamptz,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);
CREATE UNIQUE INDEX certificates_one_current_idx ON certificates(trainee_id) WHERE status = 'issued';
CREATE INDEX certificates_trainee_idx ON certificates(trainee_id);

-- Immutable issuance evidence. One certificate covers a SET of assignments.
CREATE TABLE certificate_assignments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificate_id integer NOT NULL REFERENCES certificates(id) ON DELETE RESTRICT,
  training_assignment_id integer NOT NULL REFERENCES training_assignments(id) ON DELETE RESTRICT,
  completed_at_snapshot timestamptz NOT NULL,
  UNIQUE (certificate_id, training_assignment_id)
);
CREATE INDEX certificate_assignments_assignment_idx ON certificate_assignments(training_assignment_id);

CREATE TABLE certificate_assessment_attempts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificate_id integer NOT NULL,
  training_assignment_id integer NOT NULL,
  assessment_id integer NOT NULL,
  assessment_attempt_id integer NOT NULL,
  FOREIGN KEY (certificate_id, training_assignment_id)
    REFERENCES certificate_assignments(certificate_id, training_assignment_id) ON DELETE RESTRICT,
  FOREIGN KEY (assessment_attempt_id, training_assignment_id, assessment_id)
    REFERENCES assessment_attempts(id, training_assignment_id, assessment_id) ON DELETE RESTRICT,
  UNIQUE (certificate_id, training_assignment_id, assessment_id)
);
CREATE INDEX certificate_attempts_attempt_idx ON certificate_assessment_attempts(assessment_attempt_id, training_assignment_id, assessment_id);
