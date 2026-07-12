/**
 * CODE→CONTRACT round-trip receipt — `npx tsx extract/roundtrip-code.ts`.
 *
 * This repo's own src/components/ are GENERATED from contracts, which makes
 * them a perfect executable ground truth for the anatomy extractor: extract
 * Badge, Switch, Card back out of the generated source and compare the
 * proposed contracts to the shipping ones, field by field. Every comparison
 * lands in exactly one bucket:
 *
 *   MATCHED      — the proposal recovered the contract's field (after the
 *                  documented normalizations below)
 *   CODE-ABSENT  — the field genuinely does not exist in code (figma
 *                  bindings, canvas defaults of required text props, slot
 *                  figma properties/constraints, prose descriptions,
 *                  governance fields) — LISTED, never waved through
 *   MISMATCH     — extraction got it wrong. The bar is ZERO.
 *
 * Normalizations (each one is an inversion of a deterministic generator
 * rule, not a fudge — see scripts/generate-components.ts):
 *   N1  root without `layout` ≡ layout {display:inline-flex, align:center,
 *       justify:center} (the generator's default root layout)
 *   N2  structural parts: `display` defaults to flex on both sides
 *   N3  `text: ""` ≡ no text (both render an empty element)
 *   N4  a component ref's `text` equal to the child contract's children
 *       default ≡ no text override (the generator bakes the default in)
 *   N5  part `element` defaults: span for content/text parts, div otherwise
 *
 * Output: verdict table on stdout + extract/ROUNDTRIP-CODE.md (committed).
 * Exit 1 on any MISMATCH.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { extractReactTsx } from './adapters/react-tsx.js';
import { proposeContract } from './propose.js';

const ROOT = process.cwd();
const TRIO = ['badge', 'switch', 'card'];

type Verdict = 'MATCHED' | 'CODE-ABSENT' | 'MISMATCH';
interface Finding {
  component: string;
  subject: string;
  verdict: Verdict;
  detail: string;
}
const findings: Finding[] = [];
const add = (component: string, subject: string, verdict: Verdict, detail: string) =>
  findings.push({ component, subject, verdict, detail });

// ---------------------------------------------------------------------------
// Shipping contracts (ground truth) + child-default lookup for N4
// ---------------------------------------------------------------------------

type Json = Record<string, any>;
const loadContract = (id: string): Json =>
  JSON.parse(readFileSync(path.join(ROOT, 'contracts', `${id.replace(/^[^.]+\./, '')}.contract.json`), 'utf8'));

function childrenDefault(contractId: string): string | undefined {
  try {
    const c = loadContract(contractId);
    const p = (c.props as Json[]).find((x) => x.type === 'text' && x.bindings?.code?.prop === 'children');
    return typeof p?.default === 'string' ? p.default : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Canonicalization (N1–N5)
// ---------------------------------------------------------------------------

const isStructural = (part: Json): boolean =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content && !part.component && part.text === undefined && !part.icon && !part.meter;

function canonLayout(part: Json, isRoot: boolean): Json {
  const l = part.layout ?? {};
  if (isRoot && !part.layout) return { display: 'inline-flex', align: 'center', justify: 'center' }; // N1
  if (!isRoot && !isStructural(part)) return { ...(l.grow ? { grow: true } : {}), ...(l.overlap ? { overlap: true } : {}) };
  const out: Json = { display: l.display ?? 'flex' }; // N2
  for (const k of ['direction', 'align', 'justify'] as const) if (l[k]) out[k] = l[k];
  if (l.grow) out.grow = true;
  if (l.overlap) out.overlap = true;
  return out;
}

const canonText = (t: string | undefined): string | undefined => (t === '' ? undefined : t); // N3

function canonElement(part: Json, isRoot: boolean): string | undefined {
  if (isRoot) return undefined; // root element lives in semantics
  if (part.component) return undefined;
  return part.element ?? (part.content || part.text !== undefined ? 'span' : 'div'); // N5
}

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v as Json).sort().map((k) => [k, sorted((v as Json)[k])]));
  }
  return v;
}

// ---------------------------------------------------------------------------
// Part-tree comparison
// ---------------------------------------------------------------------------

const SLOT_DESIGN_FIELDS = ['accepts', 'acceptsMode', 'min', 'max', 'required', 'figmaProperty', 'defaultContent'];

function compareParts(component: string, partPath: string, contract: Json, proposed: Json, isRoot: boolean) {
  const subject = `anatomy.${partPath}`;
  const issues: string[] = [];
  const matchedBits: string[] = [];

  if (contract.description) {
    add(component, `${subject}.description`, 'CODE-ABSENT', 'part description is contract prose — nothing in code carries it');
  }

  // identity kind: component / slot / content / text / structural
  if (contract.component || proposed.component) {
    if (!contract.component || !proposed.component) {
      issues.push(`one side is a component ref, the other is not`);
    } else {
      if (contract.component.id !== proposed.component.id) {
        issues.push(`component ref id: contract "${contract.component.id}" vs proposed "${proposed.component.id}"`);
      } else matchedBits.push(`component ref ${contract.component.id}`);
      if (!deepEqual(contract.component.props ?? {}, proposed.component.props ?? {})) {
        issues.push(`component ref fixed props differ: ${JSON.stringify(contract.component.props ?? {})} vs ${JSON.stringify(proposed.component.props ?? {})}`);
      }
      const dflt = childrenDefault(contract.component.id);
      const cText = contract.component.text ?? dflt;
      const pText = proposed.component.text ?? dflt;
      if (cText !== pText) issues.push(`component ref text: ${JSON.stringify(cText)} vs ${JSON.stringify(pText)}`);
      else if (proposed.component.text !== undefined && contract.component.text === undefined) {
        matchedBits.push(`text ≡ child children-default (N4)`);
      }
    }
  }
  if ((contract.slot?.name ?? null) !== (proposed.slot?.name ?? null)) {
    issues.push(`slot: contract ${JSON.stringify(contract.slot?.name ?? null)} vs proposed ${JSON.stringify(proposed.slot?.name ?? null)}`);
  } else if (contract.slot) {
    matchedBits.push(`slot "${contract.slot.name}"`);
    const designFields = SLOT_DESIGN_FIELDS.filter((f) => contract.slot[f] !== undefined);
    if (designFields.length > 0) {
      add(component, `${subject}.slot.{${designFields.join(',')}}`, 'CODE-ABSENT',
        'slot constraints and canvas property names are design-side declarations — not recoverable from {prop} in JSX');
    }
  }
  if ((contract.content?.prop ?? null) !== (proposed.content?.prop ?? null)) {
    issues.push(`content binding: ${JSON.stringify(contract.content ?? null)} vs ${JSON.stringify(proposed.content ?? null)}`);
  } else if (contract.content) matchedBits.push(`content ← ${contract.content.prop}`);
  if (canonText(contract.text) !== canonText(proposed.text)) {
    issues.push(`text: ${JSON.stringify(contract.text)} vs ${JSON.stringify(proposed.text)}`);
  }

  if (canonElement(contract, isRoot) !== canonElement(proposed, isRoot)) {
    issues.push(`element: ${canonElement(contract, isRoot)} vs ${canonElement(proposed, isRoot)}`);
  }
  if (!deepEqual(canonLayout(contract, isRoot), canonLayout(proposed, isRoot))) {
    issues.push(`layout: ${JSON.stringify(canonLayout(contract, isRoot))} vs ${JSON.stringify(canonLayout(proposed, isRoot))}`);
  }
  if (!deepEqual(contract.tokens ?? {}, proposed.tokens ?? {})) {
    const c = contract.tokens ?? {}, p = proposed.tokens ?? {};
    const keys = [...new Set([...Object.keys(c), ...Object.keys(p)])].filter((k) => c[k] !== p[k]);
    issues.push(`tokens differ on ${keys.map((k) => `${k}: ${c[k] ?? '∅'} vs ${p[k] ?? '∅'}`).join('; ')}`);
  } else {
    const n = Object.keys(contract.tokens ?? {}).length;
    if (n > 0) matchedBits.push(`${n} token binding(s)`);
  }
  if (!deepEqual(contract.states ?? {}, proposed.states ?? {})) {
    issues.push(`states: ${JSON.stringify(contract.states ?? {})} vs ${JSON.stringify(proposed.states ?? {})}`);
  } else if (contract.states && Object.keys(contract.states).length > 0) {
    matchedBits.push(`${Object.keys(contract.states).length} state block(s)`);
  }
  if (!deepEqual(contract.attrs ?? {}, proposed.attrs ?? {})) {
    issues.push(`attrs: ${JSON.stringify(contract.attrs ?? {})} vs ${JSON.stringify(proposed.attrs ?? {})}`);
  } else if (contract.attrs) matchedBits.push(`attrs ${JSON.stringify(contract.attrs)}`);
  if (!deepEqual(contract.visibleWhen ?? null, proposed.visibleWhen ?? null)) {
    issues.push(`visibleWhen: ${JSON.stringify(contract.visibleWhen ?? null)} vs ${JSON.stringify(proposed.visibleWhen ?? null)}`);
  } else if (contract.visibleWhen) matchedBits.push(`visibleWhen ${JSON.stringify(contract.visibleWhen)}`);
  if (Boolean(contract.optional) !== Boolean(proposed.optional)) {
    issues.push(`optional: ${Boolean(contract.optional)} vs ${Boolean(proposed.optional)}`);
  } else if (contract.optional) matchedBits.push('optional');

  add(
    component,
    subject,
    issues.length > 0 ? 'MISMATCH' : 'MATCHED',
    issues.length > 0 ? issues.join(' | ') : matchedBits.join(', ') || 'structure + layout',
  );

  // children, order-sensitive (JSX order is the contract's part order)
  const cKids = Object.keys(contract.parts ?? {});
  const pKids = Object.keys(proposed.parts ?? {});
  if (cKids.join(',') !== pKids.join(',')) {
    add(component, `${subject}.parts`, 'MISMATCH', `part names/order: contract [${cKids.join(', ')}] vs proposed [${pKids.join(', ')}]`);
    return;
  }
  for (const kid of cKids) {
    compareParts(component, `${partPath}.${kid}`, contract.parts[kid], proposed.parts[kid], false);
  }
}

// ---------------------------------------------------------------------------
// Component comparison
// ---------------------------------------------------------------------------

function compareComponent(contract: Json, proposal: Json) {
  const name = contract.name as string;

  // Governance / design-side contract fields: genuinely not in code.
  add(name, 'version, status, description', 'CODE-ABSENT', 'contract governance prose — extraction proposes 0.1.0 draft');
  add(name, 'anchors.figma', 'CODE-ABSENT', 'design-side identity anchors — written back by the Figma generator');
  if (contract.a11y) add(name, 'a11y', 'CODE-ABSENT', 'declared a11y budget — a contract commitment, not code syntax');
  if (contract.figmaStatePreviews) add(name, 'figmaStatePreviews', 'CODE-ABSENT', 'canvas-only opt-in');
  add(name, 'props.*.bindings.figma', 'CODE-ABSENT', 'design-side spellings — extraction infers TitleCase, reconcile confirms');

  // semantics
  if (contract.semantics.element !== proposal.semantics.element) {
    add(name, 'semantics.element', 'MISMATCH', `${contract.semantics.element} vs ${proposal.semantics.element}`);
  } else add(name, 'semantics.element', 'MATCHED', contract.semantics.element);
  if ((contract.semantics.role ?? null) !== (proposal.semantics.role ?? null)) {
    add(name, 'semantics.role', 'MISMATCH', `${contract.semantics.role ?? '∅'} vs ${proposal.semantics.role ?? '∅'}`);
  } else if (contract.semantics.role) add(name, 'semantics.role', 'MATCHED', contract.semantics.role);

  // states list
  if ((contract.states ?? []).join(',') !== (proposal.states ?? []).join(',')) {
    add(name, 'states', 'MISMATCH', `[${(contract.states ?? []).join(', ')}] vs [${(proposal.states ?? []).join(', ')}]`);
  } else add(name, 'states', 'MATCHED', `[${(contract.states ?? []).join(', ')}]`);

  // props
  const proposalByCode = new Map((proposal.props as Json[]).map((p) => [p.bindings.code.prop, p]));
  const matchedCodes = new Set<string>();
  for (const cp of contract.props as Json[]) {
    const code = cp.bindings.code.prop;
    if (code === 'children') {
      add(name, `props.${cp.name}`, 'CODE-ABSENT',
        'children-bound text prop — code renders {children}; the TEXT property spelling and canvas default live in the contract');
      continue;
    }
    const pp = proposalByCode.get(code);
    if (!pp) {
      add(name, `props.${cp.name}`, 'MISMATCH', `contract prop (code binding "${code}") missing from proposal`);
      continue;
    }
    matchedCodes.add(code);
    const issues: string[] = [];
    if (!deepEqual(cp.type, pp.type)) issues.push(`type ${JSON.stringify(cp.type)} vs ${JSON.stringify(pp.type)}`);
    if (Boolean(cp.required) !== Boolean(pp.required)) issues.push(`required ${Boolean(cp.required)} vs ${Boolean(pp.required)}`);
    if (cp.default !== pp.default) {
      if (cp.type === 'text' && cp.required && pp.default === undefined) {
        add(name, `props.${cp.name}.default`, 'CODE-ABSENT',
          `required text default ${JSON.stringify(cp.default)} is the canvas default + story sample — code has no destructure default for a required prop`);
      } else {
        issues.push(`default ${JSON.stringify(cp.default)} vs ${JSON.stringify(pp.default)}`);
      }
    }
    add(name, `props.${cp.name}`, issues.length > 0 ? 'MISMATCH' : 'MATCHED',
      issues.length > 0 ? issues.join(' | ') : `type${cp.default !== undefined && cp.default === pp.default ? ' + default' : ''}${cp.required ? ' + required' : ''}`);
  }
  for (const [code, pp] of proposalByCode) {
    if (!matchedCodes.has(code)) {
      add(name, `props.${pp.name}`, 'MISMATCH', `proposal invented a prop the contract does not declare (code binding "${code}")`);
    }
  }

  // events
  const cEvents = (contract.events ?? []) as Json[];
  const pEvents = (proposal.events ?? []) as Json[];
  for (const ce of cEvents) {
    const pe = pEvents.find((e) => e.name === ce.name);
    if (!pe) {
      add(name, `events.${ce.name}`, 'MISMATCH', 'contract event missing from proposal');
      continue;
    }
    const issues: string[] = [];
    if (ce.bindings.code.prop !== pe.bindings.code.prop) issues.push(`code prop ${ce.bindings.code.prop} vs ${pe.bindings.code.prop}`);
    if (ce.trigger !== pe.trigger) issues.push(`trigger ${ce.trigger} vs ${pe.trigger}`);
    if (!deepEqual(ce.toggles ?? null, pe.toggles ?? null)) {
      issues.push(`toggles ${JSON.stringify(ce.toggles ?? null)} vs ${JSON.stringify(pe.toggles ?? null)}`);
    }
    add(name, `events.${ce.name}`, issues.length > 0 ? 'MISMATCH' : 'MATCHED',
      issues.length > 0 ? issues.join(' | ') : `trigger "${ce.trigger}"${ce.toggles ? `, toggles ${ce.toggles.prop} [${ce.toggles.between.join(', ')}]${ce.toggles.aria ? `, aria-${ce.toggles.aria}` : ''}` : ''}`);
  }
  for (const pe of pEvents) {
    if (!cEvents.some((e) => e.name === pe.name)) {
      add(name, `events.${pe.name}`, 'MISMATCH', 'proposal invented an event the contract does not declare');
    }
  }

  // anatomy
  compareParts(name, 'root', contract.anatomy.root, proposal.anatomy.root, true);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const extracted = extractReactTsx(path.join(ROOT, 'src', 'components'));
for (const id of TRIO) {
  const contract = loadContract(`ds.${id}`);
  const component = extracted.find((c) => c.name === contract.name);
  if (!component) {
    add(contract.name, '(extraction)', 'MISMATCH', 'component not found by the react-tsx adapter');
    continue;
  }
  if (!component.anatomy) {
    add(contract.name, '(extraction)', 'MISMATCH', 'adapter yielded no anatomy for a component with a co-located CSS Module');
    continue;
  }
  compareComponent(contract, proposeContract(component, 'ds').contract as Json);
}

const counts = { MATCHED: 0, 'CODE-ABSENT': 0, MISMATCH: 0 } as Record<Verdict, number>;
for (const f of findings) counts[f.verdict]++;

const lines: string[] = [
  '# Code → contract round-trip receipt',
  '',
  '<!-- GENERATED by extract/roundtrip-code.ts (`npm run roundtrip:code`) — DO NOT EDIT. -->',
  '',
  'This repo\'s `src/components/` are generated FROM contracts, so extracting anatomy back',
  'out of the generated Badge, Switch, and Card and comparing the proposals to',
  '`contracts/{badge,switch,card}.contract.json` is an executable ground truth for the',
  'css-module anatomy adapter: **round-trip identity**. Verdicts:',
  '',
  '- **MATCHED** — the proposal recovered the contract field (after the normalizations N1–N5',
  '  documented in `extract/roundtrip-code.ts`, each the inversion of a deterministic generator rule)',
  '- **CODE-ABSENT** — genuinely not present in code (figma bindings, canvas defaults of required',
  '  text props, slot constraints, prose); listed by name, never silently waved through',
  '- **MISMATCH** — extraction failure. **The bar is zero.**',
  '',
  `## Verdict: ${counts.MISMATCH === 0 ? '✅ ZERO MISMATCH' : `❌ ${counts.MISMATCH} MISMATCH(ES)`} — ${counts.MATCHED} matched, ${counts['CODE-ABSENT']} code-absent (listed), ${counts.MISMATCH} mismatched`,
  '',
];
for (const id of TRIO) {
  const name = loadContract(`ds.${id}`).name as string;
  const rows = findings.filter((f) => f.component === name);
  const c = { MATCHED: 0, 'CODE-ABSENT': 0, MISMATCH: 0 } as Record<Verdict, number>;
  for (const r of rows) c[r.verdict]++;
  lines.push(
    `## ${name} — ${c.MATCHED} matched · ${c['CODE-ABSENT']} code-absent · ${c.MISMATCH} mismatched`,
    '',
    '| subject | verdict | detail |',
    '|---|---|---|',
    ...rows.map((r) => `| \`${r.subject}\` | ${r.verdict} | ${r.detail.replace(/\|/g, '\\|')} |`),
    '',
  );
}
writeFileSync(path.join(ROOT, 'extract', 'ROUNDTRIP-CODE.md'), lines.join('\n') + '\n');

for (const f of findings) {
  const mark = f.verdict === 'MATCHED' ? '✔' : f.verdict === 'CODE-ABSENT' ? '·' : '✘';
  console.log(`${mark} [${f.component} ${f.verdict}] ${f.subject} — ${f.detail}`);
}
console.log(
  `\n${counts.MISMATCH === 0 ? '✔' : '✘'} Round trip: ${counts.MATCHED} matched, ${counts['CODE-ABSENT']} code-absent (listed), ${counts.MISMATCH} mismatched → extract/ROUNDTRIP-CODE.md`,
);
if (counts.MISMATCH > 0) process.exit(1);
