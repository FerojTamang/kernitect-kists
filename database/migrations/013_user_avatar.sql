ALTER TABLE users ADD COLUMN avatar_filename text;
ALTER TABLE users ADD CONSTRAINT users_avatar_filename_safe
  CHECK (avatar_filename IS NULL OR avatar_filename ~ '^[a-f0-9]{32}\.(jpg|png|webp)$');
