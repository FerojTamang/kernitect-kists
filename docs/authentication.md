# Authentication and login — Phase 3

## Scope and architecture

Phase 3 added the login screen, stateful authentication and system-role access control. Phase 4 adds the authenticated trainee dashboard as a read-only consumer of existing training data. Administrator pages, learning content, assessment, certificate, password-recovery and VR workflows remain outside the implemented scope.

```text
React login / AuthProvider
        | REST, same-origin development proxy, browser cookie
auth.routes.ts → auth.controller.ts → auth.service.ts
        → auth.repository.ts → PostgreSQL auth_sessions / users / roles
```

The auth repository uses the existing `pg` pool. Middleware loads the current user from PostgreSQL on every authenticated request. Frontend route guards improve navigation; backend middleware remains the permission boundary. No JWT, browser token storage, external identity provider or new database is used.

## Endpoints

| Endpoint                | Behavior                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`  | Validates email/password/optional boolean `rememberMe`, verifies the password and active account, issues a cookie and returns `{ user }`. |
| `POST /api/auth/logout` | Revokes the presented session, clears the cookie and returns 204. Idempotent for missing/invalid cookies.                                 |
| `GET /api/auth/me`      | Returns `{ user }` for an active, unexpired session, otherwise 401.                                                                       |

Safe user fields: `id`, `firstName`, `lastName`, `email`, `systemRole`, `jobRole`. Responses never include password hashes, session hashes or raw session tokens. Auth responses use `Cache-Control: no-store`.

Mutation requests require `Content-Type: application/json`, `Origin` exactly matching `CLIENT_URL`, and `X-KISTS-Request: 1`. The frontend supplies the custom header; browsers supply Origin. CLI/API test clients must supply both explicitly.

## Session design

Migration **`005_auth_sessions.sql`** adds only `auth_sessions`. It preserves all Phase 2 migrations/tables. Columns are identity ID, user FK, unique SHA-256 token hash, creation, absolute expiry, last use and revocation timestamps. User/expiry indexes support lookup and maintenance.

On login, the server generates 32 cryptographically random bytes, encodes them as a 43-character opaque base64url token and stores **only its SHA-256 hash**. The raw token travels only in `Set-Cookie`; JavaScript cannot read it. Successful login replaces/revokes the previous browser session instead of reusing a supplied token. Session creation rechecks the verified password hash and active user under a row lock.

| Cookie property | Decision                                                          |
| --------------- | ----------------------------------------------------------------- |
| Name            | `kists_session`                                                   |
| HttpOnly        | Always true                                                       |
| SameSite        | Lax, alongside explicit mutation-origin/custom-header checks      |
| Secure          | True when `NODE_ENV=production`; false for local HTTP development |
| Domain          | Omitted: host-only cookie                                         |
| Path            | `/`                                                               |
| Normal lifetime | **8 hours**, explicit Max-Age/Expires and database expiry         |
| Remember me     | **30 days**, explicit Max-Age/Expires and database expiry         |

Expiry is absolute, not sliding. `last_used_at` is for activity tracking and does not extend expiry. Logout sets `revoked_at`. Inactive users, expired/revoked sessions and unknown/malformed tokens are rejected. Roles and active state are read afresh; the cookie never contains a role.

There is no automatic expired-session cleanup job in this phase. Later maintenance may delete rows whose expiry is in the past. Revoked rows remain available for diagnostics until cleanup. Future password-change/account-management operations must revoke sessions; the local demo setup already does so when resetting its accounts.

## Password and request security

- `bcryptjs`, cost **12**, performs salted password hashing and asynchronous verification. UTF-8 inputs over 72 bytes are rejected rather than silently truncated. The local setup requires at least 12 characters.
- Old Phase 2 disabled scrypt fixtures remain disabled and unusable. The dedicated Phase 3 accounts use bcrypt; no legacy password migration or authentication fallback is introduced.
- Unknown users and unsupported hash formats perform a dummy bcrypt check. Wrong password, nonexistent user and disabled account use the same 401 response to avoid revealing account existence.
- Helmet supplies response security headers. Bodies are limited to 16 KB. Credentialed CORS allows only `CLIENT_URL`; mutation checks also prevent login/logout CSRF.
- Login rate limits allow **10 failed attempts per normalized email** and **30 failed attempts per client IP** per 15 minutes, with 429/Retry-After. Email keys are hashed. Successful requests are removed from the counters.
- Limits use process memory, appropriate to this single-process modular monolith. They reset on restart and are not distributed. `trust proxy` remains false: a future deployment must explicitly configure its actual trusted proxy chain rather than trusting arbitrary forwarded headers.
- Error responses are controlled; passwords, SQL row details, cookies and raw tokens are not logged. HTTP-only cookies reduce token exposure but do not replace safe UI rendering and future deployment security work.
- Production requires HTTPS `CLIENT_URL` and Secure cookies. TLS hosting/deployment is not implemented here. Nonproduction CLIENT_URL is restricted to loopback hosts.

## System role versus job role

`requireAuthentication(service)` returns 401 without a valid session. `requireSystemRole('administrator')` returns 403 when an authenticated user lacks that system role. It reads **only `user.systemRole`**.

Warehouse Operative, Forklift Operator and Supervisor are job roles. None grants administrator permission. Tests explicitly prove a trainee whose job role is Supervisor cannot pass administrator middleware.

The frontend allows `/trainee/*` only to trainees and `/admin/*` only to administrators. Anonymous users return to `/`; authenticated users requesting the wrong workspace see an access-denied page. Login routes trainees to `/trainee/dashboard` and administrators to `/admin/dashboard`. Neither dashboard was implemented beyond the existing placeholder and authenticated name/sign-out state.

## Frontend state and UX

`AuthProvider`, `useAuth` and protected route components handle an initial `/me` check, a loading state, login/logout and role protection. A generation counter prevents stale requests from replacing newer login/logout state. Visible-page checks run every 60 seconds and on window focus; API 401 responses also clear an authenticated state. Expired sessions return to login with a message. A failed session check blocks protected content and offers retry.

Login has labelled inputs, autocomplete, field validation/focus, a keyboard-accessible show/hide control, real remember-me behavior, pending/duplicate-submit protection, safe credential errors and recoverable network/server failures. Errors use text plus borders, not colour alone. No localStorage/sessionStorage stores credentials or authentication state.

Forgot password is omitted. Support instructions are text because no administrator contact address was supplied. There is no public registration, dead recovery link, fake support action or decorative checkbox.

## Local configuration and accounts

Keep these variables in ignored `server/.env`:

| Variable              | Use                                                                             |
| --------------------- | ------------------------------------------------------------------------------- |
| `PORT`                | API port, normally 3000                                                         |
| `DATABASE_URL`        | Local PostgreSQL URL; current project cluster is `kists_dev` at 127.0.0.1:55432 |
| `CLIENT_URL`          | Exact frontend origin, normally `http://localhost:5173`                         |
| `NODE_ENV`            | `development` locally, `production` only with HTTPS hosting                     |
| `KISTS_DEMO_PASSWORD` | Unique local password used only by demo setup/browser tests; never committed    |

`client/.env` retains `API_PROXY_TARGET=http://localhost:3000`. Do not put passwords in client variables. There is no session signing secret: token security comes from random entropy and server-side hash lookup.

### Exact setup

From the repository root, on this Windows machine:

```powershell
# If the project-owned PostgreSQL cluster is stopped:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File database/scripts/start-local-postgres.ps1

npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:seed

# Edit only the ignored file; preserve the database URL.
notepad server/.env
# Set KISTS_DEMO_PASSWORD to your own 12+ character password (maximum 72 UTF-8 bytes).

npm.cmd run auth:demo
```

This workspace already has a randomly generated local password in `server/.env` and both accounts configured. Read it locally or replace it and rerun `auth:demo`; it is intentionally absent from documentation and tool output.

| Fictional account   | Email                                 | System role   | Job role            |
| ------------------- | ------------------------------------- | ------------- | ------------------- |
| Alex Morgan         | `alex.morgan@example.invalid`         | trainee       | Warehouse Operative |
| KISTS Administrator | `kists.administrator@example.invalid` | administrator | none                |

Both use your local `KISTS_DEMO_PASSWORD`. Setup is restricted to local development databases, hashes before storage and revokes their previous sessions when rerun. It refuses conflicting reserved email identities. It does not modify the disabled `demo.*` Phase 2 fixtures or fabricate training completion.

Start two terminals:

```powershell
npm.cmd run dev:server
```

```powershell
npm.cmd run dev:client
```

Open **http://localhost:5173** and sign in. Use this exact origin rather than substituting `127.0.0.1`; mutation-origin checks intentionally match CLIENT_URL.

## Verification commands

```powershell
npm.cmd run test:db
npm.cmd run test:auth
npm.cmd test
npm.cmd exec playwright -- install chromium
npm.cmd run test:frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

Backend tests create/drop isolated random schemas in real local PostgreSQL. The administrator authorization probe exists only in the test harness, not the application API. Browser tests use the two fictional local accounts and expect migrations, seed and `auth:demo` to have run. Playwright starts/reuses local servers, keeps traces/video off and writes only explicit credential-free screenshots under ignored `.local/verification`.

## Visual implementation and limitations

The supplied reference was found at `docs/01_Login_Page.png` and copied unchanged to the requested canonical location `docs/ui-reference/01_Login_Page.png`. Desktop follows its navy brand column, warehouse visual column and light form area. Tablet narrows the branded area; mobile collapses it to a header. Inter is self-hosted through `@fontsource/inter` (Latin weights 400–700). The exact requested colour tokens are used.

`BrandLogo` uses the actual supplied PNGs, preserving aspect ratio with no recolouring, redrawing or cropping. The supplied dark asset contains a dark rectangular background and low-contrast purple artwork; it is retained as supplied, unlike the generated white reference logo. A future approved transparent/reversed brand asset can improve that presentation.

No approved warehouse photograph was supplied. `client/src/assets/warehouse/warehouse-placeholder.svg` is an original, replaceable schematic using the approved palette. No commercial stock image or screenshot worker was fetched/extracted.

The colour-theme legend, hex labels, page numbers, design annotations and generated reference logo are not rendered. Full dashboards and all Phase 4 work remain outside this implementation.

Implementation references: [bcryptjs limits and API](https://github.com/dcodeIO/bcrypt.js), [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration), [Helmet](https://github.com/helmetjs/helmet).
