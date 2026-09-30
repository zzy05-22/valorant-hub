import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});