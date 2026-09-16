# Manual Handling Interactive Scenario — Phase 6A

## Scope

Phase 6A adds the database and protected API foundation for the Manual Handling interactive warehouse scenario. It intentionally stops before the React panoramic/360 viewer. Learning, formative checks, graded assessment and certification remain separate concerns.

The scenario is unlocked only after all active Manual Handling learning sections have completion records for the authenticated trainee's assignment.

## Prototype scenario

The repeatable development seed activates one Manual Handling scenario:

- **Warehouse Manual Handling Scenario**
- resource reference: `prototype://manual-handling-warehouse`
- five required safety points/hazards

The five safety points cover:

1. Obstructed handling route.
2. Unstable stacked load.
3. Awkward lifting posture.
4. A bulky load suited to handling equipment.
5. A load that requires assistance or another safer handling method.

Each hazard keeps its yaw/pitch coordinates in `hazards` and stores a concise decision prompt, decision options and the development answer key inside the existing `metadata` JSON object. The API never exposes `correctDecisionKey`.

The placeholder resource reference is not a claim that a real 360 panorama already exists. Phase 6B will attach the visual viewer/asset while keeping this API contract.

## Persistence

Migration `011_scenario_progress.sql` adds:

- `scenario_attempts` — one persisted scenario attempt per assignment/scenario, including start and completion timestamps.
- `scenario_hazard_responses` — the latest decision for each hazard/objective in an attempt.

Composite foreign keys prevent an attempt from using a scenario from another assigned module and prevent a response from using a hazard from another scenario.

A correct hazard/objective is monotonic: once correctly completed, a later retry cannot regress it. The scenario completes only when every hazard has a correct persisted response.

Scenario completion does **not** set aggregate assignment progress to 100%, does not create an assessment attempt and does not create a certificate.

## API

All endpoints require an authenticated user with system role `trainee` and validate assignment ownership server-side.

### `GET /api/trainee/training/:assignmentId/scenario`

Returns the active scenario, safe decision options, hotspot coordinates, persisted hazard state and scenario progress.

Important responses:

- `401` — not signed in.
- `403` — wrong system role.
- `404` — assignment/scenario is not available to that trainee.
- `409 SCENARIO_LOCKED` — learning sections are not all complete.

### `POST /api/trainee/training/:assignmentId/scenario/hazards/:hazardId/respond`

JSON body:

```json
{ "decisionKey": "clear-route" }
```

The mutation requires the same trusted-origin/custom-header protection used for KISTS authenticated mutations. It validates that the hazard belongs to the assignment's scenario and that the decision key is one of the configured options.

The response returns correctness, feedback and the refreshed scenario progress. Wrong answers remain retryable; correct answers persist.

## Demo reset

`npm.cmd run auth:demo` now also clears Alex Morgan's Manual Handling `scenario_attempts`. Cascading foreign keys clear the related scenario hazard responses. This keeps repeated demonstrations predictable without a destructive database reset.

## Next step — Phase 6B

Phase 6B should build the trainee React route `/trainee/training/:assignmentId/scenario`, connect it to these endpoints and render the five decision points inside a panoramic/interactive warehouse viewer. The visual layer must not move scenario state into `localStorage`; PostgreSQL remains authoritative.

## Phase 6B prototype viewer

The trainee-facing route is `/trainee/training/:assignmentId/scenario`.

The current development fixture uses `prototype://manual-handling-warehouse`, so the client renders a photo-based panoramic prototype assembled from KISTS warehouse imagery rather than claiming that a true equirectangular 360 asset has been supplied. The viewer is horizontally pannable by drag or explicit Look left/Look right controls and positions the five interactive safety points from the stored `hotspot_yaw` and `hotspot_pitch` values.

Each safety point opens a decision panel. Selecting a radio option does not submit it; the trainee explicitly chooses **Check decision**. Incorrect choices stay on the same safety point and can be retried. Correct choices persist through the Phase 6A API and visibly change the hotspot to a completed state. Refreshing or signing in again restores the authoritative PostgreSQL-backed scenario progress.

Completing all five scenario objectives produces **Interactive scenario complete**. This does not complete the Manual Handling assignment and does not create an assessment or certificate. The final graded assessment remains the next prototype phase.

The photo-based viewer is intentionally structured as a replaceable prototype scene. A client-approved equirectangular warehouse panorama can replace the visual layer later while retaining the existing scenario/hotspot API, yaw/pitch coordinates, decision model and persistence rules. VR remains future work.

## Phase 6C — genuine 360° viewer

The Manual Handling scenario now uses a genuine equirectangular 360° warehouse panorama in the browser instead of the earlier horizontally-scrolling photo prototype. The client-side viewer is implemented with Photo Sphere Viewer and the Markers plugin. Existing database `hotspot_yaw` and `hotspot_pitch` values are used as spherical marker coordinates.

Local panorama asset expected by the client:

`client/src/assets/scenarios/manual-handling/manual-handling-warehouse.jpg`

Development source: Poly Haven, **Empty Warehouse 01**, CC0. Keep the downloaded HDR source separately if required, but the web viewer uses the tonemapped JPG for practical browser performance.

The five Manual Handling safety decisions, response persistence, retry behaviour, learning gate and scenario completion rules remain unchanged. Phase 6C changes the presentation layer, not the scenario completion policy.
