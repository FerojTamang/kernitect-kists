-- Forklift learning content is still a development placeholder, so the
-- module must remain unavailable until an administrator publishes it.
UPDATE training_modules
SET is_active = false,
    updated_at = clock_timestamp()
WHERE slug = 'forklift-pedestrian-safety';
