# Kernitect Interactive Safety Training System (KISTS)

Phase 1 scaffolding, Phase 2 PostgreSQL foundation and Phase 3 authentication/login for a university warehousing and logistics safety-training project, shared by the A7 prototype and later final system.

## What is included

- React, Vite and TypeScript frontend with feature directories, basic routing, reusable responsive layouts and placeholder pages.
- Express and TypeScript REST API organised as a modular monolith, validated environment configuration, PostgreSQL pool, JSON errors and graceful shutdown.
- Shared strict TypeScript defaults, ESLint, Prettier, npm workspaces and a dependency lockfile.
- PostgreSQL schema, transactional migrations, development seed, database integration tests and a documented ERD.
- Secure opaque-cookie sessions, bcrypt passwords, system-role authorization and the KISTS login page with supplied branding.
- API contract checks and architecture documentation.

Training/assessment APIs and interfaces, full dashboards, the 360-degree viewer and VR are **not implemented**. Workspaces are protected by system role and retain their placeholder content. Development accounts are fictional and no successful results or certificates are seeded.

## Prerequisites

1. Node.js 22.12 or newer (Node 22 LTS recommended for this foundation), with npm.
2. Local PostgreSQL 16 for authentication, migrations, seeds and database tests. The login shell and liveness endpoint can launch independently, but signing in requires PostgreSQL.
3. Git if you want to track and commit changes. No global Vite, TypeScript or Express installation is required.

## Install and configure

Run from the `kists` root:

```sh
npm ci
```

For a fresh checkout, copy the example files using PowerShell (preserve existing local `.env` files):

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Or macOS/Linux:

```sh
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your local PostgreSQL connection details. The example password is a placeholder, not a working credential. All real `.env` files are ignored by Git. The client contains no secrets.

| Variable              | Location      | Purpose                                                        |
| --------------------- | ------------- | -------------------------------------------------------------- |
| `PORT`                | `server/.env` | API listen port; example `3000`                                |
| `DATABASE_URL`        | `server/.env` | PostgreSQL connection URL                                      |
| `CLIENT_URL`          | `server/.env` | Allowed browser origin; example `http://localhost:5173`        |
| `NODE_ENV`            | `server/.env` | `development` locally; production requires HTTPS               |
| `KISTS_DEMO_PASSWORD` | `server/.env` | Local-only password for fictional login account setup          |
| `API_PROXY_TARGET`    | `client/.env` | Vite development proxy target; default `http://localhost:3000` |

The server requires all three server variables and validates their format at startup. A reachable database is not required for startup because the pool is lazy. If changing the API port, also update `API_PROXY_TARGET`. The client uses port 5173 with strict port checking.

**Windows:** If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` for every command below. No execution-policy change is required.

## Run locally

First configure local PostgreSQL and apply the database foundation:

```sh
npm run db:migrate
npm run db:seed
npm run auth:demo
```

Use a local `kists_dev` database and set a unique `KISTS_DEMO_PASSWORD` in ignored `server/.env` before `auth:demo`. An optional Windows script creates an isolated project-owned cluster on port 55432. See [database setup](docs/database.md) and [authentication, demo accounts and login instructions](docs/authentication.md). Do not overwrite an already configured `.env`.

Terminal 1, from the repository root:

```sh
npm run dev:server
```

Terminal 2, from the repository root:

```sh
npm run dev:client
```

Open **http://localhost:5173**. API: **http://localhost:3000/api/health**.

Alternatively, run `npm run dev` inside `client/` or `server/` after installing at the root.

```json
{ "status": "ok", "service": "KISTS API" }
```

This endpoint checks API liveness only. To verify a configured PostgreSQL instance without creating a schema:

```sh
npm run db:check --workspace server
```

## Frontend routes

| Route                   | Placeholder                     |
| ----------------------- | ------------------------------- |
| `/`                     | KISTS login                     |
| `/trainee/dashboard`    | Trainee dashboard               |
| `/trainee/training`     | Assigned training               |
| `/trainee/progress`     | Trainee progress                |
| `/trainee/certificates` | Digital certificates            |
| `/admin/dashboard`      | Administrator dashboard         |
| `/admin/users`          | User management                 |
| `/admin/training`       | Content management              |
| `/admin/assignments`    | Training assignment             |
| `/admin/progress`       | Progress and results monitoring |

Unknown routes display a 404 page. Anonymous workspace visits redirect to login. Trainees and administrators can access only their own system-role workspace; job roles never grant administrator access.

## Build and quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:frontend
npm run build
```

`npm run format` applies formatting. Build output is `client/dist/` and `server/dist/` (ignored by Git). `npm test` runs 46 backend checks including database/authentication tests in temporary schemas. `npm run test:frontend` runs 10 real browser checks; install Chromium with `npm exec playwright -- install chromium` first and configure demo accounts. See [verification](docs/verification.md).

Run the compiled API with `npm start --workspace server`. Preview the built frontend with `npm run preview --workspace client`; this is a local static preview, and its API integration needs a reverse proxy. For normal integrated local use, use the two development commands above. Production hosting must provide an SPA fallback and route `/api` to the server.

## Project structure

```text
kists/
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── assets/
│       ├── components/BrandLogo.tsx
│       ├── layouts/AppLayout.tsx
│       ├── pages/                 # Shared placeholder and 404 pages
│       ├── features/
│       │   ├── auth/              # Login, provider and route guards
│       │   ├── trainee/           # Trainee navigation
│       │   ├── admin/             # Administrator navigation
│       │   ├── training/
│       │   ├── scenarios/
│       │   ├── assessments/
│       │   ├── progress/
│       │   └── certificates/
│       ├── services/api/health.ts
│       ├── hooks/
│       ├── types/navigation.ts
│       ├── utils/
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.check.json
│   ├── test/                      # API and PostgreSQL integration tests
│   └── src/
│       ├── config/                # Environment and PostgreSQL pool
│       ├── database/              # Migration/seed/reset tooling
│       ├── middleware/            # JSON 404 and error handling
│       ├── modules/
│       │   ├── README.md          # Route/controller/service/repository conventions
│       │   ├── auth/
│       │   ├── users/
│       │   ├── roles/
│       │   ├── training/
│       │   ├── assignments/
│       │   ├── scenarios/
│       │   ├── assessments/
│       │   ├── progress/
│       │   └── certificates/
│       ├── routes/                # API router and health endpoint
│       ├── types/
│       ├── utils/check-database.ts
│       ├── app.ts
│       └── index.ts
├── database/
│   ├── migrations/                # Five versioned SQL migrations
│   ├── seeds/development.sql
│   ├── scripts/start-local-postgres.ps1
│   └── README.md
├── docs/
│   ├── architecture.md
│   ├── authentication.md
│   ├── database.md
│   └── verification.md
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── eslint.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── README.md
```

Empty reserved directories contain `.gitkeep` files so Git preserves them. Dependency and generated build directories are omitted above.

Read [architecture](docs/architecture.md), [authentication](docs/authentication.md), [database design](docs/database.md), [trainee dashboard](docs/trainee-dashboard.md), and [module conventions](server/src/modules/README.md). Manual Handling remains the main A7 demonstration module; Forklift and Pedestrian Safety is the other initial module. Phase 4 adds the database-backed trainee dashboard; later learning workflows remain out of scope.
