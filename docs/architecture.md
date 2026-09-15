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

Frontend features live under `client/src/features`. Shared presentation belongs in components, layouts and pages; shared HTTP calls belong in services/api. React Router supplies nested layouts. There are no route guards in Phase 1; preview workspaces are public and contain no user records.

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

None of these business features is implemented in Phase 1. VR is outside the initial system and is only a possible future extension. The future 360-degree viewer is web-based and distinct from VR.

## UI direction

Light grey and white content surfaces, a dark navy sidebar, purple primary accents, clean system sans-serif typography and restrained cards. CSS reserves teal/green, amber and red tokens for future completed, warning and failed states. No invented completion data is displayed. A darker immersive layout is reserved for future 360-degree scenes.

## Operational boundaries

- `/api/health` reports process liveness, not database readiness.
- The PostgreSQL pool connects lazily, allowing the foundation and health endpoint to run without a live database. A separate `db:check` command verifies connectivity.
- Server configuration is validated at startup. Database connection strings and raw error details are not returned to clients.
- CORS permits browser access from the configured `CLIENT_URL`; CORS is not authentication or authorization.
- The Vite development server proxies `/api` to the backend. Production hosting must route `/api` to Express and serve the client build with an SPA fallback to `index.html` for frontend routes. Vite preview is a local build preview, not a deployment server.
- Real authentication, authorization, persistence, deployment hardening and business validation belong to later phases. This foundation is not a completed production system.
