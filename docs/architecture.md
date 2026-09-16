# KISTS architecture and scope

Kernitect Interactive Safety Training System is a web-based safety-training platform for warehousing and logistics.

## Three tiers

```text
React + Vite + TypeScript (browser)
          | REST / JSON over HTTP
Node.js + Express + TypeScript (one modular monolith)
          | parameterized SQL through pg.Pool
PostgreSQL (persistence)
```

Frontend features live under `client/src/features`. Shared presentation belongs in components, layouts and pages; shared HTTP calls belong in services/api. React Router supplies nested layouts. Phase 3 adds a login page, AuthProvider and system-role route protection while retaining the original workspace placeholders.

Backend feature flow is Route → Controller → Service → Repository → PostgreSQL. See [module conventions](../server/src/modules/README.md). One API process and one database keep the design explainable and suitable for both the A7 prototype and final system. No microservices or ORM are introduced.

## Preserved future requirements

- Primary system users: Trainee and Administrator.
- Initial modules: Manual Handling, and Forklift and Pedestrian Safety.
- Manual Handling is the main fully demonstrated A7 prototype module.
- Authentication, system roles, trainee job roles and role-based training assignment.
- Learning content, interactive 360-degree warehouse scenarios and hazard identification.
- Assessments/knowledge checks, results and progress tracking.
- Digital certification only after **all required assigned training and assessment conditions** are completed.
- Administrator user, assignment and content management, plus progress/results monitoring.

Phase 2 implements the relational foundation, including certificate integrity and evidence. Phase 3 adds authentication and authorization APIs only; other feature APIs/workflows remain deferred. See [database design](database.md) and [authentication architecture](authentication.md). VR remains only a possible future extension.

## UI direction

Light grey and white content surfaces, a dark navy sidebar, purple primary accents, clean system sans-serif typography and restrained cards. CSS reserves teal/green, amber and red tokens for future completed, warning and failed states. No invented completion data is displayed. A darker immersive layout is reserved for future 360-degree scenes.

## Operational boundaries

- `/api/health` reports process liveness, not database readiness.
- The PostgreSQL pool connects lazily, allowing the foundation and health endpoint to run without a live database. A separate `db:check` command verifies connectivity.
- Server configuration is validated at startup. Database connection strings and raw error details are not returned to clients.
- Credentialed CORS permits only `CLIENT_URL`. Mutation-origin/custom-header checks, HTTP-only opaque sessions and system-role middleware secure auth requests; CORS alone is not authorization.
- The Vite development server proxies `/api` to the backend. Production hosting must route `/api` to Express and serve the client build with an SPA fallback to `index.html` for frontend routes. Vite preview is a local build preview, not a deployment server.
- Phase 2 adds the `kists` PostgreSQL schema, migrations, development seed and integration tests using the existing pool. Database tooling lives under `server/src/database`; SQL definitions live under `database/migrations`.
- Phase 3 adds the auth module using route/controller/service/repository layers and migration `005_auth_sessions.sql`. Role-protected trainee/admin pages remain placeholders. Feature APIs, deployment hardening and application business workflows remain for later phases; Phase 4 has not started.
