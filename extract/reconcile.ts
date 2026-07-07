/**
 * Reconciliation — the disagreement report (docs/11 Phase 1→2).
 *
 * Joins a code-side extraction with a design-side extraction and reports,
 * mechanically and exhaustively, where an org's own two surfaces disagree —
 * BEFORE any contract exists. This report is the first deliverable of
 * brownfield adoption: most design system teams have never seen this
 * document about their own system.
 *
 * Matching is deliberately transparent v0: names normalize by
 * lowercase-alphanumeric ("AccordionItem" ⇄ "Accordion Item"; "size" ⇄
 * "Size"); enum options match when normalized sets are equal, with common
 * abbreviation pairs (sm ⇄ Small…) resolved. Everything else is reported,
 * not guessed — a wrong auto-match would poison the contract it seeds.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeName } from './types.js';
import type { DesignComponent, ExtractedComponent } from './types.js';

// sm ⇄ Small etc. — the one mapping class common enough to resolve silently.
const ABBREV: Record<string, string> = {
  sm: 'small', md: 'medium', lg: 'large', xs: 'extrasmall', xl: 'extralarge',
};
const normValue = (v: string): string => {
  const n = normalizeName(v);
  return ABBREV[n] ?? n;
};

/** Alias set for a property name — the naming-divergence classes calibrated
 *  by running this tool against this repo's own (contract-generated, i.e.
 *  known-aligned) surfaces:
 *    isDismissable ⇄ Dismissable  (boolean is/has/show prefix)
 *    overflowLabel ⇄ Overflow     (design drops a trailing Label/Title/Text)
 *  Alias matches are reported with the mapping spelled out — transparent,
 *  never silent. */
const nameAliases = (name: string): Set<string> => {
  const n = normalizeName(name);
  const out = new Set([n]);
  const unprefixed = n.replace(/^(is|has|should|show)/, '');
  if (unprefixed.length > 2) out.add(unprefixed);
  const unsuffixed = n.replace(/(label|title|text)$/, '');
  if (unsuffixed.length > 2) out.add(unsuffixed);
  return out;
};
const aliasMatch = (a: string, b: string): boolean => {
  const as = nameAliases(a);
  for (const alias of nameAliases(b)) if (as.has(alias)) return true;
  return false;
};

export function loadDesign(source: string, root = process.cwd()): DesignComponent[] {
  if (source === 'parity-snapshot') {
    const snap = JSON.parse(
      readFileSync(path.join(root, 'parity', 'snapshots', 'figma-components.json'), 'utf8'),
    ) as { sets: { name: string; properties: Record<string, { type: string; variantOptions: string[] | null }> }[] };
    return snap.sets.map((s) => {
      const d: DesignComponent = { name: s.name, variantProps: {}, boolProps: [], textProps: [], swapProps: [] };
      for (const [raw, def] of Object.entries(s.properties)) {
        const name = raw.split('#')[0];
        if (def.type === 'VARIANT') d.variantProps[name] = def.variantOptions ?? [];
        else if (def.type === 'BOOLEAN') d.boolProps.push(name);
        else if (def.type === 'TEXT') d.textProps.push(name);
        else if (def.type === 'INSTANCE_SWAP') d.swapProps.push(name);
      }
      return d;
    });
  }
  const dump = JSON.parse(readFileSync(source, 'utf8')) as { components: DesignComponent[] };
  return dump.components;
}

type PropFinding =
  | { status: 'agree'; codeProp: string; designProp: string; detail?: string }
  | { status: 'options-differ'; codeProp: string; designProp: string; detail: string }
  | { status: 'code-only'; codeProp: string; detail: string }
  | { status: 'design-only'; designProp: string; detail: string };

export interface ComponentReconciliation {
  component: string;
  codeSource: string;
  designName: string;
  findings: PropFinding[];
}

export interface Reconciliation {
  matched: ComponentReconciliation[];
  codeOnly: { name: string; source: string }[];
  designOnly: string[];
  stats: { components: number; matched: number; propsAgree: number; propsDiffer: number };
}

export interface ReconcileOpts {
  /** Vendor prefix on code component names absent from design names —
   *  "sl" matches SlButton ⇄ Button. Reported when used, never silent. */
  stripCodePrefix?: string;
}

/** A design VARIANT axis whose options are exactly true/false is a boolean
 *  modeled the canvas way — an extremely common kit convention. */
const isBoolAxis = (options: string[]): boolean => {
  const set = new Set(options.map(normValue));
  return set.size === 2 && set.has('true') && set.has('false');
};

export function reconcile(
  codeSide: ExtractedComponent[],
  designSide: DesignComponent[],
  opts: ReconcileOpts = {},
): Reconciliation {
  const designByNorm = new Map(designSide.map((d) => [normalizeName(d.name), d]));
  const matched: ComponentReconciliation[] = [];
  const codeOnly: { name: string; source: string }[] = [];
  const usedDesign = new Set<string>();
  const prefix = opts.stripCodePrefix ? normalizeName(opts.stripCodePrefix) : null;

  for (const c of codeSide) {
    const norm = normalizeName(c.name);
    const d =
      designByNorm.get(norm) ??
      (prefix && norm.startsWith(prefix) ? designByNorm.get(norm.slice(prefix.length)) : undefined);
    if (!d) {
      codeOnly.push({ name: c.name, source: c.source });
      continue;
    }
    usedDesign.add(normalizeName(d.name));
    const findings: PropFinding[] = [];
    const claimedDesign = new Set<string>();

    for (const p of c.props) {
      if (p.kind === 'event') continue; // code-only by declared fidelity limit
      if (p.kind === 'node' || p.kind === 'other') continue; // slot/unclassified — proposal notes cover these
      const pn = normalizeName(p.name);
      const variantEntry = Object.entries(d.variantProps).find(([dn]) => normalizeName(dn) === pn);
      if (p.kind === 'enum' && variantEntry) {
        claimedDesign.add(variantEntry[0]);
        const codeSet = new Set((p.values ?? []).map(normValue));
        const designSet = new Set(variantEntry[1].map(normValue));
        const same = codeSet.size === designSet.size && [...codeSet].every((v) => designSet.has(v));
        findings.push(
          same
            ? { status: 'agree', codeProp: p.name, designProp: variantEntry[0] }
            : {
                status: 'options-differ',
                codeProp: p.name,
                designProp: variantEntry[0],
                detail: `code [${(p.values ?? []).join(', ')}] vs design [${variantEntry[1].join(', ')}]`,
              },
        );
        continue;
      }
      // Boolean code prop modeled as a true/false VARIANT axis in the kit
      if (p.kind === 'boolean') {
        const axisHit = Object.entries(d.variantProps).find(
          ([dn, options]) => aliasMatch(dn, p.name) && isBoolAxis(options),
        );
        if (axisHit) {
          claimedDesign.add(axisHit[0]);
          findings.push({
            status: 'agree',
            codeProp: p.name,
            designProp: axisHit[0],
            detail: `boolean modeled as a true/false variant axis in design (${p.name} ⇄ ${axisHit[0]})`,
          });
          continue;
        }
      }
      const boolHit = d.boolProps.find((dn) => aliasMatch(dn, p.name));
      if (p.kind === 'boolean' && boolHit) {
        claimedDesign.add(boolHit);
        findings.push({
          status: 'agree',
          codeProp: p.name,
          designProp: boolHit,
          ...(normalizeName(boolHit) !== pn ? { detail: `matched via alias rule (${p.name} ⇄ ${boolHit})` } : {}),
        });
        continue;
      }
      const textHit = d.textProps.find((dn) => aliasMatch(dn, p.name));
      if ((p.kind === 'string' || p.kind === 'number') && textHit) {
        claimedDesign.add(textHit);
        findings.push({
          status: 'agree',
          codeProp: p.name,
          designProp: textHit,
          ...(normalizeName(textHit) !== pn ? { detail: `matched via alias rule (${p.name} ⇄ ${textHit})` } : {}),
        });
        continue;
      }
      findings.push({
        status: 'code-only',
        codeProp: p.name,
        detail: `${p.kind}${p.values ? ` [${p.values.join(', ')}]` : ''} — no matching design property`,
      });
    }

    for (const [dn, options] of Object.entries(d.variantProps)) {
      if (!claimedDesign.has(dn)) {
        findings.push({ status: 'design-only', designProp: dn, detail: `variant [${options.join(', ')}] — no matching code prop` });
      }
    }
    for (const dn of d.boolProps) {
      if (!claimedDesign.has(dn) && !dn.startsWith('Show ')) {
        findings.push({ status: 'design-only', designProp: dn, detail: 'no matching code prop' });
      }
    }
    for (const dn of d.textProps) {
      if (!claimedDesign.has(dn)) {
        findings.push({
          status: 'design-only',
          designProp: dn,
          detail:
            'no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift',
        });
      }
    }
    matched.push({ component: c.name, codeSource: c.source, designName: d.name, findings });
  }

  const designOnly = designSide.filter((d) => !usedDesign.has(normalizeName(d.name))).map((d) => d.name);
  const all = matched.flatMap((m) => m.findings);
  return {
    matched,
    codeOnly,
    designOnly,
    stats: {
      components: codeSide.length,
      matched: matched.length,
      propsAgree: all.filter((f) => f.status === 'agree').length,
      propsDiffer: all.filter((f) => f.status !== 'agree').length,
    },
  };
}

export function reconciliationMarkdown(r: Reconciliation): string {
  const lines = [
    '# Reconciliation — where your two surfaces disagree',
    '',
    `**${r.stats.matched}/${r.stats.components}** code components matched a design component by name. Across matched pairs: **${r.stats.propsAgree}** properties agree, **${r.stats.propsDiffer}** need a human decision. Each disagreement below is a reconciliation-workshop line item: decide code-is-right, design-is-right, or neither — the decisions become contract v1 (docs/11 Phase 2).`,
    '',
  ];
  for (const m of r.matched) {
    const disagreements = m.findings.filter((f) => f.status !== 'agree');
    lines.push(`## ${m.component} ⇄ ${m.designName}`, '');
    lines.push(`- agrees on ${m.findings.length - disagreements.length}/${m.findings.length} properties`);
    for (const f of disagreements) {
      if (f.status === 'options-differ') lines.push(`- ⚠️ **${f.codeProp} / ${f.designProp}** — option sets differ: ${f.detail}`);
      else if (f.status === 'code-only') lines.push(`- ⚠️ **${f.codeProp}** — code only: ${f.detail}`);
      else if (f.status === 'design-only') lines.push(`- ⚠️ **${f.designProp}** — design only: ${f.detail}`);
    }
    lines.push('');
  }
  if (r.codeOnly.length > 0) {
    lines.push('## Components in code with no design counterpart', '', ...r.codeOnly.map((c) => `- ${c.name} (\`${c.source}\`)`), '');
  }
  if (r.designOnly.length > 0) {
    lines.push('## Components in design with no code counterpart', '', ...r.designOnly.map((n) => `- ${n}`), '');
  }
  return lines.join('\n');
}

export function writeReconciliation(r: Reconciliation, dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'reconciliation.json'), JSON.stringify(r, null, 2) + '\n');
  writeFileSync(path.join(dir, 'reconciliation.md'), reconciliationMarkdown(r) + '\n');
}
