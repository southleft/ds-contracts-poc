/**
 * Visual-parity subject anchors must not silently drift from the contract.
 *
 *   npx tsx extract/figma/visual-parity/anchor-check.ts
 *
 * File-lag (same node id, different file) is named: the catalog instrument
 * may score the MAIN POC copy while the contract points at the live restamp
 * file. Node-lag is a defect — we would be scoring a different set than the
 * contract claims (Switch 11:1286 vs 4:618 was the receipted case).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PARITY_SUBJECTS } from './subjects.js';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);

interface FigmaAnchor {
  fileKey?: string | null;
  nodeId?: string | null;
}

const failures: string[] = [];
const notes: string[] = [];

for (const subject of PARITY_SUBJECTS) {
  if (subject.kind !== 'contract') continue;
  const file = path.join(ROOT, 'contracts', `${subject.contractId.replace(/^ds\./, '')}.contract.json`);
  let raw: { id?: string; bindings?: { figma?: { anchors?: FigmaAnchor } } };
  try {
    raw = JSON.parse(readFileSync(file, 'utf8')) as { id?: string; bindings?: { figma?: { anchors?: FigmaAnchor } } };
  } catch {
    // catalog ids are ds.button → contracts/button.contract.json; some ids
    // do not map 1:1. Fall back to scanning by id.
    const guess = path.join(ROOT, 'contracts', `${subject.id}.contract.json`);
    raw = JSON.parse(readFileSync(guess, 'utf8')) as { id?: string; bindings?: { figma?: { anchors?: FigmaAnchor } } };
  }
  if (raw.id && raw.id !== subject.contractId) {
    failures.push(`${subject.id}: opened ${file} but contract id is ${raw.id}, expected ${subject.contractId}`);
    continue;
  }
  const anchor = raw.bindings?.figma?.anchors;
  if (!anchor?.fileKey || !anchor.nodeId) {
    failures.push(`${subject.id}: contract ${subject.contractId} has no figma fileKey/nodeId`);
    continue;
  }
  const fileLag = subject.fileKey !== anchor.fileKey;
  const nodeLag = subject.setNodeId !== anchor.nodeId;
  if (nodeLag) {
    failures.push(
      `${subject.id}: NODE-LAG subject ${subject.fileKey}/${subject.setNodeId} vs contract ${anchor.fileKey}/${anchor.nodeId} — the gate would score a different set than the contract claims`,
    );
  } else if (fileLag) {
    notes.push(
      `${subject.id}: file-lag subject ${subject.fileKey} vs contract ${anchor.fileKey} (node ${anchor.nodeId} shared) — catalog copy vs live restamp`,
    );
  } else {
    notes.push(`${subject.id}: subject ≡ contract ${anchor.fileKey}/${anchor.nodeId}`);
  }
}

for (const n of notes) console.log(`  · ${n}`);
if (failures.length > 0) {
  console.error(`\n✘ visual-parity-anchors: ${failures.length} node-lag(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ visual-parity-anchors: no node-lag; file-lag is named above');
