# Kernitect Interactive Safety Training System (KISTS)

Phase 1 foundation for a university warehousing and logistics safety-training project, shared by the A7 initial prototype and later final system.

## What is included

- React, Vite and TypeScript frontend with feature directories, basic routing, reusable responsive layouts and placeholder pages.
- Express and TypeScript REST API organised as a modular monolith, validated environment configuration, PostgreSQL pool, JSON errors and graceful shutdown.
- Shared strict TypeScript defaults, ESLint, Prettier, npm workspaces and a dependency lockfile.
- API contract checks and architecture documentation.

Authentication, database schema, training behavior, assessments, the 360-degree viewer and VR are **not implemented**. Workspace preview links do not authenticate users. No progress, results or certificates are fabricated.

## Prerequisites

1. Node.js 22.12 or newer (Node 22 LTS recommended for this foundation), with npm.
2. PostgreSQL for database connectivity checks and later persistence. It is not needed to render placeholder pages or call the liveness endpoint.
3. Git if you want to track and commit changes. No global Vite, TypeScript or Express installation is required.

## Install and configure

Run from the `kists` root:

```sh
npm ci
```

Copy the example files using PowerShell:

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

| Variable           | Location      | Purpose                                                        |
| ------------------ | ------------- | -------------------------------------------------------------- |
| `PORT`             | `server/.env` | API listen port; example `3000`                                |
| `DATABASE_URL`     | `server/.env` | PostgreSQL connection URL                                      |
| `CLIENT_URL`       | `server/.env` | Allowed browser origin; example `http://localhost:5173`        |
| `API_PROXY_TARGET` | `client/.env` | Vite development proxy target; default `http://localhost:3000` |

The server requires all three server variables and validates their format at startup. A reachable database is not required for startup because the pool is lazy. If changing the API port, also update `API_PROXY_TARGET`. The client uses port 5173 with strict port checking.

**Windows:** If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` for every command below. No execution-policy change is required.

## Run locally

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
| `/`                     | Login and workspace previews    |
| `/trainee/dashboard`    | Trainee dashboard               |
| `/trainee/training`     | Assigned training               |
| `/trainee/progress`     | Trainee progress                |
| `/trainee/certificates` | Digital certificates            |
| `/admin/dashboard`      | Administrator dashboard         |
| `/admin/users`          | User management                 |
| `/admin/training`       | Content management              |
| `/admin/assignments`    | Training assignment             |
| `/admin/progress`       | Progress and results monitoring |

Unknown routes display a 404 page. All workspace routes are intentionally public in Phase 1.

## Build and quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` applies formatting. Build output is `client/dist/` and `server/dist/` (ignored by Git). Tests use Node's built-in test runner and do not contact PostgreSQL.

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
│       ├── components/Brand.tsx
│       ├── layouts/AppLayout.tsx
│       ├── pages/                 # Shared placeholder and 404 pages
│       ├── features/
│       │   ├── auth/              # Login placeholder
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
│   ├── test/health.test.ts
│   └── src/
│       ├── config/                # Environment and PostgreSQL pool
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
├── database/README.md             # No schema yet
├── docs/
│   ├── architecture.md
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

Read [architecture and preserved requirements](docs/architecture.md) and [backend module conventions](server/src/modules/README.md). Manual Handling remains the main A7 demonstration module; Forklift and Pedestrian Safety is the other initial module. Phase 2 work has not started.
