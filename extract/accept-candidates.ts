/**
 * Bulk candidate acceptance — refusal-triage for the static extract (G14).
 *
 *   npm run extract:accept -- --accept exact [config]
 *   npm run extract:accept -- --accept path/to/acceptances.json [config]
 *   ds-contracts extract --accept-candidates exact
 *
 * The extract report lists every RAW VALUE (a literal the source styles with
 * instead of a token) with its nearest-token candidates — on a real
 * 40-component brownfield library that report runs to hundreds of items, and
 * working it one line at a time is the dominant day-one labor (docs/18 flow
 * 2 step 3). This module is the bulk path, under the SAME ack discipline as
 * extract/computed/resolve.ts:
 *
 *   · `exact` (alias `all`): accept every raw value with exactly ONE
 *     candidate — candidates are exact-value matches by construction
 *     (core/extract-css-module.ts candidatesByValue), so a unique candidate
 *     is an unambiguous fact, not a guess. Multiple candidates, zero
 *     candidates, axis-scoped values, and non-root state values are REFUSED
 *     BY NAME — guessing names is forbidden (the resolve.ts rule).
 *   · a list file: explicit per-item acks `[{component, selector, property,
 *     value, to}]` — the human names the token, including for ambiguous
 *     items; a `to` outside the candidate list is accepted but ledgered as
 *     an explicit override (it changes the rendered value on purpose).
 *
 * NOTHING is silently accepted: every acceptance lands in the LEDGER
 * (<out>/accepted-candidates.{json,md} — the decisions-ledger shape:
 * evidence + action + explicit-ack provenance), and the generated proposals
 * in <out>/contracts/ are NEVER mutated (they must stay byte-reproducible by
 * the extract pass) — accepted contracts land in <out>/contracts-accepted/,
 * schema-validated before a byte is written.
 *
 * PURE CORE + thin shell: planAcceptances/applyAcceptances are pure
 * functions (unit-pinned in packages/cli/test/accept-candidates.test.ts);
 * the shell owns fs only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, walkAnatomy, type Contract, type Part } from '../scripts/contract-schema.js';
import { loadConfig, outDir } from './config.js';
import { kebab } from './types.js';
import type { ExtractedComponent } from './types.js';

// ---------------------------------------------------------------------------
// Pure core
// ---------------------------------------------------------------------------

export interface RequestedAcceptance {
  component: string;
  selector: string;
  property: string;
  value: string;
  /** Brace-wrapped token ref: "{color.border.subtle}". */
  to: string;
}

export interface PlannedAcceptance {
  component: string;
  /** Extracted part name the binding lands on (from the mintable join). */
  part: string;
  /** Contract state — present only for state-rule raw values (root only). */
  state?: string;
  selector: string;
  property: string;
  value: string;
  to: string;
  candidates: string[];
  /** list-file mode named a token OUTSIDE the exact-value candidates —
   *  accepted (explicit human ack) but named in the ledger. */
  explicitOverride: boolean;
}

export interface RefusedAcceptance {
  component: string;
  selector: string;
  property: string;
  value: string;
  reason: string;
}

export type AcceptMode = { kind: 'exact' } | { kind: 'list'; items: RequestedAcceptance[] };

const TOKEN_REF_RE = /^\{[a-z0-9_.{}-]+\}$/i;

interface JoinResult {
  part?: string;
  state?: string;
  refusal?: string;
}

/** Join a raw value to its part/state context via the mintables channel —
 *  the same (selector, cssProperty, raw) join propose.ts uses. A raw value
 *  the mint capture never saw has NO part context and cannot be accepted. */
function joinContext(c: ExtractedComponent, rv: { selector: string; property: string; value: string }): JoinResult {
  const hits = (c.anatomy?.mintables ?? []).filter(
    (f) => f.selector === rv.selector && f.cssProperty === rv.property && f.raw === rv.value,
  );
  if (hits.length === 0) {
    return { refusal: 'no part context (no mintable finding joins this raw value) — bind it in source and re-extract' };
  }
  const distinct = new Set(hits.map((f) => `${f.part}|${f.state ?? ''}|${f.axis ? `${f.axis.prop}=${f.axis.value}` : ''}`));
  if (distinct.size > 1) {
    return { refusal: `ambiguous part context — ${distinct.size} distinct (part, state, axis) sites share this declaration; resolve in source` };
  }
  const f = hits[0];
  if (f.axis) {
    return {
      refusal: `axis-scoped (behind ${f.axis.prop}=${f.axis.value}) — a per-variant acceptance is a tokensByProp review, not a bulk ack; author it against design intent`,
    };
  }
  if (f.state && f.part !== 'root') {
    return { refusal: `state binding on part "${f.part}" — state bindings live on the root only (the propose.ts mint rule)` };
  }
  return { part: f.part, ...(f.state ? { state: f.state } : {}) };
}

/** PURE: extraction + mode → planned acceptances and named refusals.
 *  Deterministic: output ordering follows the (name-sorted) extraction and
 *  each component's rawValues order. */
export function planAcceptances(
  extracted: ExtractedComponent[],
  mode: AcceptMode,
): { accepted: PlannedAcceptance[]; refused: RefusedAcceptance[] } {
  const accepted: PlannedAcceptance[] = [];
  const refused: RefusedAcceptance[] = [];
  const refuse = (component: string, rv: { selector: string; property: string; value: string }, reason: string) =>
    refused.push({ component, selector: rv.selector, property: rv.property, value: rv.value, reason });

  if (mode.kind === 'exact') {
    for (const c of extracted) {
      for (const rv of c.anatomy?.rawValues ?? []) {
        if (rv.candidates.length === 0) {
          refuse(c.name, { selector: rv.selector, property: rv.property, value: rv.value }, 'no token in the tree resolves to this value — nothing to accept (mint provisionally or bind in source)');
          continue;
        }
        if (rv.candidates.length > 1) {
          refuse(
            c.name,
            { selector: rv.selector, property: rv.property, value: rv.value },
            `${rv.candidates.length} tokens share the value (${rv.candidates.join(', ')}) — name one in an acceptance list file; bulk mode never picks among equals`,
          );
          continue;
        }
        const ctx = joinContext(c, { selector: rv.selector, property: rv.property, value: rv.value });
        if (ctx.refusal) {
          refuse(c.name, { selector: rv.selector, property: rv.property, value: rv.value }, ctx.refusal);
          continue;
        }
        accepted.push({
          component: c.name,
          part: ctx.part!,
          ...(ctx.state ? { state: ctx.state } : {}),
          selector: rv.selector,
          property: rv.property,
          value: rv.value,
          to: `{${rv.candidates[0]}}`,
          candidates: rv.candidates,
          explicitOverride: false,
        });
      }
    }
    return { accepted, refused };
  }

  const byName = new Map(extracted.map((c) => [c.name, c] as const));
  for (const item of mode.items) {
    const c = byName.get(item.component);
    if (!c) {
      refuse(item.component, item, `component "${item.component}" not in the extraction`);
      continue;
    }
    const rv = (c.anatomy?.rawValues ?? []).find(
      (r) => r.selector === item.selector && r.property === item.property && r.value === item.value,
    );
    if (!rv) {
      refuse(item.component, item, 'no reported raw value matches (selector, property, value) — the list must name items exactly as the report spells them');
      continue;
    }
    if (!TOKEN_REF_RE.test(item.to)) {
      refuse(item.component, item, `"to" must be a brace-wrapped token ref ("{a.b.c}"), got "${item.to}"`);
      continue;
    }
    const ctx = joinContext(c, item);
    if (ctx.refusal) {
      refuse(item.component, item, ctx.refusal);
      continue;
    }
    accepted.push({
      component: c.name,
      part: ctx.part!,
      ...(ctx.state ? { state: ctx.state } : {}),
      selector: item.selector,
      property: item.property,
      value: item.value,
      to: item.to,
      candidates: rv.candidates,
      explicitOverride: !rv.candidates.includes(item.to.slice(1, -1)),
    });
  }
  return { accepted, refused };
}

/** PURE: apply one component's planned acceptances to its PROPOSED contract.
 *  The input contract object is never mutated; a binding that would
 *  overwrite an existing one is refused by name (nothing silent). */
export function applyAcceptances(
  contract: Contract,
  accepted: PlannedAcceptance[],
): { contract: Contract; applied: PlannedAcceptance[]; refused: RefusedAcceptance[] } {
  const next = structuredClone(contract);
  const partByName = new Map(walkAnatomy(next).map((w) => [w.name, w.part] as const));
  const applied: PlannedAcceptance[] = [];
  const refused: RefusedAcceptance[] = [];
  for (const a of accepted) {
    const target: Part | undefined = partByName.get(a.part);
    if (!target) {
      refused.push({ component: a.component, selector: a.selector, property: a.property, value: a.value, reason: `part "${a.part}" not in the proposed contract anatomy` });
      continue;
    }
    if (a.state) {
      const root = partByName.get('root');
      if (!root) {
        refused.push({ component: a.component, selector: a.selector, property: a.property, value: a.value, reason: 'contract anatomy has no root part — state binding has nowhere to land' });
        continue;
      }
      const states = ((root as { states?: Record<string, Record<string, string>> }).states ??= {});
      const bucket = (states[a.state] ??= {});
      if (bucket[a.property] !== undefined) {
        refused.push({ component: a.component, selector: a.selector, property: a.property, value: a.value, reason: `root :${a.state} ${a.property} already bound to ${bucket[a.property]} — nothing overwritten` });
        continue;
      }
      bucket[a.property] = a.to;
    } else {
      if (target.tokens?.[a.property] !== undefined) {
        refused.push({ component: a.component, selector: a.selector, property: a.property, value: a.value, reason: `${a.part}.${a.property} already bound to ${target.tokens[a.property]} — nothing overwritten` });
        continue;
      }
      target.tokens = { ...target.tokens, [a.property]: a.to };
    }
    applied.push(a);
  }
  return { contract: next, applied, refused };
}

export interface AcceptanceLedgerEntry extends PlannedAcceptance {
  ack: string;
}

/** PURE: ledger markdown — the decisions.md shape (evidence + action +
 *  explicit-ack provenance), regenerated whole from the JSON ledger. */
export function acceptanceLedgerMarkdown(entries: AcceptanceLedgerEntry[]): string {
  return (
    [
      '# Accepted candidates ledger — raw value → token acceptances',
      '',
      'Every entry is an EXPLICIT ack (`--accept-candidates exact` accepts only the unique',
      'exact-value candidate; a list file names its token per item). The generated proposals in',
      '`contracts/` are never mutated; accepted contracts land in `contracts-accepted/`.',
      'Ambiguous or context-less raw values are refused by name and stay in the extract report.',
      '',
      '| component | part.channel | state | literal | → token | candidates | ack |',
      '|---|---|---|---|---|---|---|',
      ...entries.map(
        (e) =>
          `| ${e.component} | ${e.part}.${e.property} | ${e.state ?? '—'} | \`${e.value}\` | \`${e.to}\`${e.explicitOverride ? ' **(override)**' : ''} | ${e.candidates.length} | ${e.ack} |`,
      ),
      '',
      '## Provenance (selector per acceptance)',
      '',
      ...entries.map((e) => `- **${e.component}** \`${e.selector} { ${e.property}: ${e.value} }\` → \`${e.to}\``),
      '',
    ].join('\n')
  );
}

// ---------------------------------------------------------------------------
// Shell — fs only. `tsx extract/accept-candidates.ts --accept <exact|all|file> [config]`
// ---------------------------------------------------------------------------

export function runAcceptCommand(modeArg: string, configArg?: string): { accepted: number; refused: number } {
  const { config, from } = loadConfig(configArg);
  const out = outDir(config);
  const extractionPath = path.join(out, 'code-extraction.json');
  if (!existsSync(extractionPath)) {
    throw new Error(`${extractionPath} not found — run \`ds-contracts extract\` / \`npm run extract:code\` first.`);
  }
  const extracted = JSON.parse(readFileSync(extractionPath, 'utf8')) as ExtractedComponent[];

  let mode: AcceptMode;
  let ack: string;
  if (modeArg === 'exact' || modeArg === 'all') {
    mode = { kind: 'exact' };
    ack = 'explicit CLI --accept-candidates exact';
    if (modeArg === 'all') {
      console.log('note: "all" accepts exactly the unambiguous exact matches — ambiguous candidates are never bulk-accepted, they are refused by name');
    }
  } else {
    if (!existsSync(modeArg)) {
      throw new Error(`--accept-candidates takes "exact", "all", or a path to an acceptance list file — "${modeArg}" is neither`);
    }
    const items = JSON.parse(readFileSync(modeArg, 'utf8')) as RequestedAcceptance[];
    if (!Array.isArray(items)) throw new Error(`${modeArg}: an acceptance list is a JSON array of {component, selector, property, value, to}`);
    mode = { kind: 'list', items };
    ack = `explicit list file ${path.basename(modeArg)}`;
  }

  const ledgerJsonPath = path.join(out, 'accepted-candidates.json');
  const ledgerMdPath = path.join(out, 'accepted-candidates.md');
  const prior: AcceptanceLedgerEntry[] = existsSync(ledgerJsonPath)
    ? (JSON.parse(readFileSync(ledgerJsonPath, 'utf8')) as AcceptanceLedgerEntry[])
    : [];
  const priorKeys = new Set(prior.map((e) => `${e.component}|${e.selector}|${e.property}|${e.value}`));

  const plan = planAcceptances(extracted, mode);
  const fresh = plan.accepted.filter((a) => !priorKeys.has(`${a.component}|${a.selector}|${a.property}|${a.value}`));
  const alreadyLedgered = plan.accepted.length - fresh.length;

  const acceptedDir = path.join(out, 'contracts-accepted');
  const applied: AcceptanceLedgerEntry[] = [];
  const applyRefusals: RefusedAcceptance[] = [];
  const byComponent = new Map<string, PlannedAcceptance[]>();
  for (const a of fresh) {
    byComponent.set(a.component, [...(byComponent.get(a.component) ?? []), a]);
  }
  for (const [name, items] of byComponent) {
    const file = `${kebab(name)}.contract.json`;
    const basePath = existsSync(path.join(acceptedDir, file))
      ? path.join(acceptedDir, file)
      : path.join(out, 'contracts', file);
    if (!existsSync(basePath)) {
      for (const a of items) applyRefusals.push({ component: name, selector: a.selector, property: a.property, value: a.value, reason: `no proposed contract at ${basePath}` });
      continue;
    }
    const base = ContractSchema.parse(JSON.parse(readFileSync(basePath, 'utf8')));
    const r = applyAcceptances(base, items);
    applyRefusals.push(...r.refused);
    if (r.applied.length === 0) continue;
    ContractSchema.parse(r.contract); // refuse to write an unusable contract
    mkdirSync(acceptedDir, { recursive: true });
    writeFileSync(path.join(acceptedDir, file), JSON.stringify(r.contract, null, 2) + '\n');
    applied.push(...r.applied.map((a) => ({ ...a, ack })));
  }

  const allRefusals = [...plan.refused, ...applyRefusals];
  const ledger = [...prior, ...applied];
  if (applied.length > 0) {
    writeFileSync(ledgerJsonPath, JSON.stringify(ledger, null, 2) + '\n');
    writeFileSync(ledgerMdPath, acceptanceLedgerMarkdown(ledger) + '\n');
  }

  console.log(
    `✔ ${applied.length} acceptance(s) applied → ${acceptedDir}/ (${byComponent.size} contract(s) touched; proposals in contracts/ untouched)\n` +
      (alreadyLedgered > 0 ? `  ${alreadyLedgered} already ledgered — skipped, nothing re-applied\n` : '') +
      (applied.length > 0 ? `✔ Ledger → ${ledgerJsonPath} (${ledger.length} total), ${ledgerMdPath}\n` : '') +
      (allRefusals.length > 0
        ? `⚠ ${allRefusals.length} refused BY NAME (they stay in the extract report):\n` +
          allRefusals.slice(0, 20).map((r) => `  - ${r.component} \`${r.selector} { ${r.property}: ${r.value} }\` — ${r.reason}`).join('\n') +
          (allRefusals.length > 20 ? `\n  … and ${allRefusals.length - 20} more` : '') + '\n'
        : ''),
  );
  if (mode.kind === 'list' && allRefusals.length > 0) {
    throw new Error(`${allRefusals.length} explicitly requested acceptance(s) refused — see the named reasons above; nothing partial was hidden`);
  }
  return { accepted: applied.length, refused: allRefusals.length };
}

// Direct-run shell (filename-matched, the extract/run.ts convention).
if (process.argv[1] && /extract[\\/]accept-candidates\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--accept');
  const modeArg = i > -1 ? argv[i + 1] : undefined;
  if (!modeArg) {
    console.error('usage: tsx extract/accept-candidates.ts --accept <exact|all|list.json> [extract.config.json]');
    process.exit(2);
  }
  const positionals = argv.filter((a, j) => !a.startsWith('--') && argv[j - 1] !== '--accept');
  runAcceptCommand(modeArg, positionals[0]);
}
