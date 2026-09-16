# Manual Handling Learning Module

## Phase 5 scope

Phase 5 implements the database-backed Manual Handling learning journey for authenticated trainees. It covers the module overview, four learning sections, persistent section completion and resume behavior. It does not implement the interactive warehouse scenario, assessment, certificate or administrator content-management workflows.

Learning-content completion is **not final module completion**. Completing all four learning sections produces 100% learning progress, while the full Manual Handling assignment remains in progress because the later scenario and assessment stages are not complete.

## Frontend routes

- `/trainee/training/:assignmentId` - Manual Handling overview, section list, learning content and final learning-content state.
- `/trainee/dashboard` - Existing dashboard entry point. Continue Learning opens the assigned Manual Handling route.

The route uses the existing protected trainee layout. My Training is active while the route is open.

## API endpoints

- `GET /api/trainee/training/:assignmentId` returns the assigned Manual Handling module, ordered active sections, persisted completion timestamps, learning progress and the first incomplete section index.
- `POST /api/trainee/training/:assignmentId/content/:contentId/complete` completes one section. It requires an authenticated trainee, verifies assignment ownership and verifies that the content belongs to the assigned Manual Handling module. Repeated requests are idempotent.

Malformed assignment or content IDs return `400`. An unknown, unassigned or non-Manual-Handling assignment/content returns `404`. Administrator and unauthenticated requests are rejected by the existing trainee middleware.

## Database persistence model

Migration `006_training_content_completion.sql` adds `training_content_completion`. Each row stores the trainee, assignment, module, content section and completion timestamp. Composite foreign keys keep the completion tied to the same trainee, assignment and module, while a primary key on `(training_assignment_id, training_content_id)` makes completion idempotent.

Migration `007_manual_handling_content.sql` normalizes existing development content to the four Phase 5 sections. The repeatable development seed contains the same four active rows.

The existing `progress` table remains the aggregate assignment record. Phase 5 only touches its access/start timestamps when the module is opened; section completion does not set aggregate percentage to 100 and does not create a certificate or assessment attempt.

## Learning sections

1. **Introduction** - what manual handling is, why it matters, and warehouse/logistics examples.
2. **Risks and Injuries** - back pain, muscle strain, joint injury and musculoskeletal injury, with a warning panel.
3. **Safe Lifting Techniques** - planning, assessing the load and route, stable footing, knees, grip, keeping the load close, smooth lifting, avoiding twisting and getting help or equipment.
4. **Practical Examples** - clear safe and unsafe handling examples.

## Completion and resume logic

The API derives completion from `training_content_completion`, not React state, local storage or session storage. The first incomplete ordered section is the resume target. With no completed rows, the module opens at Introduction. With partial completion, it opens at the first incomplete section. When all four rows exist, learning progress is 100% and the UI shows **Learning content complete** with the next stage locked as **Interactive warehouse safety scenario**.

Learning progress is calculated as:

`completed active sections / total active sections * 100`

For the four-section Manual Handling content, each completed section contributes 25 percentage points. This is learning progress only; it is not an arbitrary weighting of the eventual scenario or assessment.

## Limitations and next stage

The interactive warehouse safety scenario is shown as an upcoming locked stage. No 360-degree viewer, hazard interaction, knowledge check, assessment scoring, certificate issuance or pass/fail state is implemented in Phase 5.
