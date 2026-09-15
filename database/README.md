# Database boundary

PostgreSQL is the persistence tier. Phase 1 intentionally contains no schema, migrations or seed data.

Create an empty local database and a local login using PostgreSQL tooling if you want to verify connectivity. Put its connection URL in `server/.env`; never commit credentials. Run `npm run db:check --workspace server` from the repository root to issue `SELECT 1` without creating tables.

Later phases will store versioned SQL migrations here. Application SQL belongs in feature repositories and must use parameterized queries. Do not place business rules in route handlers or connect React directly to PostgreSQL.
