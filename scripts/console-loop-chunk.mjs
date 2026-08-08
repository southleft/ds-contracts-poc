#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const file = process.argv[2];
const out = process.argv[3] || '/tmp/script-parts';
const CHUNK = Number(process.argv[4] || 8000);
if (!file) {
  console.error('usage: console-loop-chunk.mjs <script.js> [outDir] [chunkSize]');
  process.exit(2);
}
const code = readFileSync(file, 'utf8');
mkdirSync(out, { recursive: true });
const n = Math.ceil(code.length / CHUNK);
for (let i = 0; i < n; i++) {
  writeFileSync(path.join(out, `${i}.json`), JSON.stringify(code.slice(i * CHUNK, (i + 1) * CHUNK)));
}
writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ file, n, total: code.length, chunk: CHUNK }, null, 2));
console.log(JSON.stringify({ file, n, total: code.length }));
