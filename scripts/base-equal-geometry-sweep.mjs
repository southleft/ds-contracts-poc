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
        lib, stem, channel: g,
        observedOn: seen.map((a) => `${a}=${byAxis[a][g]}`).join(' '),
        missingOn: missing.join(','),
        base: t.base?.root?.style?.[g] ?? null,
      });
    }
  }
}
findings.sort((a, b) => (a.lib + a.stem).localeCompare(b.lib + b.stem));
console.log(JSON.stringify({ count: findings.length, findings }, null, 1));
