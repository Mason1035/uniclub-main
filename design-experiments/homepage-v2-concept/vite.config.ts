import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '.vite-cache',
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 5177, strictPort: true },
});
