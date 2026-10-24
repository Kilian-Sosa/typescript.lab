import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { deploymentPolicy } from './deployment.ts';
import { dirname, resolve } from 'node:path';
import { validateProductionEnvironment } from '../../shared/deployment/production.ts';

export default defineConfig(({ mode, command }) => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const production = mode === 'mvp-production';
  if (!production && (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_TARGET_ENV === 'production')) {
    throw new Error('Production runner builds require the dedicated mvp-production mode.');
  }
  if (production && command !== 'build') throw new Error('MVP Production runner is a build-only mode.');
  const productionPolicy = production ? validateProductionEnvironment(process.env, false) : null;
  // Never call loadEnv in Production: envDir alone cannot disable this explicit read.
  const env: Record<string, string | undefined> = production ? {} : { ...loadEnv(mode, root, ''), ...process.env };
  const policy = deploymentPolicy(
    productionPolicy?.app ?? env.VITE_RUNNER_PARENT_ORIGIN,
    productionPolicy?.runner ?? env.VITE_RUNNER_ORIGIN,
    env.LAB_RUNNER_LOCAL_TEST === '1',
  );
  let output = fileURLToPath(new URL('.vercel/output/', import.meta.url));
  return {
    root,
    ...(production ? { envDir: false, envPrefix: [] } : {}),
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
        configResolved(config) {
          output = dirname(resolve(config.root, config.build.outDir));
        },
        closeBundle() {
          const headers = (csp: string) => ({
            'Content-Security-Policy': csp,
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            ...(production ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
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
