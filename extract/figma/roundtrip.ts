/**
 * ROUND-TRIP RECEIPT — the whole point of the design-side extractor.
 *
 * Runs propose.ts on each fixture dump (live node trees of the
 * contract-generated Badge / Switch / Card sets) and STRUCTURALLY compares
 * the proposed contract to the shipping contract it was generated from.
 * Every observation lands in exactly one of three classes:
 *
 *   MATCHED        the proposal recovered the contract fact exactly
 *   CANVAS-ABSENT  the fact is genuinely not on the canvas — a DECLARED
 *                  fidelity limit, listed with its reason (semantics, a11y,
 *                  events, `required`, slot `accepts` ⁄ preferredValues,
 *                  font-family, Medium-resolving weight tokens, cascade
 *                  tokens that reach no text, stretch without an observable
 *                  fill-width artifact, empty static text, element/attrs)
 *   MISMATCH       the proposal is wrong — a failure; the bar is ZERO
 *
 * Comparison semantics, not spelling:
 *   · layout compares by CANVAS PROJECTION (the generator's own
 *     direction/justify/align → mode/primary/counter maps), so `align: start`
 *     ≡ absent and `display: flex` ≡ absent — both draw the same node.
 *   · text-cascade tokens (color, font-size, font-weight, font-family)
 *     compare by EFFECTIVE VALUE at each text-bearing part: declaring color
 *     on the root vs. on the text part is the same rendered canvas, so it is
 *     the same contract fact. Non-cascade tokens compare at the declaration
 *     site exactly. Order is never semantic for tokens or props.
 *
 * Ignored fields (proposal metadata, not canvas facts): version, status,
 * description(s), $schema, anchors.
 *
 * Output: extract/figma/ROUNDTRIP.md (committed receipt) + exit 1 on any
 * MISMATCH. `npm run extract:figma:roundtrip`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNativeCheckablePart, pascal, type Part } from '../../scripts/contract-schema.js';
import { kebab } from '../types.js';
import type { DumpFile } from './types.js';
import { isDumpSet } from './types.js';
import { loadTokenCorpus, type TokenCorpus } from './tokens.js';
import { loadContractIdsByName, proposeFromDump, type FigmaProposalResult } from './propose.js';

type Status = 'matched' | 'canvas-absent' | 'mismatch';

export interface Finding {
  status: Status;
  subject: string;
  detail?: string;
}

export interface RoundtripResult {
  component: string;
  findings: Finding[];
  proposal: FigmaProposalResult;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

type J = Record<string, unknown>;

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const CASCADE = new Set(['color', 'font-size', 'font-weight', 'font-family']);

interface NormLayout {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: string;
  counter: string;
  grow: boolean;
  stretch: boolean;
}

const J_MAP: Record<string, string> = { start: 'MIN', center: 'CENTER', end: 'MAX', 'space-between': 'SPACE_BETWEEN' };
const A_MAP: Record<string, string> = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'MIN' };

/** The canvas the generator would draw for this layout — the honest basis of
 *  comparison ("align: start" and no align draw the same node). */
function normLayout(layout: J | undefined, isRoot: boolean): NormLayout {
  if (!layout) {
    return isRoot
      ? { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', grow: false, stretch: false }
      : { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', grow: false, stretch: false };
  }
  const direction = typeof layout.direction === 'string' ? layout.direction : 'row';
  return {
    mode: direction.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL',
    primary: typeof layout.justify === 'string' ? (J_MAP[layout.justify] ?? 'MIN') : 'MIN',
    counter: typeof layout.align === 'string' ? (A_MAP[layout.align] ?? 'MIN') : 'MIN',
    grow: layout.grow === true,
    stretch: layout.align === 'stretch',
  };
}

interface WalkedPart {
  path: string;
  part: J;
  /** Ancestor chain including self, root first. */
  chain: J[];
}

function walk(anatomy: J): WalkedPart[] {
  const out: WalkedPart[] = [];
  const visit = (name: string, part: J, prefix: string, chain: J[]) => {
    const p = prefix ? `${prefix}/${name}` : name;
    const nextChain = [...chain, part];
    out.push({ path: p, part, chain: nextChain });
    for (const [childName, child] of Object.entries((part.parts as Record<string, J>) ?? {})) {
      visit(childName, child, p, nextChain);
    }
  };
  for (const [name, part] of Object.entries(anatomy as Record<string, J>)) visit(name, part, '', []);
  return out;
}

/** Parts whose canvas manifestation includes rendered glyphs. A root with no
 *  parts but a `children`-bound text prop bears the auto-injected label. */
function isTextBearing(w: WalkedPart, contract: J): boolean {
  if (w.part.content) return true;
  if (typeof w.part.text === 'string' && w.part.text !== '') return true;
  if (w.path === 'root' && Object.keys((w.part.parts as J) ?? {}).length === 0) {
    const props = (contract.props as J[]) ?? [];
    return props.some(
      (p) => p.type === 'text' && ((p.bindings as J)?.code as J)?.prop === 'children',
    );
  }
  return false;
}

/** Nearest ancestor-or-self declaration of a cascade token, with its site. */
function effective(w: WalkedPart, prop: string): { ref: string; site: number } | undefined {
  for (let i = w.chain.length - 1; i >= 0; i--) {
    const tokens = w.chain[i].tokens as Record<string, string> | undefined;
    if (tokens?.[prop] !== undefined) return { ref: tokens[prop], site: i };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The comparator
// ---------------------------------------------------------------------------

export function compareContracts(shipping: J, proposed: J, corpus: TokenCorpus): Finding[] {
  const F: Finding[] = [];
  const matched = (subject: string, detail?: string) => F.push({ status: 'matched', subject, ...(detail ? { detail } : {}) });
  const absent = (subject: string, detail: string) => F.push({ status: 'canvas-absent', subject, detail });
  const mismatch = (subject: string, detail: string) => F.push({ status: 'mismatch', subject, detail });

  // Identity
  if (shipping.id === proposed.id) matched('id');
  else mismatch('id', `${shipping.id} vs ${proposed.id}`);
  if (shipping.name === proposed.name) matched('name');
  else mismatch('name', `${shipping.name} vs ${proposed.name}`);

  // Top-level declared limits
  if (!deepEqual(shipping.semantics, proposed.semantics)) {
    absent('semantics', `element/role are not drawn on the canvas (${JSON.stringify(shipping.semantics)})`);
  } else matched('semantics');
  if (shipping.a11y) absent('a11y', 'accessibility requirements are not canvas-recoverable');
  if (Array.isArray(shipping.events) && shipping.events.length > 0) {
    absent('events', `the canvas cannot run behavior — ${(shipping.events as J[]).map((e) => String(e.name)).join(', ')} not recoverable`);
  }
  if (Array.isArray(shipping.states) && shipping.states.length > 0) {
    absent('states', 'interaction states are code-side (CSS pseudo-classes)');
  }

  // Props (order-insensitive, matched by name)
  const sProps = (shipping.props as J[]) ?? [];
  const pProps = (proposed.props as J[]) ?? [];
  for (const sp of sProps) {
    const pp = pProps.find((x) => x.name === sp.name);
    if (!pp) {
      mismatch(`prop ${sp.name}`, 'missing from proposal');
      continue;
    }
    const fields: Array<[string, unknown, unknown]> = [
      ['type', sp.type, pp.type],
      ['default', sp.default, pp.default],
      ['bindings.figma.kind', ((sp.bindings as J).figma as J).kind, ((pp.bindings as J).figma as J).kind],
      ['bindings.figma.property', ((sp.bindings as J).figma as J).property, ((pp.bindings as J).figma as J).property],
      ['bindings.figma.values', ((sp.bindings as J).figma as J).values, ((pp.bindings as J).figma as J).values],
      ['bindings.code.prop', ((sp.bindings as J).code as J).prop, ((pp.bindings as J).code as J).prop],
    ];
    let ok = true;
    for (const [field, a, b] of fields) {
      if (!deepEqual(a, b)) {
        mismatch(`prop ${sp.name} ${field}`, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
        ok = false;
      }
    }
    if (sp.required === true && pp.required !== true) {
      absent(`prop ${sp.name} required`, 'requiredness is not drawn on the canvas');
    } else if (pp.required === true && sp.required !== true) {
      mismatch(`prop ${sp.name} required`, 'proposal invented requiredness');
    }
    if (ok) matched(`prop ${sp.name}`);
  }
  for (const pp of pProps) {
    if (!sProps.some((x) => x.name === pp.name)) {
      mismatch(`prop ${pp.name}`, 'proposal has a prop the contract does not');
    }
  }

  // Anatomy: existence + sibling order
  const sWalk = walk(shipping.anatomy as J);
  const pWalk = walk(proposed.anatomy as J);
  const pByPath = new Map(pWalk.map((w) => [w.path, w]));
  const sByPath = new Map(sWalk.map((w) => [w.path, w]));
  for (const w of sWalk) {
    if (!pByPath.has(w.path)) {
      // A native checkable control (input[type=checkbox|radio]) is CODE
      // semantics by construction — the emitter deliberately draws nothing
      // for it (the presentational box is the visual), so its absence from
      // the proposal is a DECLARED limit, not drift.
      if (isNativeCheckablePart(w.part as unknown as Part)) {
        absent(
          `part ${w.path}`,
          'native checkable control — code semantics; the canvas draws the presentational box, never the input',
        );
      } else {
        mismatch(`part ${w.path}`, 'missing from proposal');
      }
    }
  }
  for (const w of pWalk) {
    if (!sByPath.has(w.path)) mismatch(`part ${w.path}`, 'proposal has a part the contract does not');
  }
  for (const w of sWalk) {
    const p = pByPath.get(w.path);
    if (!p) continue;
    const sOrder = Object.keys((w.part.parts as J) ?? {});
    const pOrder = Object.keys((p.part.parts as J) ?? {});
    const common = sOrder.filter((n) => pOrder.includes(n));
    const commonP = pOrder.filter((n) => sOrder.includes(n));
    if (!deepEqual(common, commonP)) {
      mismatch(`part ${w.path} child order`, `${common.join(',')} vs ${commonP.join(',')}`);
    } else if (common.length > 0) {
      matched(`part ${w.path} child order`);
    }
    comparePart(w, p);
  }

  function comparePart(s: WalkedPart, p: WalkedPart) {
    const at = `part ${s.path}`;
    const isRoot = s.path === 'root';
    const sl = normLayout(s.part.layout as J | undefined, isRoot);
    const pl = normLayout(p.part.layout as J | undefined, isRoot);
    if ((s.part.layout as J | undefined)?.display === 'inline-flex') {
      absent(`${at} layout.display`, 'inline vs block flex has no canvas projection');
    }
    if (s.part.layoutByProp) absent(`${at} layoutByProp`, 'per-variant layout overrides not inverted in dump v1');
    if (sl.mode === pl.mode && sl.primary === pl.primary && sl.counter === pl.counter && sl.grow === pl.grow) {
      if (sl.stretch === pl.stretch) matched(`${at} layout`);
      else if (sl.stretch && !pl.stretch) {
        matched(`${at} layout`, 'canvas-equal; see stretch note');
        absent(`${at} layout align:stretch`, 'stretch leaves no artifact here (children are instances/slots — excluded from the generator fill-width path)');
      } else {
        mismatch(`${at} layout align:stretch`, 'proposal invented stretch');
      }
    } else {
      mismatch(`${at} layout`, `${JSON.stringify(sl)} vs ${JSON.stringify(pl)}`);
    }

    // Non-cascade tokens: exact at the declaration site.
    const sTok = (s.part.tokens as Record<string, string>) ?? {};
    const pTok = (p.part.tokens as Record<string, string>) ?? {};
    for (const [prop, ref] of Object.entries(sTok)) {
      if (CASCADE.has(prop)) continue;
      if (pTok[prop] === ref) matched(`${at} ${prop}`);
      else if (pTok[prop] === undefined) mismatch(`${at} ${prop}`, `${ref} missing from proposal`);
      else mismatch(`${at} ${prop}`, `${ref} vs ${pTok[prop]}`);
    }
    for (const prop of Object.keys(pTok)) {
      if (!CASCADE.has(prop) && sTok[prop] === undefined) {
        mismatch(`${at} ${prop}`, `proposal has ${pTok[prop]}, contract has nothing`);
      }
    }

    // Structure facts
    if (s.part.visibleWhen || p.part.visibleWhen) {
      if (deepEqual(s.part.visibleWhen, p.part.visibleWhen)) matched(`${at} visibleWhen`);
      else mismatch(`${at} visibleWhen`, `${JSON.stringify(s.part.visibleWhen)} vs ${JSON.stringify(p.part.visibleWhen)}`);
    }
    if (s.part.optional === true || p.part.optional === true) {
      if (s.part.optional === p.part.optional) matched(`${at} optional`);
      else mismatch(`${at} optional`, `${s.part.optional} vs ${p.part.optional}`);
    }
    if (s.part.content || p.part.content) {
      if (deepEqual(s.part.content, p.part.content)) matched(`${at} content`);
      else mismatch(`${at} content`, `${JSON.stringify(s.part.content)} vs ${JSON.stringify(p.part.content)}`);
    }
    if (typeof s.part.text === 'string' && s.part.text !== '') {
      if (p.part.text === s.part.text) matched(`${at} text`);
      else mismatch(`${at} text`, `"${s.part.text}" vs ${JSON.stringify(p.part.text)}`);
    } else if (s.part.text === '') {
      if (p.part.text === '' || p.part.text === undefined) {
        absent(`${at} text ""`, 'empty static text renders no glyphs — the styled wrapper alone is on the canvas');
      } else mismatch(`${at} text`, `"" vs ${JSON.stringify(p.part.text)}`);
    } else if (typeof p.part.text === 'string') {
      mismatch(`${at} text`, `proposal has "${p.part.text}", contract has none`);
    }
    if (s.part.element) absent(`${at} element`, `host element ("${s.part.element}") is not drawn on the canvas`);
    if (s.part.attrs) absent(`${at} attrs`, 'HTML/ARIA attributes are code-side surface');
    if (s.part.states) absent(`${at} states`, 'interaction-state token overrides are code-side (CSS)');
    if (s.part.stylesWhen) absent(`${at} stylesWhen`, 'conditional literal styles are code-side (declared canvas limit)');
    if (s.part.animation) absent(`${at} animation`, 'motion is not canvas-representable (documented fidelity scope)');

    // Slot
    if (s.part.slot || p.part.slot) {
      const ss = s.part.slot as J | undefined;
      const ps = p.part.slot as J | undefined;
      if (!ss || !ps) {
        mismatch(`${at} slot`, ss ? 'missing from proposal' : 'proposal invented a slot');
      } else {
        if (ss.name === ps.name) matched(`${at} slot name`);
        else mismatch(`${at} slot name`, `${ss.name} vs ${ps.name}`);
        const eff = (slot: J) => (slot.figmaProperty as string) ?? pascal(slot.name as string);
        if (eff(ss) === eff(ps)) matched(`${at} slot figmaProperty`);
        else mismatch(`${at} slot figmaProperty`, `${eff(ss)} vs ${eff(ps)}`);
        if (ss.required === true && ps.required !== true) {
          absent(`${at} slot required`, 'slot requiredness is not drawn on the canvas');
        } else if (ps.required === true && ss.required !== true) {
          mismatch(`${at} slot required`, 'proposal invented requiredness');
        }
        if (ss.accepts && !ps.accepts) {
          absent(`${at} slot accepts`, `INSTANCE_SWAP preferredValues not captured in dump v1 (${(ss.accepts as string[]).join(', ')})`);
        } else if (!deepEqual(ss.accepts, ps.accepts) && ps.accepts) {
          mismatch(`${at} slot accepts`, `${JSON.stringify(ss.accepts)} vs ${JSON.stringify(ps.accepts)}`);
        }
        for (const extra of ['acceptsMode', 'min', 'max', 'defaultContent'] as const) {
          if (ss[extra] !== undefined && ps[extra] === undefined) {
            absent(`${at} slot ${extra}`, `not recoverable from dump v1`);
          } else if (ps[extra] !== undefined && !deepEqual(ss[extra], ps[extra])) {
            mismatch(`${at} slot ${extra}`, `${JSON.stringify(ss[extra])} vs ${JSON.stringify(ps[extra])}`);
          }
        }
      }
    }

    // Component ref
    if (s.part.component || p.part.component) {
      const sc = s.part.component as J | undefined;
      const pc = p.part.component as J | undefined;
      if (!sc || !pc) {
        mismatch(`${at} component`, sc ? 'missing from proposal' : 'proposal invented a component ref');
      } else {
        if (sc.id === pc.id) matched(`${at} component id`);
        else mismatch(`${at} component id`, `${sc.id} vs ${pc.id}`);
        if (sc.props !== undefined && pc.props === undefined) {
          absent(`${at} component props`, `fixed instance prop values not captured in dump v1 (${JSON.stringify(sc.props)})`);
        } else if (!deepEqual(sc.props, pc.props)) {
          mismatch(`${at} component props`, `${JSON.stringify(sc.props)} vs ${JSON.stringify(pc.props)}`);
        } else if (sc.props !== undefined) {
          matched(`${at} component props`);
        }
        if (sc.text !== undefined && pc.text === undefined) {
          absent(`${at} component text`, 'instance text override not captured in dump v1');
        } else if (!deepEqual(sc.text, pc.text)) {
          mismatch(`${at} component text`, `${JSON.stringify(sc.text)} vs ${JSON.stringify(pc.text)}`);
        }
      }
    }
  }

  // Cascade tokens: effective value at every text-bearing part.
  const resolvedWeight = (tokenRef: string): number | null => {
    try {
      const v = corpus.resolveLiteral(tokenRef.slice(1, -1));
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  };
  const sText = sWalk.filter((w) => isTextBearing(w, shipping));
  const consumed = new Set<string>(); // "path|prop" declaration sites consumed by some text part
  for (const w of sText) {
    const p = pByPath.get(w.path);
    if (!p) continue; // existence mismatch already recorded
    for (const prop of CASCADE) {
      const se = effective(w, prop);
      const pe = effective(p, prop);
      if (se) {
        // Mark the declaring site consumed (site index i within chain ↔ path prefix).
        consumed.add(`${w.path.split('/').slice(0, se.site + 1).join('/')}|${prop}`);
      }
      const subject = `text ${w.path} ${prop} (effective)`;
      if (!se && !pe) continue;
      if (se && pe && se.ref === pe.ref) {
        matched(subject);
        continue;
      }
      if (se && !pe) {
        if (prop === 'font-family') {
          absent(subject, `${se.ref} — the canvas renders Inter regardless (documented fidelity scope)`);
        } else if (prop === 'font-weight' && resolvedWeight(se.ref) === 500) {
          absent(subject, `${se.ref} resolves to the runtime text default (Medium) — canvas-indistinguishable from no weight token`);
        } else {
          F.push({ status: 'mismatch', subject, detail: `${se.ref} missing from proposal` });
        }
        continue;
      }
      if (!se && pe) {
        F.push({ status: 'mismatch', subject, detail: `proposal has ${pe.ref}, contract has nothing` });
        continue;
      }
      F.push({ status: 'mismatch', subject, detail: `${se!.ref} vs ${pe!.ref}` });
    }
  }
  // Cascade declarations that reach no text-bearing part: nothing on the
  // canvas renders them.
  for (const w of sWalk) {
    const tokens = (w.part.tokens as Record<string, string>) ?? {};
    for (const prop of Object.keys(tokens)) {
      if (!CASCADE.has(prop)) continue;
      if (consumed.has(`${w.path}|${prop}`)) continue;
      absent(
        `part ${w.path} ${prop}`,
        `${tokens[prop]} — text-cascade token with no bound text node beneath it on the canvas`,
      );
    }
  }
  for (const w of pWalk) {
    const tokens = (w.part.tokens as Record<string, string>) ?? {};
    const sPart = sByPath.get(w.path);
    if (!sPart) continue;
    for (const prop of Object.keys(tokens)) {
      if (!CASCADE.has(prop)) continue;
      // Consumed proposal cascade entries were compared effectively above; an
      // entry on a part with no text beneath it would be an invention.
      const feeds = pWalk.some(
        (t) => isTextBearing(t, proposed) && (t.path === w.path || t.path.startsWith(`${w.path}/`)) && effective(t, prop)?.ref === tokens[prop],
      );
      if (!feeds) {
        F.push({ status: 'mismatch', subject: `part ${w.path} ${prop}`, detail: `proposal declares ${tokens[prop]} with no text to render it` });
      }
    }
  }

  return F;
}

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

export function runRoundtrip(root: string, fixturePath: string, contractsDir: string): RoundtripResult[] {
  const dump = JSON.parse(readFileSync(fixturePath, 'utf8')) as DumpFile;
  const corpus = loadTokenCorpus(root);
  const contractIdByName = loadContractIdsByName(contractsDir);
  const results: RoundtripResult[] = [];
  for (const [name, value] of Object.entries(dump)) {
    if (name === '_provenance' || !isDumpSet(value)) continue;
    const shippingPath = path.join(contractsDir, `${kebab(name)}.contract.json`);
    const shipping = JSON.parse(readFileSync(shippingPath, 'utf8')) as J;
    const proposal = proposeFromDump(value, {
      corpus,
      contractIdByName,
      fileKey: dump._provenance?.fileKey ?? null,
    });
    results.push({ component: name, findings: compareContracts(shipping, proposal.contract, corpus), proposal });
  }
  return results;
}

const count = (fs: Finding[], status: Status) => fs.filter((f) => f.status === status).length;

export function receiptMarkdown(results: RoundtripResult[], fixtureRel: string): string {
  const lines = [
    '# Design → contract round-trip receipt',
    '',
    '<!-- GENERATED by extract/figma/roundtrip.ts (`npm run extract:figma:roundtrip`) — DO NOT EDIT. -->',
    '',
    `Each fixture in \`${fixtureRel}\` is a LIVE node-tree dump of a contract-generated component set. \`extract/figma/propose.ts\` proposes a contract from the dump alone; this receipt structurally compares the proposal to the shipping contract the canvas was generated from. Layout compares by canvas projection; text-cascade tokens compare by effective value at each text-bearing part (declaration site is authoring style, not a canvas fact). Ignored as proposal metadata: version, status, descriptions, anchors.`,
    '',
    '| Component | MATCHED | CANVAS-ABSENT | MISMATCH | Verdict |',
    '|---|---|---|---|---|',
  ];
  for (const r of results) {
    const m = count(r.findings, 'matched');
    const a = count(r.findings, 'canvas-absent');
    const x = count(r.findings, 'mismatch');
    lines.push(`| ${r.component} | ${m} | ${a} | ${x} | ${x === 0 ? '✅ zero mismatch' : '❌ FAIL'} |`);
  }
  lines.push('');
  for (const r of results) {
    const m = r.findings.filter((f) => f.status === 'matched');
    const a = r.findings.filter((f) => f.status === 'canvas-absent');
    const x = r.findings.filter((f) => f.status === 'mismatch');
    lines.push(`## ${r.component}`, '');
    if (x.length > 0) {
      lines.push(`### ❌ MISMATCH (${x.length})`, '');
      for (const f of x) lines.push(`- **${f.subject}** — ${f.detail ?? ''}`);
      lines.push('');
    }
    lines.push(
      `### MATCHED (${m.length})`,
      '',
      m.map((f) => `\`${f.subject}\``).join(' · '),
      '',
      `### CANVAS-ABSENT (${a.length}) — declared fidelity limits`,
      '',
    );
    for (const f of a) lines.push(`- \`${f.subject}\` — ${f.detail}`);
    lines.push('');
    const unbound = r.proposal.unbound;
    if (unbound.length > 0) {
      lines.push(`### Unbound values reported (never tokenized)`, '');
      for (const u of unbound) {
        lines.push(
          `- \`${u.nodePath}\` ${u.property} = \`${u.value}\` — nearest tokens: ${u.suggestions.map((s) => `\`{${s}}\``).join(', ') || '(none)'}`,
        );
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const readFlag = (flag: string, dflt: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : dflt;
  };
  const root = process.cwd();
  const fixtureRel = readFlag('--fixtures', path.join('extract', 'figma', 'fixtures', 'main-file-dumps.json'));
  const contractsDir = readFlag('--contracts', 'contracts');
  const outPath = readFlag('--out', path.join('extract', 'figma', 'ROUNDTRIP.md'));

  const results = runRoundtrip(root, path.resolve(root, fixtureRel), path.resolve(root, contractsDir));
  writeFileSync(path.resolve(root, outPath), receiptMarkdown(results, fixtureRel) + '\n');

  let failed = false;
  for (const r of results) {
    const m = count(r.findings, 'matched');
    const a = count(r.findings, 'canvas-absent');
    const x = count(r.findings, 'mismatch');
    console.log(`${r.component}: MATCHED ${m} · CANVAS-ABSENT ${a} · MISMATCH ${x}`);
    for (const f of r.findings.filter((f) => f.status === 'mismatch')) {
      console.log(`  ✗ ${f.subject} — ${f.detail ?? ''}`);
    }
    if (x > 0) failed = true;
  }
  console.log(`receipt → ${outPath}`);
  if (failed) {
    console.error('Round trip has MISMATCH findings — the bar is zero.');
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
