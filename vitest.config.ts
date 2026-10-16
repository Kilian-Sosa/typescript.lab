import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'challenges/**/*.test.ts'],
    exclude: ['**/practice.test.ts', 'tests/e2e/**'],
  },
});
