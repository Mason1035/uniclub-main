import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [{ name: 'include-demo-font-license', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'assets/SpaceGrotesk-OFL.txt',
      source: readFileSync(new URL('./src/assets/fonts/OFL.txt', import.meta.url), 'utf8') });
  } }],
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  cacheDir: '.vite-cache',
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 9189, strictPort: true },
  build: { copyPublicDir: false },
});
