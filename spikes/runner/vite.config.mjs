import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: '.dist',
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
  },
});
