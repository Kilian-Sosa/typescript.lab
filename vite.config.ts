import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  // Do not read developer .env.local credentials into the isolated guest-only QA artifact.
  ...(mode === 'm3-hosted-qa' ? {
    envDir: false,
    define: {
      'import.meta.env.VITE_ENABLE_M3_QA_RUNNER': '"1"',
      'import.meta.env.VITE_RUNNER_ORIGIN': '"https://typescript-lab-m3-runner-qa.vercel.app"',
      'import.meta.env.VITE_SUPABASE_URL': 'undefined',
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
    },
  } : {}),
}));
