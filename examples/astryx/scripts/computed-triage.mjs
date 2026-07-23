/**
 * Astryx computed-floor triage driver — `node examples/astryx/scripts/computed-triage.mjs <component>`
 *
 * Drives the REAL resolver (extract/computed/resolve.ts — every decision
 * ledgered with provenance) under a deterministic, documented ack policy.
 * Invocation unit = (part, channel): the resolver's whole-channel rule
 * (partial acks would self-contradict) is honored by naming EVERY open item
 * of the channel and passing per-observed-value targets via --to-map.
 *
 * Target policy per observed value, in order:
 *   1. candidates filtered to the channel's token FAMILY
 *      (spacing/radius/color/font families — see FAMILY below);
 *   2. color channels then rank by ROLE (background-color → semantic status
 *      names then color-background-*; text color → color-on-* then
 *      color-text-*; borders → color-border-*) — the delegated-ack
 *      preference, deterministic and documented here;
 *   3. exactly one survivor → its token; ties/empties → the WHOLE channel is
 *      left open by name (no guessing).
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const comp = process.argv[2];
if (!comp) { console.error('usage: computed-triage.mjs <component-dir-name>'); process.exit(2); }
const dir = `extract/computed/out/astryx/${comp}`;
const queue = JSON.parse(readFileSync(`${dir}/review-queue.json`, 'utf8'));
const items = Array.isArray(queue) ? queue : (queue.items ?? queue.queue ?? []);
// Exclude ledgered decisions (the resolver's alreadyResolved rule) — the
// queue file regenerates fully-open on every fresh capture run.
let ledgered = new Set();
try {
  const d = JSON.parse(readFileSync(`${dir}/decisions.json`, 'utf8'));
  for (const dec of Array.isArray(d) ? d : (d.decisions ?? [])) for (const id of dec.ids ?? []) ledgered.add(id);
} catch { /* no ledger yet */ }
const open = items.filter((i) => i.status === 'open' && !ledgered.has(i.id));

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

const ROLE_RANKS = {
  'background-color': [/^color-(neutral|accent|success|error|warning|highlight)$/, /^color-background-/],
  'color': [/^color-on-/, /^color-text-/],
  'border-color': [/^color-border-/],
};
const roleRankOf = (channel) =>
  ROLE_RANKS[channel] ?? (channel.includes('border') && channel.includes('color') ? ROLE_RANKS['border-color'] : null);

const pickFor = (channel, candidates) => {
  const fam = familyOf(channel);
  let pool = fam ? (candidates ?? []).filter((c) => fam.test(c)) : (candidates ?? []);
  if (pool.length === 0) pool = candidates ?? [];
  if (pool.length === 1) return pool[0];
  const ranks = roleRankOf(channel);
  if (ranks) {
    for (const r of ranks) {
      const hits = pool.filter((c) => r.test(c));
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) return null; // tie inside a rank — refuse
    }
  }
  return null;
};

// group by (part, channel)
const channels = new Map();
for (const i of open) {
  const key = `${i.part}|${i.channel}`;
  if (!channels.has(key)) channels.set(key, []);
  channels.get(key).push(i);
}

let applied = 0, left = 0;
const leftNames = [];
for (const [key, gis] of channels) {
  const channel = gis[0].channel;
  const byObserved = new Map();
  for (const i of gis) {
    if (!byObserved.has(i.observed)) byObserved.set(i.observed, []);
    byObserved.get(i.observed).push(i);
  }
  const toMap = {};
  let ok = true;
  for (const [observed, group] of byObserved) {
    const pick = pickFor(channel, group[0].candidates);
    if (!pick) { ok = false; leftNames.push(`${key} value "${observed}" — no unique ranked pick of [${(group[0].candidates ?? []).join(', ')}]`); break; }
    toMap[observed] = `{${pick}}`;
  }
  if (!ok) { left += gis.length; continue; }
  const args = ['extract/computed/resolve.ts', '--dir', dir, '--apply', gis.map((i) => i.id).join(','), '--to-map', JSON.stringify(toMap), '--config', 'extract/computed/configs/astryx.json'];
  const r = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8' });
  if (r.status === 0) applied += gis.length;
  else {
    left += gis.length;
    leftNames.push(`${key} — resolver refused: ${(r.stdout + r.stderr).split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 180)}`);
  }
}
console.log(`triage(${comp}): ${applied} applied, ${left} left open of ${open.length}`);
for (const n of leftNames.slice(0, 15)) console.log('  OPEN: ' + n);
