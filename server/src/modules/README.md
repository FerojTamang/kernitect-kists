# Modular monolith conventions

Module directories: auth, users, roles, training, assignments, scenarios, assessments, progress and certificates. Phase 3 implements the auth module; the other feature directories remain reserved. `.gitkeep` files preserve empty directories in source control.

Each module can later contain:

```text
training/
  training.routes.ts       # URLs, middleware and controller wiring
  training.controller.ts   # HTTP input/output; delegates to the service
  training.service.ts      # Business rules and coordination
  training.repository.ts   # Parameterized SQL through config/database.ts
  training.validation.ts   # Input validation, added with the feature
  training.types.ts        # Feature-specific TypeScript types
```

Flow: Route → Controller → Service → Repository → PostgreSQL.

Register module routers in `src/routes/index.ts`. Controllers do not issue SQL; repositories do not depend on Express. Services own future training assignment and certification rules. System roles (Trainee and Administrator) are distinct from trainee job roles used for training assignment.

The health route is an infrastructure liveness endpoint, so it has no business service or repository. Do not create empty passthrough layers just for that response.
