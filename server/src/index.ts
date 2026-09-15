import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';

const server = createApp().listen(env.port, () => {
  console.info(`KISTS API listening on http://localhost:${env.port}`);
});

server.on('error', () => {
  console.error(
    'API could not start. Check PORT and whether it is already in use.',
  );
  process.exitCode = 1;
  void pool.end();
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('Stopping KISTS API.');
  const timeout = setTimeout(() => {
    process.exit(1);
  }, 10000);
  timeout.unref();
  server.close(() => {
    void pool
      .end()
      .then(() => {
        clearTimeout(timeout);
      })
      .catch(() => {
        console.error('Database pool did not close cleanly.');
        process.exitCode = 1;
      });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
