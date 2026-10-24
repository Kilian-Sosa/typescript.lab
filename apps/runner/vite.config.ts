import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { deploymentPolicy } from './deployment.ts';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const policy = deploymentPolicy(
    env.VITE_RUNNER_PARENT_ORIGIN,
    env.VITE_RUNNER_ORIGIN,
    env.LAB_RUNNER_LOCAL_TEST === '1',
  );
  const output = fileURLToPath(new URL('.vercel/output/', import.meta.url));
  return {
    root,
    base: '/',
    define: {
      'import.meta.env.VITE_RUNNER_PARENT_ORIGIN': JSON.stringify(policy.parent),
      'import.meta.env.VITE_RUNNER_ORIGIN': JSON.stringify(policy.runner),
    },
    worker: { format: 'es' },
    build: { target: 'es2022', outDir: '.vercel/output/static', emptyOutDir: true, sourcemap: false },
    plugins: [
      {
        name: 'runner-response-headers',
        closeBundle() {
          const headers = (csp: string) => ({
            'Content-Security-Policy': csp,
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          });
          mkdirSync(output, { recursive: true });
          writeFileSync(
            `${output}/config.json`,
            JSON.stringify(
              {
                version: 3,
                routes: [
                  { src: '/assets/worker-[^/]+\\.js', headers: headers(policy.worker), continue: true },
                  { src: '/(?!assets/worker-[^/]+\\.js$).*', headers: headers(policy.page), continue: true },
                  { handle: 'filesystem' },
                ],
              },
              null,
              2,
            ),
          );
        },
      },
    ],
  };
});
