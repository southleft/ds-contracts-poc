/**
 * The benchmark scoreboard in the docs is GENERATED from benchmark/pins, never
 * typed: `npm run benchmark:doc` rewrites the table between
 *   <!-- benchmark:begin -->  and  <!-- benchmark:end -->
 * in every document listed below; `npm run benchmark:doc:check` fails when a
 * document's table differs from what the pins say. A cell is described from
 * its pin and committed receipt only (the replay itself is benchmark:check).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge, readAllCells, readPin, type Status } from './benchmark-replay.js';
import { judgeReact, readReactPin } from './benchmark-react-native.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCUMENTS = ['docs/PREVIEW.md'];
const BEGIN = '<!-- benchmark:begin -->', END = '<!-- benchmark:end -->';
const label: Record<Status, string> = { green: 'Pass', partial: 'Partial (text only)', 'known-failure': 'Known failure', stale: 'Not yet re-scored', red: 'Failing' };

export function scoreboard(root = repoRoot): string {
  const rows = readAllCells(root).map(cell => {
    let v: { status: Status; reason: string; summary?: string };
    let scope = '', direction = 'Figma → React';
    if (cell.kind === 'react-to-native') {
      direction = 'React → Figma';
      const pin = readReactPin(root, cell.id);
      v = pin ? judgeReact(cell, pin, { referenceId: pin.referenceId, result: { caseId: cell.caseId, ...(pin.refusal ? { refusal: pin.refusal } : {}),
        ...(pin.root ? { root: { kind: 'pinned', planSha256: pin.root } } : {}),
        children: Object.entries(pin.children).map(([instanceId, c]) => ({ instanceId, exportName: c.exportName, ...(c.planSha256 ? { planSha256: c.planSha256 } : {}), ...(c.refusal ? { refusal: c.refusal } : {}) })) } })
        : { status: 'red', reason: 'no pin' };
    } else {
      const pin = readPin(root, cell.id);
      v = pin ? judge(cell, pin, { inputSha256: pin.inputSha256, requestSha256: pin.requestSha256, rootId: pin.rootId, generated: pin.generated, entries: pin.entries })
        : { status: 'red', reason: 'no pin' };
      scope = cell.scope.outOfScope.length ? ` Out of scope: ${cell.scope.outOfScope.map(o => o.reason).join('; ')}.` : '';
    }
    const detail = v.summary ?? v.reason;
    return `| ${cell.row} | ${direction} | **${label[v.status]}** | ${detail.replace(/\|/g, '\\|')}.${scope} |`;
  });
  return [BEGIN,
    '| Component | Direction | Result | Measured |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '_Generated from `benchmark/pins` by `npm run benchmark:doc`. Every row is replayed from its frozen input on every push (`npm run benchmark:check`). Images are compared with the unchanged 5% limit on white and black; text-only overages are reported as partials, never as passes._',
    END].join('\n');
}

export function render(text: string, table: string): string {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < a) throw Error('benchmark-doc-markers-missing');
  return text.slice(0, a) + table + text.slice(b + END.length);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const table = scoreboard(), stale: string[] = [];
  for (const doc of DOCUMENTS) {
    const file = path.join(repoRoot, doc), text = readFileSync(file, 'utf8'), next = render(text, table);
    if (process.argv.includes('--check')) { if (next !== text) stale.push(doc); }
    else if (next !== text) { writeFileSync(file, next); console.log('updated ' + doc); }
  }
  if (stale.length) { console.error(`✖ benchmark scoreboard out of date in ${stale.join(', ')} — run npm run benchmark:doc`); process.exit(1); }
  if (process.argv.includes('--check')) console.log('✔ every benchmark scoreboard matches the pins');
}
