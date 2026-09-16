# KISTS Phase 6B Final Scenario Polish

Apply this pack on top of the current `phase6-scenario` branch after the Phase 6B route hotfix.

Changes:

- replaces the plain schematic warehouse background with a photo-based panoramic prototype using existing KISTS warehouse imagery;
- keeps the five DB-driven yaw/pitch hotspots and persisted decision flow unchanged;
- keeps visible hazard props aligned with the five safety objectives;
- adds clearer hotspot pulse/completed states;
- makes the Scenarios sidebar item active while viewing `/trainee/training/:assignmentId/scenario`;
- strengthens the 5/5 completion screen and adds the Phase 7 Final Assessment hand-off;
- updates the Playwright scenario test and scenario documentation.

No database migration or server change is included.

After extraction, run Prettier and the normal project checks before committing.
