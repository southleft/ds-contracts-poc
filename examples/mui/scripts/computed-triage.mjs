/**
 * MUI computed-floor triage driver — `node examples/mui/scripts/computed-triage.mjs <component>`
 *
 * The Astryx v7 driver's policy (family discipline, role ranks, axis-value
 * correlation, value-identical alphabetical acks, ledger-id exclusion)
 * retargeted at the MUI default-theme token families:
 *
 *   spacing channels        → spacing-*
 *   radius                  → shape-border-radius
 *   color/background        → palette-*   (role-ranked below)
 *   font size/weight/lh/ls  → font-<variant>-{size,weight,line-height,letter-spacing}
 *   shadow                  → shadows-*
 *   font-family             → font-family-*
 *
 * MUI's color AXIS VALUES are its palette names verbatim (primary, error,
 * success, …) so the axis-correlation tier needs no alias table. There is no
 * static-source tier: MUI ships Emotion runtime styles, the computed floor IS
 * the source evidence.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const comp = process.argv[2];
if (!comp) { console.error('usage: computed-triage.mjs <component-dir-name>'); process.exit(2); }
const dir = `extract/computed/out/mui/${comp}`;
const queue = JSON.parse(readFileSync(`${dir}/review-queue.json`, 'utf8'));
const items = Array.isArray(queue) ? queue : (queue.items ?? queue.queue ?? []);
let ledgered = new Set();
try {
  const d = JSON.parse(readFileSync(`${dir}/decisions.json`, 'utf8'));
  for (const dec of Array.isArray(d) ? d : (d.decisions ?? [])) for (const id of dec.ids ?? []) ledgered.add(id);
} catch { /* no ledger yet */ }
const open = items.filter((i) => i.status === 'open' && !ledgered.has(i.id));

const FAMILY = [
  [/^(gap|row-gap|column-gap|padding|margin|width|height|min-|max-|top|left|right|bottom)/, /^spacing-/],
  [/radius/, /^shape-border-radius$/],
  [/color|background/, /^palette-/],
  [/^font-size/, /^font-.*-size$/],
  [/^font-weight/, /^font-.*-weight$/],
  [/^line-height/, /^font-.*-line-height$/],
  [/^letter-spacing/, /^font-.*-letter-spacing$/],
  [/shadow/, /^shadows-/],
  [/^font-family/, /^font-family-/],
];
const familyOf = (channel) => FAMILY.find(([ch]) => ch.test(channel))?.[1] ?? null;

const ROLE_RANKS = {
  'background-color': [/^palette-(primary|secondary|error|warning|info|success)-main$/, /^palette-background-/, /^palette-action-/, /^palette-grey-/],
  'color': [/^palette-(primary|secondary|error|warning|info|success)-contrastText$/, /^palette-text-/, /^palette-(primary|secondary|error|warning|info|success)-main$/],
  'border-color': [/^palette-divider$/, /^palette-(primary|secondary|error|warning|info|success)-main$/],
};
const roleRankOf = (channel) =>
  ROLE_RANKS[channel] ?? (channel.includes('border') && channel.includes('color') ? ROLE_RANKS['border-color'] : null);

const LITERAL_OK = /^-?[\d.]+(px|rem|em|%)?$/;
const pickFor = (channel, candidates, observed) => {
  if (observed === '0px' && (candidates ?? []).includes('spacing-0')) return 'spacing-0';
  const fam = familyOf(channel);
  let pool = fam ? (candidates ?? []).filter((c) => fam.test(c)) : (candidates ?? []);
  // FAMILY DISCIPLINE: no in-family candidate + measurable observed → literal.
  if (pool.length === 0 && LITERAL_OK.test(observed)) return { literal: observed };
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const ranks = roleRankOf(channel);
  if (ranks) {
    for (const r of ranks) {
      const hits = pool.filter((c) => r.test(c));
      if (hits.length === 1) return hits[0];
      // value-identical tie → deterministic alphabetical ack, ledgered.
      if (hits.length > 1) return hits.sort()[0];
    }
  }
  return null;
};

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
  const toItems = {};
  let ok = true;
  for (const [observed, group] of byObserved) {
    const pick = pickFor(channel, group[0].candidates, observed);
    if (pick) { toMap[observed] = typeof pick === 'object' ? pick.literal : `{${pick}}`; continue; }
    const perItem = {};
    let allItems = true;
    for (const it of group) {
      // MUI's color-axis value IS the palette name — primary.contained → palette-primary-*.
      const axisVal = String(it.combo).split('.').find((v) => /^(primary|secondary|error|warning|info|success)$/.test(v));
      let hits = axisVal ? (it.candidates ?? []).filter((c) => c.includes(`-${axisVal}-`)) : [];
      if (hits.length === 0) {
        const ranks = roleRankOf(channel) ?? [];
        for (const r of ranks) {
          const rh = (it.candidates ?? []).filter((c) => r.test(c));
          if (rh.length > 0) { hits = [rh.sort()[0]]; break; }
        }
      }
      if (hits.length >= 1) perItem[it.id] = `{${hits.sort()[0]}}`;
      else { allItems = false; break; }
    }
    if (allItems && group.length > 0) { Object.assign(toItems, perItem); continue; }
    ok = false;
    leftNames.push(`${key} value "${observed}" — no unique ranked/per-axis pick of [${(group[0].candidates ?? []).join(', ')}]`);
    break;
  }
  if (!ok) { left += gis.length; continue; }
  const args = ['extract/computed/resolve.ts', '--dir', dir, '--apply', gis.map((i) => i.id).join(','), '--to-map', JSON.stringify(toMap), '--to-items', JSON.stringify(toItems), '--config', 'extract/computed/configs/mui.json'];
  const r = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8' });
  if (r.status === 0) applied += gis.length;
  else {
    left += gis.length;
    leftNames.push(`${key} — resolver refused: ${(r.stdout + r.stderr).split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 180)}`);
  }
}
console.log(`triage(${comp}): ${applied} applied, ${left} left open of ${open.length}`);
for (const n of leftNames.slice(0, 15)) console.log('  OPEN: ' + n);
