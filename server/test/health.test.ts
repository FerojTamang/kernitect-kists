import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/kists_test';
process.env.CLIENT_URL = 'http://localhost:5173';
const { createApp } = await import('../src/app.js');
let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('health returns the liveness contract without a database connection', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'KISTS API',
  });
});
test('unknown API routes return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { message: 'Route not found' },
  });
});
test('malformed JSON returns a safe client error', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { message: 'Invalid request' },
  });
});
test('CORS advertises only the configured client origin', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  const other = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://example.org' },
  });
  assert.notEqual(
    other.headers.get('access-control-allow-origin'),
    'https://example.org',
  );
});
