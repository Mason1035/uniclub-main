import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'temp'),
  base: '/temp/',
  publicDir: path.resolve(__dirname, 'public/temp'),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: path.resolve(__dirname, 'dist-temp'), emptyOutDir: true, assetsDir: 'static' },
  server: { host: '127.0.0.1', port: 8082, strictPort: true, fs: { allow: [__dirname] } },
  preview: { host: '127.0.0.1', port: 8082, strictPort: true },
});
