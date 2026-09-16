# Trainee dashboard

Phase 4 adds the authenticated trainee dashboard. It is a read-only view over existing users, training modules, training assignments and progress records. It does not add a dashboard table or alter certificate, assessment, session or authorization rules.

## API

`GET /api/trainee/dashboard` requires the existing session cookie and `trainee` system role. The server takes the trainee ID from the authenticated session; there is deliberately no user-ID route parameter.

The response contains:

- `trainee`: safe identity fields already returned by `/api/auth/me`, including job role.
- `summary`: active assignment count, completed/in-progress/not-started counts, and overall progress.
- `assignedTraining`: active assignments with module title/description, required flag, assignment and due dates, mapped status, percentage and `start`/`continue`/`review` action.

Password hashes, session hashes and raw session tokens are not selected or returned. Dashboard responses are marked `Cache-Control: no-store`.

## Progress rules

The repository joins each active assignment to its optional `progress` row. A missing row is `not_started` at `0%`. Completion is mapped when the row has a completion timestamp or reaches `100%`; otherwise a started row or positive percentage is `in_progress`. The service clamps percentages to `0..100` defensively.

Overall progress is the rounded arithmetic mean of progress percentages across active assigned modules. With no assignments it is `0`.

## Development data

`server/src/database/setup-auth-demo.ts` remains the single local auth-demo setup path. It ensures Alex Morgan has active required assignments for Manual Handling and Forklift and Pedestrian Safety, creates missing progress rows, and sets Manual Handling to an explicitly development-only `60%` in-progress state. The second module remains at `0%`.

## Frontend structure

`client/src/features/trainee/TraineeDashboard.tsx` fetches the API and renders loading, error, empty, summary, progress and assignment-card states. `trainee-dashboard.css` provides the Phase 3 color and typography system in the approved desktop composition: navy trainee sidebar, light workspace, summary cards, assigned training panels and support/progress column.

Training actions currently route to `/trainee/training/:assignmentId`, an explicit later-phase placeholder. The learning module, scenarios, assessments, certificates and administrator dashboard remain outside Phase 4.
