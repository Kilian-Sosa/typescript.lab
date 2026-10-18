import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const qa = mode === 'm3-hosted-qa';
  if (qa && (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_TARGET_ENV !== 'preview')) {
    throw new Error('M3 QA requires explicit Preview deployment metadata: VERCEL_ENV=preview and VERCEL_TARGET_ENV=preview.');
  }
  return {
    plugins: [vue()],
    // Do not read developer .env.local credentials into the isolated guest-only QA artifact.
    ...(qa ? { envDir: false } : {}),
    define: {
      // Only validated build metadata may enable the QA gate, never a public VITE_* override.
      'import.meta.env.VITE_M3_QA_DEPLOYMENT_ENV': qa ? '"preview"' : 'undefined',
      ...(qa ? {
        'import.meta.env.VITE_ENABLE_M3_QA_RUNNER': '"1"',
        'import.meta.env.VITE_RUNNER_ORIGIN': '"https://typescript-lab-m3-runner-qa.vercel.app"',
        'import.meta.env.VITE_SUPABASE_URL': 'undefined',
        'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
      } : {}),
    },
  };
});
