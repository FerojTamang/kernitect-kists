# PostgreSQL database foundation

Phase 2 adds a normalized schema, forward SQL migrations, development seeds and real PostgreSQL integration tests. No application APIs or authentication are added.

See [database design, ERD and commands](../docs/database.md). Configure `server/.env`, then run `npm run db:migrate`, `npm run db:seed` and `npm run test:db` from the root. Use `npm.cmd` on Windows if PowerShell blocks the npm wrapper.

SQL runs in the dedicated `kists` schema. Tooling under `server/src/database` reuses the existing pool. Migrations are atomic and checksum-verified: add numbered migrations instead of editing applied files. Future application SQL belongs in feature repositories and must use parameterized queries. Never connect React directly to PostgreSQL.
