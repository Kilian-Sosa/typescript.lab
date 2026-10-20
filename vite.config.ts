import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const qa = mode === 'm3-hosted-qa';
  const mvp = mode === 'mvp-preview';
  if ((qa || mvp) && (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_TARGET_ENV !== 'preview')) {
    throw new Error((qa ? 'M3 QA' : 'MVP') + ' requires explicit Preview deployment metadata: VERCEL_ENV=preview and VERCEL_TARGET_ENV=preview.');
  }
  if (mvp && (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(process.env.VITE_SUPABASE_URL ?? '')
    || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))) {
    throw new Error('MVP Preview requires the explicitly configured public Supabase origin and publishable key.');
  }
  return {
    plugins: [vue()],
    // Preview builds read only explicitly provided public credentials, never developer .env.local.
    ...(qa || mvp ? { envDir: false } : {}),
    define: {
      // Only validated build metadata may enable the QA gate, never a public VITE_* override.
      'import.meta.env.VITE_M3_QA_DEPLOYMENT_ENV': qa ? '"preview"' : 'undefined',
      'import.meta.env.VITE_MVP_PREVIEW_DEPLOYMENT_ENV': mvp ? '"preview"' : 'undefined',
      'import.meta.env.VITE_ENABLE_MVP_PREVIEW_RUNNER': mvp ? '"1"' : 'undefined',
      ...(qa ? {
        'import.meta.env.VITE_ENABLE_M3_QA_RUNNER': '"1"',
        'import.meta.env.VITE_RUNNER_ORIGIN': '"https://typescript-lab-m3-runner-qa.vercel.app"',
        'import.meta.env.VITE_SUPABASE_URL': 'undefined',
        'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
      } : mvp ? {
        'import.meta.env.VITE_RUNNER_ORIGIN': '"https://typescript-lab-m3-runner-qa.vercel.app"',
      } : {}),
    },
  };
});
