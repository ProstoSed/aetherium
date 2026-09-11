// Запускает TypeScript-файл из src без отдельного компилятора: esbuild уже стоит вместе с Vite.
// Запуск: node tools/run-ts.mjs tests/physics.check.ts
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const entry = process.argv[2];
const dir = mkdtempSync(path.join(tmpdir(), 'astra-ts-'));
const outfile = path.join(dir, 'bundle.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error' });
try {
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
