CREATE TABLE support_messages (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainee_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issue_type text NOT NULL CHECK (issue_type IN (
    'training_access',
    'assessment_issue',
    'progress_issue',
    'certificate_issue',
    'account_login_issue',
    'technical_issue',
    'other'
  )),
  message text NOT NULL CHECK (
    message = btrim(message)
    AND length(message) BETWEEN 1 AND 1000
  ),
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'closed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_trainee_idx
  ON support_messages (trainee_id, created_at DESC);
CREATE INDEX support_messages_status_idx
  ON support_messages (status, created_at DESC);
