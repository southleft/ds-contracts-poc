
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
const file = process.argv[2];
const out = process.argv[3] || '/tmp/script-parts';
const CHUNK = Number(process.argv[4] || 8000);
const code = readFileSync(file, 'utf8');
mkdirSync(out, { recursive: true });
const n = Math.ceil(code.length / CHUNK);
for (let i = 0; i < n; i++) writeFileSync(path.join(out, i + '.json'), JSON.stringify(code.slice(i * CHUNK, (i + 1) * CHUNK)));
writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ file, n, total: code.length, chunk: CHUNK }));
console.log(JSON.stringify({ file, n, total: code.length }));
