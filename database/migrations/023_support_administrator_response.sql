ALTER TABLE support_messages
  ADD COLUMN admin_response text CHECK (
    admin_response = btrim(admin_response)
    AND length(admin_response) BETWEEN 1 AND 4000
  ),
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN responded_by integer REFERENCES users(id) ON DELETE SET NULL;
