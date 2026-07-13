// Chunk plan for the v1.6 full-kit capture: greedy fill by measured node count
// (roster.json from the enumeration pass), so every figma_execute stays well
// under its 30s ceiling. Usage: node plan-chunks.mjs <captureDir> [budget]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const budget = Number(process.argv[3] ?? 900); // nodes per chunk
const { roster } = JSON.parse(fs.readFileSync(path.join(dir, 'roster.json'), 'utf8'));

const chunks = [];
let cur = [];
let curNodes = 0;
for (const r of roster) {
  const n = Math.max(1, r.nodes);
  if (curNodes + n > budget && cur.length > 0) {
    chunks.push(cur);
    cur = [];
    curNodes = 0;
  }
  cur.push(r.id);
  curNodes += n;
}
if (cur.length > 0) chunks.push(cur);

fs.writeFileSync(path.join(dir, 'v16-chunk-plan.json'), JSON.stringify(chunks));
const totalNodes = roster.reduce((a, r) => a + Math.max(1, r.nodes), 0);
console.log(`plan: ${chunks.length} chunks over ${roster.length} entries / ${totalNodes} nodes (budget ${budget}/chunk)`);
console.log(chunks.map((c, i) => `${i}:${c.length}`).join(' '));
