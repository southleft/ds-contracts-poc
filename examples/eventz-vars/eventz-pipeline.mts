/**
 * THE REAL-TOKEN-NAME ROUND — canvas→contract against a kit that actually
 * binds Figma variables.
 *
 * Every canvas→code number this repo has published came from Untitled UI,
 * and that kit binds ZERO variables (measured live 2026-08-01: 0 local
 * variables, 0 collections, 0 nodes carrying `boundVariables` over 443
 * scanned; its "❖ Variables" page is documentation with unfilled placeholder
 * links). So every styled fact there MINTS as an `imported.*` literal, and
 * the path a real design system would take — a bound variable resolving to
 * its OWN name — had never once run end to end.
 *
 * The Eventz DS binds 376 variables across 3 collections (Core–Tier 1
 * primitives, Themes–Tier 2 semantic aliases over Light/Dark, Motion), and
 * this slice of 7 component sets resolves 70 of them, 43 of which genuinely
 * differ between the two modes. That is the thing UUI could not test.
 *
 *   dumps/MERGED.json (dump v1.11, bridge capture) → capturedTokensFromDump
 *     → tokens/captured.dtcg.json  (the designer's REAL names)
 *     → the token corpus proposeFromDump matches against
 *     → contracts/*.contract.json + tokens/minted.dtcg.json
 *
 *   npx tsx examples/eventz-vars/eventz-pipeline.mts            # verify only
 *   npx tsx examples/eventz-vars/eventz-pipeline.mts --write    # rewrite
 *
 * THE MEASUREMENT THIS EXISTS FOR is printed at the end: how many of the
 * contracts' token refs resolve to a REAL captured variable name versus a
 * minted `imported.*` literal. On UUI that ratio is 0% by construction. Any
 * number above zero here is the first evidence the real-name path works, and
 * the residual minted share is the honest gap — a fact the canvas draws that
 * no variable was bound to.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { proposeFromDump, type FigmaProposalResult } from '../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import type { DumpSet } from '../../extract/figma/types.js';

type AnyContract = Record<string, any>;

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DUMP = path.join(HERE, 'dumps', 'MERGED.json');
const CONTRACTS = path.join(HERE, 'contracts');
const TOKENS = path.join(HERE, 'tokens');
const WRITE = process.argv.includes('--write');

mkdirSync(CONTRACTS, { recursive: true });
mkdirSync(TOKENS, { recursive: true });

const dump = JSON.parse(readFileSync(DUMP, 'utf8')) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// 1. The designer's real variables → the corpus the proposal matches against
// ---------------------------------------------------------------------------

const captured = capturedTokensFromDump(dump);
if (!captured) {
  console.error('FATAL: the dump carries no `_variables` channel — recapture with dump v1.4+');
  process.exit(1);
}

const corpus = tokenCorpusFromJson({
  primitives: {},
  semantic: captured.tree,
  light: {},
  brandDefault: {},
});

// ---------------------------------------------------------------------------
// 2. Propose every set. Children first, so a host LINKS its child instead of
//    stubbing a second copy of it (the IMPORT_ORDER rule from the UUI round).
// ---------------------------------------------------------------------------

const IMPORT_ORDER = [
  'Atoms/Badge',
  'Atoms/Icon Button',
  'Atoms/Button',
  'Atoms/Checkbox',
  'Atoms/Input',
  'Atoms/Tag',
  'Molecules/Alert',
];

const present = Object.keys(dump).filter((k) => !k.startsWith('_'));
const missing = IMPORT_ORDER.filter((s) => !present.includes(s));
const extra = present.filter((s) => !IMPORT_ORDER.includes(s));
if (missing.length > 0 || extra.length > 0) {
  console.error(
    `FATAL: IMPORT_ORDER does not match the dump — missing ${JSON.stringify(missing)}, unlisted ${JSON.stringify(extra)}. ` +
      'The order decides which host claims each shared child; it is never inferred.',
  );
  process.exit(1);
}

const contracts = new Map<string, AnyContract>();
const contractIdByName = new Map<string, string>();
const contractIdByKey = new Map<string, string>();
const contractsById = new Map<string, AnyContract>();
const sessionClaimedIds = new Set<string>();
const notesBySet = new Map<string, string[]>();
const mintedTree: Record<string, any> = {};

const mergeTree = (dst: Record<string, any>, src: Record<string, any>): void => {
  for (const [k, v] of Object.entries(src)) {
    if (v !== null && typeof v === 'object' && !('$value' in v)) {
      dst[k] = dst[k] ?? {};
      mergeTree(dst[k], v as Record<string, any>);
    } else dst[k] = v;
  }
};

const register = (c: AnyContract): void => {
  if (typeof c?.id !== 'string' || typeof c?.name !== 'string') return;
  contractIdByName.set(c.name, c.id);
  contractsById.set(c.id, c);
  const key = c.anchors?.figma?.componentSetKey;
  if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
  sessionClaimedIds.add(c.id);
  if (!contracts.has(c.id)) contracts.set(c.id, c);
};

const fileKey = (dump._provenance as { fileKey?: string | null } | undefined)?.fileKey ?? null;

for (const setName of IMPORT_ORDER) {
  const proposal: FigmaProposalResult = proposeFromDump(dump[setName] as DumpSet, {
    corpus,
    contractIdByName,
    contractIdByKey,
    contractsById,
    sessionClaimedIds: new Set(sessionClaimedIds),
    fileKey,
    mintUnbound: true,
  });
  if ((proposal.notes ?? []).length > 0) notesBySet.set(setName, proposal.notes as string[]);
  register(proposal.contract as AnyContract);
  for (const stub of proposal.childStubs ?? []) register(stub as AnyContract);
  const selfId = String((proposal.contract as AnyContract).id);
  contracts.set(selfId, proposal.contract as AnyContract);
  if (proposal.mintedTokens) mergeTree(mintedTree, proposal.mintedTokens.tree as Record<string, any>);
}

// ---------------------------------------------------------------------------
// 3. THE MEASUREMENT — real captured names vs minted literals
// ---------------------------------------------------------------------------

/** Every `{token.ref}` appearing anywhere in a contract, with its holder. */
const refsOf = (c: AnyContract): string[] => {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (/^\{[^{}]+\}$/.test(v)) out.push(v.slice(1, -1));
      return;
    }
    if (Array.isArray(v)) return void v.forEach(walk);
    if (v !== null && typeof v === 'object') return void Object.values(v).forEach(walk);
  };
  walk(c);
  return out;
};

const capturedPaths = new Set(captured.entries.map((e) => e.path));
let real = 0;
let minted = 0;
let other = 0;
const perSet: Array<[string, number, number]> = [];
const realNamesSeen = new Set<string>();

for (const [id, c] of contracts) {
  let r = 0;
  let m = 0;
  for (const ref of refsOf(c)) {
    // A substituted ref carries {prop} placeholders — strip them before the
    // corpus lookup so a per-variant real-name binding still counts as real.
    const bare = ref.replace(/\.\{[a-z][\w-]*\}/gi, '');
    if (capturedPaths.has(bare) || capturedPaths.has(ref)) {
      r++;
      realNamesSeen.add(bare);
    } else if (ref.startsWith('imported.')) m++;
    else other++;
  }
  real += r;
  minted += m;
  perSet.push([id, r, m]);
}

// ---------------------------------------------------------------------------
// 4. Emit
// ---------------------------------------------------------------------------

const serialize = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
const built = new Map<string, string>();
for (const [id, c] of contracts) built.set(`${id.replace(/^ds\./, '')}.contract.json`, serialize(c));

const pathFor = (f: string): string =>
  f.endsWith('.dtcg.json') ? path.join(TOKENS, f) : f === 'NOTES.md' ? path.join(HERE, f) : path.join(CONTRACTS, f);
built.set('minted.dtcg.json', serialize(mintedTree));
built.set('captured.dtcg.json', serialize(captured.tree));

// THE MODE PLANE. 43 of the 70 resolved variables genuinely differ between
// Light and Dark, and a bundle built from `base` alone flattens them: the
// generated variable table carries light===dark for every entry, which is a
// silently WRONG two-mode collection rather than a missing one. The per-mode
// trees come out of the same capture, so they are written beside base and fed
// to `figma bundle --modes light,dark`. Figma's own mode NAMES are arbitrary
// ("Light"/"Dark" here, but a file may spell them anything) while the bundle
// vocabulary knows exactly two slots — so the mapping is positional and
// stated here rather than inferred from the spelling.
for (const [mode, m] of Object.entries(captured.modes ?? {})) {
  built.set(`${mode.toLowerCase()}.dtcg.json`, serialize(m.tree));
}

// Every named decision, committed. The classes below are counted rather than
// described so the artifact reports its own shape: a refusal class that grows
// shows up as a number, not as prose someone has to re-read.
const CLASSES: Array<[string, RegExp]> = [
  // CARRIED, not refused — counted first because it used to be the largest
  // refusal in this table. A non-zero "per-state-per-variant" row below would
  // mean the v17 carry regressed, so the refusal class is deliberately kept.
  ['CARRIED as statesByProp — a state binding that is also a function of an enum axis (v17)', /carried as statesByProp/],
  ['per-state-per-variant — a state block holds ONE ref per channel', /a state block holds ONE ref per channel/],
  ['state promoted but nothing recoverable', /promoted from the axis but no root or part override was recoverable/],
  ['state override cannot unset a channel', /a state override cannot unset a channel/],
  ['variable name outside the token-ref grammar (U+2024)', /outside the token-ref grammar/],
  ['binding inconsistent across variants', /bound in \d+\/\d+ variants/],
  ['alpha rides a bound variable', /alpha is not representable on a token ref/],
  ['minted — no variable bound to this fact', /^MINTED /],
];
const classCount = new Map<string, number>();
const allNotes = [...notesBySet.values()].flat();
for (const n of allNotes) {
  for (const [label, re] of CLASSES) {
    if (re.test(n)) {
      classCount.set(label, (classCount.get(label) ?? 0) + 1);
      break;
    }
  }
}
const notesMd = [
  '# Proposal notes — Eventz, the real-variable round',
  '',
  'Generated by `npx tsx examples/eventz-vars/eventz-pipeline.mts --write`, byte-verified',
  'against a rebuild from `dumps/MERGED.json`.',
  '',
  `**${allNotes.length} named decisions across ${notesBySet.size} set(s).** Every one is a fact the canvas`,
  'draws; a note says what happened to it. Nothing here is silent.',
  '',
  '## Refusal classes',
  '',
  '| n | class |',
  '|---|---|',
  ...CLASSES.filter(([l]) => (classCount.get(l) ?? 0) > 0).map(([l]) => `| ${classCount.get(l)} | ${l} |`),
  '',
  'Eventz encodes interaction state as a variant axis (`state=default|hover|active|focus`)',
  'CROSSED with `variant=primary|knockout|secondary|bare`, so its hover background is a',
  'function of TWO axes. That combination used to be the largest refusal in this table:',
  '`tokensByProp` carries a per-variant ref and `states` carries a per-state ref, and there',
  'was no per-state-PER-VARIANT form, so Button and Icon Button lost their ENTIRE hover and',
  'active planes. v17 adds `statesByProp` and they carry — with the designer\'s own unrelated',
  'token names (comp/button/primary/…/hover for primary, …/knockout-hover for knockout),',
  'which is exactly why a substituted ref could never have reached them.',
  '',
  'The `per-state-per-variant` refusal row is kept in the table on purpose: it should read',
  'zero, and a non-zero count means the carry regressed.',
  '',
  ...[...notesBySet.keys()].sort().flatMap((s) => [`## ${s}`, '', ...notesBySet.get(s)!.map((n) => `- ${n}`), '']),
].join('\n');
built.set('NOTES.md', notesMd);

const drift: string[] = [];
for (const [file, text] of built) {
  let current: string | null = null;
  try {
    current = readFileSync(pathFor(file), 'utf8');
  } catch {
    current = null;
  }
  if (current === text) continue;
  drift.push(current === null ? `${file} (new)` : file);
  if (WRITE) writeFileSync(pathFor(file), text);
}

const total = real + minted;
const pct = (n: number, d: number) => (d === 0 ? '0.0' : ((n / d) * 100).toFixed(1));

console.log('');
console.log(`sets proposed            ${IMPORT_ORDER.length} (${contracts.size} contracts incl. child stubs)`);
console.log(`variables captured       ${captured.count} registrable, ${captured.skipped.length} skipped by name`);
console.log(
  `  multi-mode             ${captured.modes ? Object.keys(captured.modes).map((m) => `${m}=${captured.modes![m].count}`).join(', ') : '(none)'}`,
);
console.log('');
console.log(`TOKEN REFS               ${total}`);
console.log(`  REAL variable names    ${real}  (${pct(real, total)}%)  — ${realNamesSeen.size} distinct`);
console.log(`  minted imported.*      ${minted}  (${pct(minted, total)}%)`);
if (other > 0) console.log(`  other                  ${other}`);
console.log('');
for (const [id, r, m] of perSet.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(34)} real ${String(r).padStart(4)}   minted ${String(m).padStart(4)}`);
}
console.log('');
for (const s of captured.skipped) console.log(`  SKIPPED ${JSON.stringify(s.name)} — ${s.reason}`);
console.log('');
console.log(
  WRITE
    ? drift.length === 0
      ? `= unchanged — ${built.size} file(s)`
      : `✎ rewrote ${drift.length} file(s) of ${built.size} — ${drift.join(', ')}`
    : drift.length === 0
      ? `✔ ${built.size} file(s) byte-identical to a rebuild from dumps/MERGED.json`
      : `✖ ${drift.length} file(s) differ from a rebuild — ${drift.join(', ')}`,
);
if (!WRITE && drift.length > 0) process.exit(1);
