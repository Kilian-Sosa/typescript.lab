import { pathToFileURL } from 'node:url';

export const QA = Object.freeze({
  app: 'https://typescript-lab-m3-app-qa.vercel.app',
  runner: 'https://typescript-lab-m3-runner-qa.vercel.app',
  appProduction: 'https://typescript-lab-app-preview.vercel.app',
  runnerProduction: 'https://typescript-lab-runner-preview.vercel.app',
  runnerImmutable: 'https://typescript-lab-runner-preview-mzxryefu2-kiliansosas-projects.vercel.app',
  worker: '/assets/worker-Kl-ODK3w.js',
  wasm: '/assets/emscripten-module-uFzwHH0Y.wasm',
});

const CSP = 'content-security-policy';
const check = (ok, detail) => {
  if (!ok) throw new Error(detail);
};
const sso = (location) => {
  if (!location) return false;
  try {
    const url = new URL(location);
    return url.origin === 'https://vercel.com' && url.pathname === '/sso-api';
  } catch {
    return false;
  }
};

export function checksFor(phase) {
  check(['protected', 'public', 'reprotected'].includes(phase), 'Mode must be protected, public, or reprotected.');
  const endpoints = [
    ['Application QA', QA.app + '/', 'sso'],
    ['Application Production', QA.appProduction + '/', 'sso'],
    ['Runner Production', QA.runnerProduction + '/', 'sso'],
    ['Runner immutable Preview', QA.runnerImmutable + '/', 'sso'],
    ['Runner QA', QA.runner + '/', phase === 'public' ? 'html' : 'sso'],
  ];
  if (phase === 'public')
    endpoints.push(
      ['Runner Worker', QA.runner + QA.worker, 'worker'],
      ['Runner WASM', QA.runner + QA.wasm, 'wasm'],
      ['Runner missing asset', QA.runner + '/nonexistent-m3-public-qa-asset', '404'],
    );
  return endpoints;
}

function verifyHeader(response, key, expected, label) {
  const value = response.headers.get(key) ?? '';
  check(
    value.toLowerCase().includes(expected.toLowerCase()),
    `${label}: expected ${key} to contain ${JSON.stringify(expected)}`,
  );
}

export async function runProbe(phase, request = fetch) {
  const checks = checksFor(phase);
  const results = [];
  for (const [label, url, kind] of checks) {
    const response = await request(url, {
      method: kind === 'html' ? 'GET' : 'HEAD',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (kind === 'sso') {
      check(
        response.status === 302 && sso(response.headers.get('location')),
        `${label}: expected Vercel SSO redirect (302)`,
      );
    } else if (kind === '404') {
      check(response.status === 404, `${label}: expected 404`);
    } else {
      check(response.status === 200 && !response.headers.get('location'), `${label}: expected direct 200, no redirect`);
    }
    if (kind !== 'sso') {
      verifyHeader(response, 'x-content-type-options', 'nosniff', label);
      verifyHeader(response, 'referrer-policy', 'no-referrer', label);
      verifyHeader(response, 'cache-control', 'no-store', label);
      if (kind === '404') verifyHeader(response, CSP, `frame-ancestors ${QA.app}`, label);
      if (kind !== '404') {
        if (kind === 'html') {
          verifyHeader(response, 'content-type', 'text/html', label);
          verifyHeader(response, CSP, `frame-ancestors ${QA.app}`, label);
          check(!response.headers.get(CSP).includes('wasm-unsafe-eval'), 'Runner HTML must not permit WASM eval');
          const claimed = Number(response.headers.get('content-length') ?? 0);
          check(claimed <= 131072, 'Runner HTML content length exceeds 128 KiB');
          const reader = response.body?.getReader();
          let total = 0,
            body = '';
          if (reader) {
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.byteLength;
              check(total <= 131072, 'Runner HTML response exceeded 128 KiB');
              body += decoder.decode(value, { stream: true });
            }
          }
          check(body.includes('TypeScript Lab isolated runner'), 'Unexpected runner HTML payload');
        } else if (kind === 'worker') {
          verifyHeader(response, 'content-type', 'javascript', label);
          verifyHeader(response, CSP, 'wasm-unsafe-eval', label);
          verifyHeader(response, CSP, "connect-src 'self'", label);
        } else if (kind === 'wasm') {
          verifyHeader(response, 'content-type', 'application/wasm', label);
        }
      }
    }
    results.push({ label, status: response.status, kind });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const phase = process.argv[2];
  runProbe(phase)
    .then((results) => {
      for (const entry of results) console.log(`PASS ${entry.label}: HTTP ${entry.status} (${entry.kind})`);
      console.log(`PASS ${phase}: ${results.length} read-only checks`);
    })
    .catch((error) => {
      console.error(`STOP ${phase ?? 'unknown'}: ${error.message}`);
      process.exitCode = 1;
    });
}
