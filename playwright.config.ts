import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env', quiet: true });
if (
  !process.env.KISTS_DEMO_PASSWORD ||
  process.env.KISTS_DEMO_PASSWORD === 'change-me-for-local-development'
) {
  throw new Error(
    'Configure KISTS_DEMO_PASSWORD and run npm run auth:demo before browser tests.',
  );
}
if (process.env.NODE_ENV === 'production')
  throw new Error(
    'Browser tests use fictional local development accounts only.',
  );

export default defineConfig({
  testDir: './client/tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: '.local/browser-test-results',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    viewport: { width: 1536, height: 900 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
