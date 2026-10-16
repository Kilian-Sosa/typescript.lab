import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['challenges/**/practice.test.ts'],
  },
});
