import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const directory = await mkdtemp(path.join(tmpdir(), 'classhub-request-sharing-'));
try {
  await build({ configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"development"' }, build: {
    outDir: directory, emptyOutDir: true, minify: false,
    lib: { entry: path.resolve('test/requestSharing.test.ts'), formats: ['es'], fileName: () => 'request-sharing.test.mjs' },
    rollupOptions: { external: id => id.startsWith('node:') },
  } });
  process.exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, ['--test', path.join(directory, 'request-sharing.test.mjs')], { stdio: 'inherit' });
    child.on('exit', code => resolve(code ?? 1));
    child.on('error', error => { console.error(error.message); resolve(1); });
  });
} finally { await rm(directory, { recursive: true, force: true }); }
