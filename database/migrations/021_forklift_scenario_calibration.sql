-- Forklift scenario calibration fixture. The five 0/0 hotspot coordinates are
-- placeholders only; replace them with measured yaw/pitch before trainee use.
-- Module lookup uses its stable slug, never a local database ID.
-- Keep this scenario inactive while calibrating so it does not alter existing
-- training, assessment or certificate requirements.
INSERT INTO scenarios (
  training_module_id, title, description, resource_reference, sequence_order, is_active
)
SELECT m.id,
  'Forklift and Pedestrian Safety — Warehouse Traffic Scenario',
  'Explore forklift and pedestrian interactions in a 360-degree warehouse scene.',
  'asset://scenarios/forklift-pedestrian/forklift-pedestrian-training-360.png',
  1, false
FROM training_modules m
WHERE m.slug = 'forklift-pedestrian-safety'
ON CONFLICT (training_module_id, sequence_order) DO NOTHING;

INSERT INTO hazards (
  scenario_id, title, description, feedback,
  hotspot_yaw, hotspot_pitch, metadata, sequence_order
)
SELECT s.id, hazard.title, hazard.description, hazard.feedback,
  0.000, 0.000, hazard.metadata::jsonb, hazard.sequence_order
FROM scenarios s
JOIN training_modules m ON m.id = s.training_module_id
CROSS JOIN (VALUES
  (1, 'Distracted Pedestrian',
    'A pedestrian is using a mobile phone near forklift activity.',
    'Put the phone away, stay alert and use the designated pedestrian route.',
    '{"decisionPrompt":"What should the pedestrian do?","decisionOptions":[{"key":"stay-alert","label":"Put the phone away and use the designated pedestrian route"},{"key":"keep-using-phone","label":"Continue walking while using the phone"}],"correctDecisionKey":"stay-alert"}'),
  (2, 'Poor Separation / Forklift Operating Lane',
    'Pedestrian and forklift activity are not adequately separated near the operating lane.',
    'Keep clear of the vehicle operating lane and use the designated pedestrian route.',
    '{"decisionPrompt":"Where should the pedestrian move?","decisionOptions":[{"key":"use-walkway","label":"Use the designated pedestrian walkway"},{"key":"enter-lane","label":"Take a shortcut through the forklift lane"}],"correctDecisionKey":"use-walkway"}'),
  (3, 'Unsafe Crossing / Intersection',
    'A pedestrian approaches a marked crossing while forklift traffic is present.',
    'Stop, look and listen, then use the designated crossing only when it is safe.',
    '{"decisionPrompt":"What should happen before crossing?","decisionOptions":[{"key":"check-crossing","label":"Stop, look and listen before using the crossing"},{"key":"cross-quickly","label":"Step into the vehicle route without checking"}],"correctDecisionKey":"check-crossing"}'),
  (4, 'Raised Load / Operating Area',
    'A pedestrian is close to a forklift handling a raised pallet.',
    'Stay clear of the raised load and active loading area.',
    '{"decisionPrompt":"What is the safer response?","decisionOptions":[{"key":"keep-clear","label":"Remain clear of the raised load and operating area"},{"key":"walk-under","label":"Walk beneath the raised pallet"}],"correctDecisionKey":"keep-clear"}'),
  (5, 'Forklift Blind Spot / Restricted Visibility',
    'A pedestrian is near a forklift and racking where the operator may have restricted visibility.',
    'Remain in a safe place until you have confirmed the operator is aware of you.',
    '{"decisionPrompt":"What should the pedestrian do?","decisionOptions":[{"key":"confirm-awareness","label":"Stay safe and confirm operator awareness before approaching"},{"key":"assume-seen","label":"Assume the operator has seen them and continue"}],"correctDecisionKey":"confirm-awareness"}')
) AS hazard(sequence_order, title, description, feedback, metadata)
WHERE m.slug = 'forklift-pedestrian-safety'
  AND s.sequence_order = 1
  AND s.resource_reference =
    'asset://scenarios/forklift-pedestrian/forklift-pedestrian-training-360.png'
ON CONFLICT (scenario_id, sequence_order) DO NOTHING;
