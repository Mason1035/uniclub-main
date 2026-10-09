import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const directory = await mkdtemp(path.join(tmpdir(), 'classhub-random-call-tests-'));
try {
  await build({
    configFile: false, logLevel: 'error',
    build: { outDir: directory, emptyOutDir: true, minify: false,
      lib: { entry: path.resolve('test/randomCall.test.ts'), formats: ['es'], fileName: () => 'random-call.test.mjs' },
      rollupOptions: { external: id => id.startsWith('node:') },
    },
  });
  process.exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, ['--test', path.join(directory, 'random-call.test.mjs')], { stdio: 'inherit' });
    child.on('exit', code => resolve(code ?? 1));
    child.on('error', error => { console.error(error.message); resolve(1); });
  });
} finally { await rm(directory, { recursive: true, force: true }); }
