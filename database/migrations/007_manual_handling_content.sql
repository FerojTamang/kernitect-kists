UPDATE training_content c
SET title = source.title,
    body = source.body,
    is_active = true,
    updated_at = clock_timestamp()
FROM training_modules m
CROSS JOIN (VALUES
  (1, 'Introduction', 'Manual handling is the movement of objects by hand, including lifting, lowering, pushing, pulling, carrying and holding. It matters because poor technique can cause injury in warehouses, distribution centres and delivery work. Everyday examples include moving cartons, loading pallets and placing stock on shelving.'),
  (2, 'Risks and Injuries', 'Poor manual handling can cause back pain, muscle strain, joint injury and longer-term musculoskeletal disorders. Warning: do not rush a lift or work around a load that is too heavy, unstable or difficult to reach. Stop, make the area safe and use the correct technique or equipment.'),
  (3, 'Safe Lifting Techniques', 'Use these steps: plan the lift; assess the load and route; set stable footing; bend your knees; secure a firm grip; keep the load close; lift smoothly; avoid twisting; and ask for assistance or use equipment when the load or route requires it.'),
  (4, 'Practical Examples', 'Safe example: bend your knees, keep your back steady and hold the carton close as you move. Unsafe example: bending from the waist, twisting while lifting or carrying a load that blocks your view. Choose the safe approach and ask for help when needed.')
) AS source(sequence_order, title, body)
WHERE m.slug = 'manual-handling'
  AND c.training_module_id = m.id
  AND c.sequence_order = source.sequence_order;

INSERT INTO training_content (training_module_id, title, content_type, body, sequence_order, is_active)
SELECT m.id, source.title, 'text', source.body, source.sequence_order, true
FROM training_modules m
CROSS JOIN (VALUES
  (1, 'Introduction', 'Manual handling is the movement of objects by hand, including lifting, lowering, pushing, pulling, carrying and holding. It matters because poor technique can cause injury in warehouses, distribution centres and delivery work. Everyday examples include moving cartons, loading pallets and placing stock on shelving.'),
  (2, 'Risks and Injuries', 'Poor manual handling can cause back pain, muscle strain, joint injury and longer-term musculoskeletal disorders. Warning: do not rush a lift or work around a load that is too heavy, unstable or difficult to reach. Stop, make the area safe and use the correct technique or equipment.'),
  (3, 'Safe Lifting Techniques', 'Use these steps: plan the lift; assess the load and route; set stable footing; bend your knees; secure a firm grip; keep the load close; lift smoothly; avoid twisting; and ask for assistance or use equipment when the load or route requires it.'),
  (4, 'Practical Examples', 'Safe example: bend your knees, keep your back steady and hold the carton close as you move. Unsafe example: bending from the waist, twisting while lifting or carrying a load that blocks your view. Choose the safe approach and ask for help when needed.')
) AS source(sequence_order, title, body)
WHERE m.slug = 'manual-handling'
  AND NOT EXISTS (
    SELECT 1 FROM training_content c
    WHERE c.training_module_id = m.id AND c.sequence_order = source.sequence_order
  );
