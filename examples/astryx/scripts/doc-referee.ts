/**
 * The `.doc.mjs` referee — `npx tsx examples/astryx/scripts/doc-referee.ts`
 *
 * Astryx ships vendor-authored, machine-readable per-component docs
 * (`<Name>.doc.mjs`: a props table + an anatomy table) in the same npm
 * package the contracts were extracted from — an INDEPENDENT WITNESS this
 * pipeline has never had. This script diffs Meta's own props tables against
 * our proposed contracts for the 24-component census set and writes
 * `extraction/DOC-REFEREE.md`.
 *
 * Refereeing rules (their doc wins nothing automatically):
 *   · every doc prop is matched against our contract props AND events
 *   · enum value sets compare only when the doc type is a pure
 *     quoted-literal union; defaults compare unquoted
 *   · a doc prop we do NOT carry must be RECEIPTED on our side (node →
 *     slot candidate, non-on* function → manual review, platform prop,
 *     `other` → unclassified) — a doc prop we never even saw is a SILENT
 *     LOSS and fails the run
 *   · a contract prop the doc does not list is a finding TOO (the witness
 *     may be behind its own source — every disagreement is named, both ways)
 *   · the doc ANATOMY table is recorded verbatim as the seed for the
 *     human-owned anatomy step (StyleX ships no CSS-module channel, so our
 *     proposals carry no anatomy to diff yet)
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');
const SRC = path.join(EX, '.astryx-sandbox/node_modules/@astryxdesign/core/src');
const CONTRACTS = path.join(EX, 'extraction/static-contracts');
const OUT = path.join(EX, 'out');

const CENSUS = [
  'Button', 'CheckboxInput', 'Switch', 'Badge', 'Tooltip', 'Dialog', 'MoreMenu', 'TabList',
  'CollapsibleGroup', 'Table', 'TextInput', 'Typeahead', 'Toast', 'Pagination', 'Breadcrumbs',
  'Avatar', 'Card', 'Popover', 'ProgressBar', 'Slider', 'Token', 'Banner', 'Skeleton', 'Link',
];
const RESERVED = new Set(['children', 'className', 'style', 'ref', 'key', 'id']);
const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

interface DocProp {
  name: string;
  type?: string;
  description?: string;
  default?: string;
  required?: boolean;
}
interface DocModule {
  docs: {
    name: string;
    props?: DocProp[];
    usage?: { anatomy?: { name: string; required?: boolean; description?: string }[] };
  };
}

/** Find `<Name>.doc.mjs` anywhere under src (dir name may differ from component name). */
function docPath(name: string): string | null {
  for (const dir of readdirSync(SRC, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const p = path.join(SRC, dir.name, `${name}.doc.mjs`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Parse a pure quoted-literal union type string into its values, or null. */
function literalUnionValues(type: string | undefined): string[] | null {
  if (!type) return null;
  const parts = type.split('|').map((p) => p.trim()).filter(Boolean);
  const values: string[] = [];
  for (const p of parts) {
    const m = p.match(/^'([^']*)'$/);
    if (!m) return null;
    values.push(m[1]);
  }
  return values.length > 1 ? values : null;
}

const unquote = (v: unknown): string => String(v).replace(/^'(.*)'$/, '$1');

interface Finding {
  component: string;
  prop: string;
  kind: string;
  detail: string;
}

const extraction = JSON.parse(readFileSync(path.join(OUT, 'code-extraction.json'), 'utf8')) as {
  name: string;
  props: { name: string; kind: string }[];
  notes?: string[];
}[];
const extractionByName = new Map(extraction.map((c) => [c.name, c]));

const agreements: Finding[] = [];
const disagreements: Finding[] = [];
const anatomySeeds: { component: string; parts: string[] }[] = [];
let comparedProps = 0;

for (const name of CENSUS) {
  const dp = docPath(name);
  if (!dp) {
    disagreements.push({ component: name, prop: '—', kind: 'NO-DOC', detail: 'no <Name>.doc.mjs shipped for this component' });
    continue;
  }
  const mod = (await import(pathToFileURL(dp).href)) as DocModule;
  const docProps = mod.docs.props ?? [];
  const anatomy = mod.docs.usage?.anatomy ?? [];
  if (anatomy.length > 0) {
    anatomySeeds.push({
      component: name,
      parts: anatomy.map((a) => `${a.name}${a.required ? ' (required)' : ''}`),
    });
  }
  const contract = JSON.parse(readFileSync(path.join(CONTRACTS, `${kebab(name)}.contract.json`), 'utf8')) as {
    props: { name: string; type: unknown; default?: unknown; required?: boolean }[];
    events?: { name: string; bindings?: { code?: { prop?: string } } }[];
  };
  const ourProps = new Map(contract.props.map((p) => [p.name, p]));
  const ourEvents = new Map((contract.events ?? []).map((e) => [e.bindings?.code?.prop ?? `on${e.name}`, e]));
  const ex = extractionByName.get(name);
  const exKinds = new Map((ex?.props ?? []).map((p) => [p.name, p.kind]));

  for (const dprop of docProps) {
    comparedProps++;
    const ours = ourProps.get(dprop.name);
    if (ours) {
      const issues: string[] = [];
      const docEnum = literalUnionValues(dprop.type);
      const ourEnum = (ours.type as { enum?: string[] })?.enum;
      if (docEnum && ourEnum) {
        const missing = docEnum.filter((v) => !ourEnum.includes(v));
        const extra = ourEnum.filter((v) => !docEnum.includes(v));
        if (missing.length > 0) issues.push(`doc enum values we DON'T carry: [${missing.join(', ')}]`);
        if (extra.length > 0) issues.push(`our enum values the doc DOESN'T list: [${extra.join(', ')}]`);
      } else if (docEnum && !ourEnum) {
        issues.push(`doc types it as an enum (${docEnum.length} values) — we carry kind '${String(exKinds.get(dprop.name))}'`);
      } else if (!docEnum && ourEnum) {
        issues.push(`we carry an enum (${ourEnum.length} values) — doc types it "${dprop.type ?? '?'}"`);
      }
      if (dprop.default !== undefined || ours.default !== undefined) {
        const dv = dprop.default !== undefined ? unquote(dprop.default) : undefined;
        const ov = ours.default !== undefined ? String(ours.default) : undefined;
        if (dv !== ov) issues.push(`default: doc says ${dv ?? '(none)'}, we carry ${ov ?? '(none)'}`);
      }
      const docRequired = dprop.required === true;
      const ourRequired = ours.required === true;
      if (docRequired !== ourRequired) {
        issues.push(`required: doc says ${docRequired}, we carry ${ourRequired}${!ourRequired && docRequired ? ' (contract schema flags required only on text props — structural, review)' : ''}`);
      }
      if (issues.length === 0) {
        agreements.push({ component: name, prop: dprop.name, kind: 'AGREE', detail: 'type/default/required agree' });
      } else {
        for (const i of issues) disagreements.push({ component: name, prop: dprop.name, kind: 'DISAGREE', detail: i });
      }
      continue;
    }
    if (ourEvents.has(dprop.name)) {
      agreements.push({ component: name, prop: dprop.name, kind: 'AGREE-EVENT', detail: 'carried as a contract event' });
      continue;
    }
    // Not carried — must be receipted on our side, never silent.
    const exKind = exKinds.get(dprop.name);
    if (RESERVED.has(dprop.name)) {
      agreements.push({ component: name, prop: dprop.name, kind: 'RECEIPTED', detail: 'platform prop — excluded by the shared exclusion list' });
    } else if (exKind === 'node') {
      agreements.push({ component: name, prop: dprop.name, kind: 'RECEIPTED', detail: 'ReactNode — receipted as a slot candidate (anatomy step)' });
    } else if (exKind === 'event') {
      agreements.push({ component: name, prop: dprop.name, kind: 'RECEIPTED', detail: 'function-typed but not on* — receipted for manual review' });
    } else if (exKind === 'other') {
      disagreements.push({ component: name, prop: dprop.name, kind: 'NOT-CARRIED', detail: `doc types it "${dprop.type ?? '?'}" — we saw it but classified 'other' (receipted); the doc says it is real API` });
    } else if (exKind) {
      disagreements.push({ component: name, prop: dprop.name, kind: 'NOT-CARRIED', detail: `extracted kind '${exKind}' did not land in the contract` });
    } else {
      // Never seen by extraction. Three possibilities, told apart honestly:
      //   1. the prop IS in the component source file → we missed it: a
      //      SILENT LOSS — refuse to write the report;
      //   2. the component carries an outside-scope receipt (heritage /
      //      composed refs) → the omission is named, not silent;
      //   3. the prop is NOT in the shipped source file at all → the vendor
      //      doc documents a surface beyond the declared props interface
      //      (e.g. Toast's imperative `toast()` options) — a named finding
      //      about the WITNESS, either way.
      const srcText = ex ? readFileSync(path.join(process.cwd(), ex.source), 'utf8') : '';
      const inSource = new RegExp(`(['"]?)${dprop.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\??:`).test(srcText);
      const outsideScope = (ex?.notes ?? []).some(
        (n) => n.includes('outside single-file extraction') || n.includes('outside module scope'),
      );
      if (inSource && !outsideScope) {
        throw new Error(`${name}.${dprop.name}: in the vendor doc AND in the shipped source but NEVER SEEN by extraction — SILENT LOSS, refusing to write the report`);
      }
      if (outsideScope) {
        agreements.push({
          component: name,
          prop: dprop.name,
          kind: 'RECEIPTED',
          detail: 'outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives',
        });
      } else {
        disagreements.push({
          component: name,
          prop: dprop.name,
          kind: 'DOC-BEYOND-INTERFACE',
          detail: `the vendor doc documents it (type "${dprop.type ?? '?'}") but the shipped component file declares no such prop — the doc covers a different surface (imperative options?) or is ahead of the source`,
        });
      }
    }
  }
  // Reverse direction: contract props the doc does not list.
  const docNames = new Set(docProps.map((p) => p.name));
  for (const p of contract.props) {
    if (!docNames.has(p.name)) {
      disagreements.push({ component: name, prop: p.name, kind: 'DOC-MISSING', detail: 'in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source' });
    }
  }
  for (const [propName] of ourEvents) {
    if (!docNames.has(propName)) {
      disagreements.push({ component: name, prop: propName, kind: 'DOC-MISSING', detail: 'contract event not in the vendor doc props table' });
    }
  }
}

// ---- report ----
const lines: string[] = [];
lines.push('# The `.doc.mjs` referee — vendor docs vs our proposals (census set)');
lines.push('');
lines.push('Meta ships a machine-readable props+anatomy table per component INSIDE');
lines.push('`@astryxdesign/core@0.1.6` — an independent witness. This report diffs it');
lines.push('against `static-contracts/` (our mechanical proposals). **Neither side wins');
lines.push('automatically**: every disagreement is a named finding either way.');
lines.push('Regenerate: `npx tsx examples/astryx/scripts/doc-referee.ts` (fails the run');
lines.push('on any silent loss — a doc prop extraction never saw).');
lines.push('');
const receipted = agreements.filter((a) => a.kind === 'RECEIPTED').length;
const agree = agreements.length - receipted;
lines.push('## Verdict');
lines.push('');
lines.push(`- **${comparedProps} vendor-documented props** compared across ${CENSUS.length} census components`);
lines.push(`- **${agree} agree** (type/default/required, or carried as a contract event)`);
lines.push(`- **${receipted} not carried BY RECEIPT** (platform props, slot candidates → anatomy step, non-on* functions) — the vendor doc confirms each receipt points at something real`);
lines.push(`- **${disagreements.length} named disagreements** (every one listed below)`);
lines.push(`- **0 silent losses** — every vendor-documented prop was either carried or receipted (the run refuses to write otherwise)`);
lines.push('');
lines.push('## Named disagreements');
lines.push('');
lines.push('| component | prop | class | detail |');
lines.push('|---|---|---|---|');
for (const f of disagreements) {
  lines.push(`| ${f.component} | \`${f.prop}\` | ${f.kind} | ${f.detail} |`);
}
lines.push('');
lines.push('## Agreements and receipts');
lines.push('');
lines.push('| component | prop | class | detail |');
lines.push('|---|---|---|---|');
for (const f of agreements) {
  lines.push(`| ${f.component} | \`${f.prop}\` | ${f.kind} | ${f.detail} |`);
}
lines.push('');
lines.push('## Vendor anatomy tables (the human-owned anatomy seed)');
lines.push('');
lines.push('Our StyleX-side proposals carry no anatomy (no CSS-module channel); the');
lines.push('vendor doc ships one per component. Recorded verbatim as the seed for the');
lines.push('anatomy step and the computed-floor round (Phase A-2):');
lines.push('');
for (const a of anatomySeeds) {
  lines.push(`- **${a.component}**: ${a.parts.join(' · ')}`);
}
lines.push('');
writeFileSync(path.join(EX, 'extraction/DOC-REFEREE.md'), lines.join('\n'));
console.log(
  `✔ doc-referee: ${comparedProps} vendor props compared — ${agree} agree, ${receipted} receipted, ${disagreements.length} named disagreements, 0 silent — → examples/astryx/extraction/DOC-REFEREE.md`,
);
