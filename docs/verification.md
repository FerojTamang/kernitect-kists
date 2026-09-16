# Verification record

## Phase 3 — authentication and login

Verified with local PostgreSQL 16.12, Node.js 22.18.0 and Chromium through Playwright. The in-app browser tool could not connect due to an environment error, so browser verification used a separate local Chromium instance.

| Check                   | Result                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `005_auth_sessions.sql` | Applied; existing migrations preserved                                                                       |
| Demo account setup      | Alex Morgan and KISTS Administrator configured with bcrypt hashes; passwords not printed                     |
| Backend suite           | 46 passed: 24 database, 18 authentication/security and 4 original API tests                                  |
| Browser suite           | 10 passed                                                                                                    |
| TypeScript              | Client, server, tests and browser-test configuration passed                                                  |
| Lint / formatting       | Passed                                                                                                       |
| Production builds       | Client and server passed                                                                                     |
| Local startup           | Vite on localhost:5173 and API on localhost:3000                                                             |
| Login / redirects       | Trainee and administrator reached their correct placeholder dashboards                                       |
| Route protection        | Anonymous redirects, wrong-role denial and Supervisor job-role rejection verified                            |
| Session behavior        | `/me`, reload persistence, remember me, logout, expiry/revocation verified                                   |
| Error states            | Form validation, wrong/disabled credentials, network/server failure and duplicate-submit protection verified |
| Visual review           | Desktop 1536×900, tablet 900×1024 and mobile 390×844 screenshots reviewed                                    |

Current screenshots are in ignored `.local/verification/login-desktop.png`, `login-tablet.png` and `login-mobile.png`. The supplied logo is unchanged, including its existing dark square background. The warehouse image is an explicit schematic placeholder because no approved photograph was supplied. No reference colour legend, hex labels, page numbering or design annotations are rendered.

No human/manual QA is claimed: login and navigation were exercised in a real browser by automation, and screenshots were visually inspected. No full dashboard or Phase 4 feature was implemented. See [authentication decisions and limitations](authentication.md).

## Phase 2 — PostgreSQL foundation

Verified locally with Node.js 22.18.0, npm 10.9.3 and PostgreSQL 16.12. The project-owned database is `kists_dev` on `127.0.0.1:55432`; credentials are stored only in ignored `server/.env`. The existing PostgreSQL service was not modified.

| Check                  | Result                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Migration execution    | All four SQL migrations applied successfully                       |
| Migration replay       | No-op on an up-to-date database; applied checksums verified        |
| Development seed       | Successful, including repeated execution without duplicate records |
| Database connection    | `SELECT 1` passed through the existing pool                        |
| Reset guard            | Refused without the matching database-name flag                    |
| Explicit local reset   | Rebuilt only the project schema, then seeded successfully          |
| `npm test`             | 28 passed: 24 database integration tests and 4 API tests           |
| `npm run typecheck`    | Passed for client, server and server test files                    |
| `npm run lint`         | Passed                                                             |
| `npm run build`        | Passed for client and server                                       |
| `npm run format:check` | Passed                                                             |

Database tests create isolated temporary schemas in local PostgreSQL. Coverage includes role integrity, foreign keys, duplicate emails/assignments, multiple scenarios/assessments, response membership, immutable submitted results, required-only certification, snapshots and current availability. No browser/UI changes, authentication, feature APIs, certificate documents or deployment were implemented.

## Phase 1 — historical record

Verified in this workspace using Node.js 22.18.0 and npm 10.9.3. The compiled API also launched successfully on an alternate port and returned the expected health response.

| Check                            | Result                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run typecheck`              | Passed for client and server                                                                     |
| `npm run build`                  | Passed; client bundle and compiled server generated                                              |
| `npm run lint`                   | Passed                                                                                           |
| `npm run format:check`           | Passed                                                                                           |
| `npm test`                       | All four API tests passed                                                                        |
| Development startup              | Vite on 5173 and Express on 3000 launched                                                        |
| API health                       | Expected JSON returned directly and through Vite proxy                                           |
| Frontend HTTP routing            | All ten requested paths served the app entry point with HTTP 200                                 |
| PostgreSQL connectivity          | Failed with example configuration; requires a running database and real local connection details |
| Browser visual/interaction check | Not performed: browser tool connection failed due to an environment error                        |

HTTP routing checks confirm that the development server serves the SPA entry point; they do not replace browser rendering and interaction checks. No database schema or business features were tested because they are outside Phase 1.

Dependency compatibility and server error handling were checked against the official [Vite guide](https://vite.dev/guide/) and [Express error-handling documentation](https://expressjs.com/en/guide/error-handling/).
