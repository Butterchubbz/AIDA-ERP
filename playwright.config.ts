import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/smoke',
  timeout: 60_000,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5174',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ./scripts/serve-dist.mjs',
    port: 5174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
