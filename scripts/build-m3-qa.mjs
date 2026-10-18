import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'output/m3-qa/app/.vercel/output');
const runnerRoot = resolve(root, 'apps/runner');
const appOrigin = 'https://typescript-lab-m3-app-qa.vercel.app';
const runnerOrigin = 'https://typescript-lab-m3-runner-qa.vercel.app';
const guestEnv = { ...process.env };
delete guestEnv.LAB_RUNNER_LOCAL_TEST;
for (const key of Object.keys(guestEnv)) {
  if (key.startsWith('VITE_SUPABASE_')) delete guestEnv[key];
}

const run = (cwd, bin, args, extra = {}) => {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd, stdio: 'inherit', env: { ...guestEnv, ...extra },
  });
  if (result.status !== 0) throw new Error(`Build failed: ${bin} (${result.status})`);
};

// Build the guest-only QA app without developer or Supabase environment configuration.
run(root, 'node_modules/vue-tsc/bin/vue-tsc.js', ['--noEmit']);
run(root, 'node_modules/vite/bin/vite.js', ['build', '--mode', 'm3-hosted-qa']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'dist'), resolve(output, 'static'), { recursive: true });

const headers = {
  'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src ${runnerOrigin}; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

await writeFile(resolve(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', headers, continue: true },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2));

// A prebuilt Preview upload must never silently include the real authentication backend.
const index = await readFile(resolve(output, 'static/index.html'), 'utf8');
if (!index.includes('/assets/') || index.includes('supabase.co')) throw new Error('Invalid guest-only QA index');

run(runnerRoot, 'node_modules/typescript/bin/tsc', ['--noEmit']);
run(runnerRoot, 'node_modules/vite/bin/vite.js', ['build'], {
  VITE_RUNNER_PARENT_ORIGIN: appOrigin,
  VITE_RUNNER_ORIGIN: runnerOrigin,
});
const runnerPolicy = JSON.parse(await readFile(resolve(runnerRoot, '.vercel/output/config.json'), 'utf8'));
const policyText = JSON.stringify(runnerPolicy.routes);
if (!policyText.includes(`frame-ancestors ${appOrigin}`) || !policyText.includes('wasm-unsafe-eval')) {
  throw new Error('Runner page/Worker response policies were not generated');
}
console.log(`Built isolated M3 QA pair: ${appOrigin} -> ${runnerOrigin}`);
