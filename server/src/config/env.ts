import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Stable from either src/config or dist/config, independent of the working directory.
dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseUrl(name: string, protocols: string[]): URL {
  let url: URL;
  try {
    url = new URL(required(name));
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol))
    throw new Error(`${name} uses an unsupported protocol`);
  return url;
}

const portValue = required('PORT');
const port = Number(portValue);
if (
  !/^\d+$/.test(portValue) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const databaseUrl = parseUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
const clientUrl = parseUrl('CLIENT_URL', ['http:', 'https:']);
if (
  clientUrl.username ||
  clientUrl.password ||
  clientUrl.pathname !== '/' ||
  clientUrl.search ||
  clientUrl.hash
) {
  throw new Error(
    'CLIENT_URL must be an origin, such as http://localhost:5173',
  );
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv))
  throw new Error('NODE_ENV must be development, test or production');
if (nodeEnv === 'production' && clientUrl.protocol !== 'https:')
  throw new Error('Production CLIENT_URL must use HTTPS');
if (
  nodeEnv !== 'production' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(clientUrl.hostname)
) {
  throw new Error(
    'HTTP development cookies are restricted to a local CLIENT_URL',
  );
}

export const env = Object.freeze({
  isProduction: nodeEnv === 'production',
  cookieSecure: nodeEnv === 'production' || clientUrl.protocol === 'https:',
  port,
  databaseUrl: databaseUrl.href,
  clientUrl: clientUrl.origin,
});
