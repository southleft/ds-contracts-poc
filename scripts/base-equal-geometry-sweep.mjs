/**
 * Sweep for the general form of the FAB defect: an axis value whose delta is
 * ABSENT because it equals the base capture, taking the whole channel down
 * with it — silently.
 *
 * For each captured stem: group capture keys by their first axis segment,
 * collect which geometry channels each group observes, and report a channel
 * that (a) is observed on SOME axis values, (b) is missing on at least one,
 * and (c) appears NOWHERE in the shipped contract or its extension ledger.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const GEO = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'];
const OUT = 'extract/computed/out';
const findings = [];

for (const lib of readdirSync(OUT).filter((d) => !d.startsWith('.'))) {
  const libDir = path.join(OUT, lib);
  for (const stem of readdirSync(libDir).filter((d) => !d.startsWith('.'))) {
    const ct = path.join(libDir, stem, 'captured-truth.json');
    if (!existsSync(ct)) continue;
    let t;
    try { t = JSON.parse(readFileSync(ct, 'utf8')); } catch { continue; }
    const caps = t.captures ?? [];
    if (!caps.length) continue;

    // axis value -> channel -> observed?
    const byAxis = {};
    for (const c of caps) {
      const axis = String(c.key ?? '').split('.')[0];
      if (!axis) continue;
      const d = (c.elements ?? [])[0]?.delta ?? {};
      byAxis[axis] ??= {};
      for (const g of GEO) if (d[g] !== undefined) byAxis[axis][g] = d[g];
    }
    const axes = Object.keys(byAxis);
    if (axes.length < 2) continue; // need a real axis to have a missing value

    const contractP = path.join('examples', lib, 'contracts', `${stem}.contract.json`);
    const extP = path.join('examples', lib, 'contracts', `${stem}.extension.json`);
    if (!existsSync(contractP)) continue;
    const contractTxt = readFileSync(contractP, 'utf8');
    const extTxt = existsSync(extP) ? readFileSync(extP, 'utf8') : '';

    for (const g of GEO) {
      const seen = axes.filter((a) => byAxis[a][g] !== undefined);
      const missing = axes.filter((a) => byAxis[a][g] === undefined);
      if (!seen.length || !missing.length) continue;
      const distinct = new Set(seen.map((a) => byAxis[a][g]));
      if (distinct.size < 1) continue;
      const inContract = contractTxt.includes(`"${g}"`);
      const inLedger = extTxt.includes(`"${g}"`);
      if (inContract || inLedger) continue; // carried or named — fine
      findings.push({
        fc: 'FC-BASE-EQUAL-GEOMETRY-DROPPED',
        lib, stem, channel: g,
        observedOn: seen.map((a) => `${a}=${byAxis[a][g]}`).join(' '),
        missingOn: missing.join(','),
        base: t.base?.root?.style?.[g] ?? null,
      });
    }
  }
}
findings.sort((a, b) => (a.lib + a.stem).localeCompare(b.lib + b.stem));
console.log(JSON.stringify({
  fc: 'FC-BASE-EQUAL-GEOMETRY-DROPPED',
  what: 'A geometry channel OBSERVED on some axis values, ABSENT on at least one other '
      + '(typically the value that equals BASE, which therefore contributes no delta), and present in '
      + 'NEITHER the shipped contract NOR the extension ledger. Captured, carried nowhere, named nowhere.',
  probe: 'node scripts/base-equal-geometry-sweep.mjs',
  pin: 'Each finding carries the observed per-axis values and the base value it was measured against. '
     + 'The exemplar is mui/fab: captured-truth /base/root/style = 56x56, deltas small 40x40 / medium 48x48, '
     + 'large ABSENT because large IS the base; the contract carries no width and no height, and '
     + 'fab.extension.json codeOnlyChannels holds only transition-behavior and vertical-align.',
  locus: 'INSIDE fuse — extract/computed/out/<lib>/<stem>/enriched.contract.json (fuse OWN output) already '
       + 'lacks the channel, so promote/curation is eliminated.',
  caveat: 'missingOn often includes the `unset` axis value, which equals base by construction, so a subset '
        + 'may be genuinely uniform channels that deserve a ledger line rather than a per-axis map. What is '
        + 'NOT in question is that none of these is carried OR named today.',
  count: findings.length,
  findings,
}, null, 1));
