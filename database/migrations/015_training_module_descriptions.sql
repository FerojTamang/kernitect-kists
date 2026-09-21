UPDATE training_modules
SET description = CASE slug
  WHEN 'manual-handling' THEN
    'Develop safe lifting, carrying and load-handling techniques to reduce injury risk in warehouse environments.'
  WHEN 'forklift-pedestrian-safety' THEN
    'Covers safe pedestrian movement around forklift operations, including blind spots, safe distances, crossing points and warehouse traffic awareness.'
  ELSE description
END,
updated_at = clock_timestamp()
WHERE slug IN ('manual-handling', 'forklift-pedestrian-safety');
