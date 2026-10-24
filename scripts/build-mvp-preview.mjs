import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Never silently build an executable app for Production or an unclassified deployment.
if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_TARGET_ENV !== 'preview') {
  throw new Error('MVP requires explicit Preview deployment metadata: VERCEL_ENV=preview and VERCEL_TARGET_ENV=preview.');
}

const appOrigin = 'https://typescript-lab-m3-app-qa.vercel.app';
const runnerOrigin = 'https://typescript-lab-m3-runner-qa.vercel.app';
const rawUrl = process.env.VITE_SUPABASE_URL;
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!rawUrl || !publicKey?.startsWith('sb_publishable_')) {
  throw new Error('MVP Preview requires the explicitly approved public Supabase URL and publishable key.');
}
const supabaseUrl = new URL(rawUrl);
if (supabaseUrl.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl.hostname)
  || supabaseUrl.href !== supabaseUrl.origin + '/') {
  throw new Error('MVP Preview requires an exact https://<project>.supabase.co origin.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const runnerRoot = resolve(root, 'apps/runner');
const output = resolve(root, 'output/mvp-preview/app/.vercel/output');
const run = (cwd, bin, args, extra = {}) => {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd, stdio: 'inherit', env: { ...process.env, ...extra },
  });
  if (result.status !== 0) throw new Error(`Build failed: ${bin} (${result.status})`);
};

run(root, 'node_modules/vue-tsc/bin/vue-tsc.js', ['--noEmit']);
run(root, 'node_modules/vite/bin/vite.js', ['build', '--mode', 'mvp-preview']);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'dist'), resolve(output, 'static'), { recursive: true });

const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com; connect-src ${supabaseUrl.origin} wss://${supabaseUrl.hostname}; frame-src ${runnerOrigin}; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
const headers = {
  'Content-Security-Policy': csp,
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

const index = await readFile(resolve(output, 'static/index.html'), 'utf8');
if (!index.includes('/assets/')) throw new Error('Invalid MVP Preview build output.');

run(runnerRoot, 'node_modules/typescript/bin/tsc', ['--noEmit']);
run(runnerRoot, 'node_modules/vite/bin/vite.js', ['build'], {
  VITE_RUNNER_PARENT_ORIGIN: appOrigin, VITE_RUNNER_ORIGIN: runnerOrigin,
  LAB_RUNNER_LOCAL_TEST: '',
});
const config = JSON.parse(await readFile(resolve(runnerRoot, '.vercel/output/config.json'), 'utf8'));
const policy = JSON.stringify(config.routes);
if (!policy.includes(`frame-ancestors ${appOrigin}`) || !policy.includes('wasm-unsafe-eval')) {
  throw new Error('Runner response security policies are absent.');
}
console.log('Built authenticated isolated MVP Preview pair with exact cross-site origins.');
