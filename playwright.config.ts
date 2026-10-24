import { defineConfig, devices } from '@playwright/test';

// Playwright forces color in its workers and web server; avoid conflicting inherited settings.
delete process.env.NO_COLOR;

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL === 'msedge' ? { channel: 'msedge' as const } : {};
const serverPort = process.env.PLAYWRIGHT_PORT ?? '4173';
const baseURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], ...browserChannel },
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        ...browserChannel,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${serverPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
