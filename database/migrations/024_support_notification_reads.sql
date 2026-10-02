-- Existing requests and responses predate notifications, so start them as read.
ALTER TABLE support_messages
  ADD COLUMN admin_seen_at timestamptz,
  ADD COLUMN trainee_response_seen_at timestamptz;

UPDATE support_messages
SET admin_seen_at = created_at,
    trainee_response_seen_at = responded_at;

CREATE INDEX support_messages_admin_unread_idx
  ON support_messages (created_at DESC, id DESC)
  WHERE admin_seen_at IS NULL;

CREATE INDEX support_messages_trainee_response_unread_idx
  ON support_messages (trainee_id, responded_at DESC, id DESC)
  WHERE responded_at IS NOT NULL AND trainee_response_seen_at IS NULL;
