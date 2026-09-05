import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-deploy',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  timeout: 30_000,
  reporter: 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'domain-root', use: { baseURL: 'http://localhost:4174/' } },
    { name: 'github-pages-subpath', use: { baseURL: 'http://localhost:4174/brclio-robot/' } },
    { name: 'github-pages-built-base', use: { baseURL: 'http://localhost:4174/pages-check/' } },
  ],
  webServer: {
    command: 'node scripts/serve-deployment.mjs',
    url: 'http://localhost:4174/',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
