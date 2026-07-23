/**
 * Astryx computed-floor triage driver — `node examples/astryx/scripts/computed-triage.mjs <component>`
 *
 * Applies the delegated-ack resolution pass over review-queue.json through
 * the REAL resolver (extract/computed/resolve.ts — every decision lands in
 * the decisions ledger with provenance). Policy, deterministic and named:
 *   1. group items by (part, channel, observed);
 *   2. candidate tokens are filtered by the channel's token FAMILY
 *      (gap/padding/size → spacing-*, radius → radius-*, colors → color-*,
 *      font-size → font-size or text-size families, weight → font-weight-*,
 *      line-height → text-*-leading, shadow → shadow-*, family → font-family-*);
 *   3. exactly ONE family candidate → apply with --to;
 *      zero family candidates but ONE overall → let the resolver's own
 *      unique-candidate rule decide (no --to);
 *      anything else → LEFT OPEN, reported by name (no guessing).
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const comp = process.argv[2];
if (!comp) { console.error('usage: computed-triage.mjs <component-dir-name>'); process.exit(2); }
const dir = `extract/computed/out/${comp}`;
const queue = JSON.parse(readFileSync(`${dir}/review-queue.json`, 'utf8'));
const items = Array.isArray(queue) ? queue : (queue.items ?? queue.queue ?? []);
const open = items.filter((i) => i.status === 'open');

const FAMILY = [
  [/^(gap|row-gap|column-gap|padding|margin|width|height|min-|max-|top|left|right|bottom)/, /^spacing-|^size-/],
  [/radius/, /^radius-/],
  [/color|background/, /^color-/],
  [/^font-size/, /^font-size-|^text-.*-size$/],
  [/^font-weight/, /^font-weight-/],
  [/^line-height/, /^text-.*-leading$|^leading-/],
  [/shadow/, /^shadow-/],
  [/^font-family/, /^font-family-/],
  [/^transition-duration|^animation-duration/, /^duration-/],
  [/^transition-timing|^animation-timing/, /^ease-/],
];
const familyOf = (channel) => FAMILY.find(([ch]) => ch.test(channel))?.[1] ?? null;

const groups = new Map();
for (const i of open) {
  const key = `${i.part}|${i.channel}|${i.observed}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(i);
}

let applied = 0, left = 0;
const leftNames = [];
for (const [key, gis] of groups) {
  const { channel, candidates } = gis[0];
  const fam = familyOf(channel);
  const famCands = fam ? (candidates ?? []).filter((c) => fam.test(c)) : [];
  let to = null;
  if (famCands.length === 1) to = famCands[0];
  else if (famCands.length === 0 && (candidates ?? []).length === 1) to = null; // resolver's unique rule
  else { left += gis.length; leftNames.push(`${key} — family candidates [${famCands.join(', ')}] of [${(candidates ?? []).join(', ')}]`); continue; }
  const args = ['extract/computed/resolve.ts', '--dir', dir, '--apply', gis.map((i) => i.id).join(','), '--config', 'extract/computed/configs/astryx.json'];
  if (to) args.push('--to', `{${to}}`);
  const r = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8' });
  if (r.status === 0) { applied += gis.length; }
  else {
    left += gis.length;
    leftNames.push(`${key} — resolver refused: ${(r.stdout + r.stderr).split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 160)}`);
  }
}
console.log(`triage(${comp}): ${applied} applied, ${left} left open of ${open.length}`);
for (const n of leftNames.slice(0, 20)) console.log('  OPEN: ' + n);
