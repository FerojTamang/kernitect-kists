-- Provide the module before 016 populates its learning and assessment content.
-- Existing installations already have this row; preserve their current data.
INSERT INTO training_modules (title, slug, description, is_active)
VALUES (
  'Forklift and Pedestrian Safety',
  'forklift-pedestrian-safety',
  'Covers safe pedestrian movement around forklift operations, including blind spots, safe distances, crossing points and warehouse traffic awareness.',
  false
)
ON CONFLICT (slug) DO NOTHING;
