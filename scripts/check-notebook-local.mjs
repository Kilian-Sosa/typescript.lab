import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Keep local status credentials inside this process; never print the status payload.
let status;
try {
  status = JSON.parse(execFileSync(process.execPath, [
    'node_modules/supabase/dist/supabase.js', 'status', '-o', 'json',
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch {
  throw new Error('Could not read local Supabase status. Start the disposable stack first.');
}
const url = status.API_URL;
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (typeof url !== 'string' || new URL(url).hostname !== '127.0.0.1' || !publishableKey) {
  throw new Error('This check requires a running disposable loopback Supabase stack.');
}

const result = spawnSync(process.execPath, [
  'node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/notebook-local.spec.ts',
  ...process.argv.slice(2),
], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: '1',
    LOCAL_NOTEBOOK_E2E: '1',
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    PLAYWRIGHT_PORT: process.env.PLAYWRIGHT_PORT ?? '49179',
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
