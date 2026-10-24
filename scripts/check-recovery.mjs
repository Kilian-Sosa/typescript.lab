import { spawnSync } from 'node:child_process';

// This suite intercepts every request to this synthetic Auth/Data API origin.
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/auth-recovery.spec.ts', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
      M4_MOCK_AUTH_E2E: '1',
      VITE_SUPABASE_URL: 'https://m4-fixture.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-m4-fixture',
      PLAYWRIGHT_PORT: process.env.PLAYWRIGHT_PORT ?? '49180',
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
