-- Finalize the measured hotspots in databases where migration 021 already ran.
-- Keep existing hazard IDs, responses, and scenario attempts intact.
DO $$
DECLARE
  target_scenario_id integer;
BEGIN
  SELECT s.id INTO target_scenario_id
  FROM scenarios s
  JOIN training_modules m ON m.id = s.training_module_id
  WHERE m.slug = 'forklift-pedestrian-safety'
    AND s.resource_reference =
      'asset://scenarios/forklift-pedestrian/forklift-pedestrian-training-360.png';

  IF target_scenario_id IS NULL OR
    (SELECT count(*) FROM hazards WHERE scenario_id = target_scenario_id) <> 5 OR
    (SELECT count(DISTINCT sequence_order) FROM hazards
      WHERE scenario_id = target_scenario_id AND sequence_order BETWEEN 1 AND 5) <> 5
  THEN
    RAISE EXCEPTION 'Forklift scenario must have exactly five ordered safety points before activation';
  END IF;

  UPDATE hazards
  SET hotspot_yaw = positions.yaw,
    hotspot_pitch = positions.pitch
  FROM (VALUES
    (1, -118.760, -0.990),
    (2, -69.960, -5.660),
    (3, 38.890, -16.480),
    (4, 98.360, 16.780),
    (5, 120.820, 4.130)
  ) AS positions(sequence_order, yaw, pitch)
  WHERE hazards.scenario_id = target_scenario_id
    AND hazards.sequence_order = positions.sequence_order;

  UPDATE scenarios
  SET is_active = true
  WHERE id = target_scenario_id;
END $$;
