/**
 * CLI shared helpers — flag parsing (hand-rolled, zero-dep: repo culture is
 * "no heavy CLI framework"), contract-document loading, and the EmitterCtx
 * builder every emit verb shares.
 *
 * Token layout note (see buildTokenRouting below for the full rule): every
 * `--tokens` entry is ROUTED to one of the five EmitterCtx token slots —
 * primitives / semantic / light / dark / brands.<name>. A flat foreign set
 * still lands in `primitives` (the Polaris/MUI pattern), but a LAYERED set
 * no longer collapses into it: collapsing silently merged light over dark
 * and left `brands` empty, which made `--target react-inline` refuse
 * ("Cannot resolve token …") and made `--target figma-script` emit a canvas
 * with no derived text styles and no Brand collection.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../schema/src/index.js';
import type { EmitterCtx } from '../../../core/emitter.js';
import { flattenTokens } from '../../../core/tokens.js';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

export interface FlagSpec {
  /** Flags that take a value (`--out dir`). */
  value?: string[];
  /** Boolean flags (`--dry-run`). */
  bool?: string[];
}

export class CliUsageError extends Error {}

export function parseFlags(argv: string[], spec: FlagSpec): ParsedArgs {
  const value = new Set(spec.value ?? []);
  const bool = new Set(spec.bool ?? []);
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (value.has(name)) {
      const v = argv[++i];
      if (v === undefined) throw new CliUsageError(`--${name} needs a value`);
      flags.set(name, v);
    } else if (bool.has(name)) {
      flags.set(name, true);
    } else {
      const known = [...value, ...bool].map((f) => `--${f}`).join(', ');
      throw new CliUsageError(`Unknown flag "${arg}" — known flags here: ${known || '(none)'}`);
    }
  }
  return { positionals, flags };
}

export const flagString = (p: ParsedArgs, name: string): string | undefined => {
  const v = p.flags.get(name);
  return typeof v === 'string' ? v : undefined;
};

// ---------------------------------------------------------------------------
// Contract + token loading
// ---------------------------------------------------------------------------

/** Expand positional contract args: each is a *.contract.json file or a
 *  directory (every *.contract.json inside, sorted). The union is BOTH the
 *  generation set and the resolution scope for composition refs. */
export function expandContractArgs(args: string[]): string[] {
  const files: string[] = [];
  for (const a of args) {
    const p = path.resolve(a);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) throw new CliUsageError(`Contract path not found: ${a}`);
    if (st.isDirectory()) {
      const inside = readdirSync(p)
        .filter((f) => f.endsWith('.contract.json'))
        .sort()
        .map((f) => path.join(p, f));
      if (inside.length === 0) throw new CliUsageError(`No *.contract.json files in directory: ${a}`);
      files.push(...inside);
    } else {
      files.push(p);
    }
  }
  return [...new Set(files)];
}

export function loadContracts(files: string[]): Map<string, Contract> {
  const byId = new Map<string, Contract>();
  const errors: string[] = [];
  for (const f of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(f, 'utf8'));
    } catch (err) {
      errors.push(`${f}: not JSON — ${String(err instanceof Error ? err.message : err)}`);
      continue;
    }
    const parsed = ContractSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(
        `${path.basename(f)}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
      continue;
    }
    if (byId.has(parsed.data.id)) {
      errors.push(`${path.basename(f)}: duplicate contract id "${parsed.data.id}"`);
      continue;
    }
    byId.set(parsed.data.id, parsed.data);
  }
  if (errors.length > 0) {
    throw new CliUsageError(`✘ Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return byId;
}

const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      a[k] = v;
    }
  }
  return a;
};

export function loadIcons(iconsDir?: string): Map<string, string> {
  if (!iconsDir) return new Map();
  try {
    return new Map(
      readdirSync(iconsDir)
        .filter((f) => f.endsWith('.svg'))
        .sort()
        .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(iconsDir, f), 'utf8').trim()]),
    );
  } catch {
    throw new CliUsageError(`Icons directory not readable: ${iconsDir}`);
  }
}

// ---------------------------------------------------------------------------
// Token routing — which `--tokens` file feeds which EmitterCtx slot
// ---------------------------------------------------------------------------
//
// EmitterCtx.tokens is LAYERED (primitives / semantic / light / dark /
// brands.<name>), and the layers are not interchangeable:
//
//   · react + html read a flat INVENTORY of all four non-brand slots, so they
//     never noticed the collapse — which is why `--target html` "worked".
//   · react-inline RESOLVES literals through primitives → brands.default →
//     semantic → the SELECTED mode. Collapsing everything into `primitives`
//     left brands empty (unresolvable `{brand.*}` aliases → a hard refusal)
//     and merged dark over light (silently DARK output under a header that
//     says "Resolution mode: light").
//   · figma-script derives named text styles from the SEMANTIC typography
//     tokens and builds the Brand collection from `brands` — an empty
//     semantic slot silently drops every text style from the canvas.
//
// The rule, in order (each `--tokens` entry is classified exactly once):
//
//   1. EXPLICIT — `slot=path`. Slots: primitives, semantic, light, dark,
//      brand (= brand.default), brand.<name>. An unknown slot REFUSES BY
//      NAME; it is never quietly demoted to primitives.
//   2. CONVENTION — only for the repo's declared layered format, `*.tokens
//      .json`: `brand.<name>.tokens.json` → brands.<name>; a `dark` segment →
//      dark; a `light` segment → light; a `semantic` segment → semantic;
//      a `primitives`/`primitive` segment → primitives.
//   3. FLAT-SET DEFAULT — everything else (`*.dtcg.json`, any other name) is
//      a flat foreign set and lands in `primitives`, exactly as before. This
//      is what keeps every published example byte-identical.
//
// Then the SAFETY NET, which is the part that makes the default safe: if two
// files that landed in the SAME slot define the same token path with
// DIFFERENT values, one of them is being silently overwritten — refuse by
// name and point at `slot=`. That is precisely the light/dark collapse, and
// it fires for any naming scheme the convention could not classify (a user's
// `theme-light.dtcg.json` + `theme-dark.dtcg.json` refuses instead of
// emitting a dark component that claims to be light). Verified against every
// token set this repo publishes: zero same-slot value collisions.

const SLOT_NAMES = 'primitives, semantic, light, dark, brand, brand.<name>';
const CANONICAL_SLOTS = new Set(['primitives', 'semantic', 'light', 'dark']);
/** A slot prefix is a bare word (optionally `brand.<name>`) — never a path,
 *  so `--tokens ./a=b.json` stays a filename. */
const SLOT_PREFIX_SHAPE = /^[a-zA-Z]+(\.[a-zA-Z0-9-]+)?$/;

/** Split "slot=path" into its parts; `slot` is '' when the entry is a bare
 *  path (including any path that happens to contain an `=`). */
export const parseTokenEntry = (entry: string): { prefix: string; file: string } => {
  const eq = entry.indexOf('=');
  if (eq <= 0) return { prefix: '', file: entry };
  const prefix = entry.slice(0, eq);
  return SLOT_PREFIX_SHAPE.test(prefix)
    ? { prefix, file: entry.slice(eq + 1) }
    : { prefix: '', file: entry };
};

export interface TokenRouteDecision {
  file: string;
  slot: string;
  why: 'explicit' | 'convention' | 'flat-set default';
}

export interface TokenRouting {
  /** slot key ("primitives" | "semantic" | "light" | "dark" | "brand.<name>")
   *  → parsed, deep-merged tree. */
  bySlot: Map<string, Record<string, unknown>>;
  decisions: TokenRouteDecision[];
}

const normalizeSlot = (raw: string, entry: string): string => {
  const slot = raw.trim().toLowerCase();
  if (CANONICAL_SLOTS.has(slot)) return slot;
  if (slot === 'brand' || slot === 'brands') return 'brand.default';
  const m = /^brands?\.([a-z0-9][a-z0-9-]*)$/.exec(slot);
  if (m) return `brand.${m[1]}`;
  throw new CliUsageError(
    `--tokens "${entry}": unknown slot "${raw}" — known slots: ${SLOT_NAMES}`,
  );
};

/** Classify an unprefixed token file from its name. Returns the slot and how
 *  confident we are about it (the "why" is printed in diagnostics). */
export function classifyTokenFile(file: string): { slot: string; why: 'convention' | 'flat-set default' } {
  const base = path.basename(file);
  const brand = /^brands?\.([a-z0-9][a-z0-9-]*)\.tokens\.json$/i.exec(base);
  if (brand) return { slot: `brand.${brand[1].toLowerCase()}`, why: 'convention' };
  if (/\.tokens\.json$/i.test(base)) {
    const segments = base.slice(0, -'.tokens.json'.length).toLowerCase().split('.');
    if (segments.includes('dark')) return { slot: 'dark', why: 'convention' };
    if (segments.includes('light')) return { slot: 'light', why: 'convention' };
    if (segments.includes('semantic')) return { slot: 'semantic', why: 'convention' };
    if (segments.includes('primitives') || segments.includes('primitive'))
      return { slot: 'primitives', why: 'convention' };
  }
  return { slot: 'primitives', why: 'flat-set default' };
}

const TOKEN_FILE_RE = /\.(tokens|dtcg)\.json$/i;

/** Expand the raw `--tokens` value into resolved entries, each optionally
 *  carrying an explicit `slot=` prefix. A DIRECTORY expands to every
 *  *.tokens.json / *.dtcg.json inside it (recursive, sorted) — so the repo's
 *  own layout is one flag: `--tokens tokens`. */
export function expandTokenArgs(raw: string | string[] | undefined, baseDir?: string): string[] {
  const out: string[] = [];
  const entries = Array.isArray(raw) ? raw.filter(Boolean) : splitList(raw);
  for (const entry of entries) {
    const { prefix, file: rest } = parseTokenEntry(entry);
    if (prefix) normalizeSlot(prefix, entry); // refuse unknown slots up front
    const resolved = baseDir ? path.resolve(baseDir, rest) : path.resolve(rest);
    const st = statSync(resolved, { throwIfNoEntry: false });
    if (!st) throw new CliUsageError(`Token path not found: ${rest}`);
    if (!st.isDirectory()) {
      out.push(prefix ? `${prefix}=${resolved}` : resolved);
      continue;
    }
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        const s = statSync(p, { throwIfNoEntry: false });
        if (!s) continue;
        if (s.isDirectory()) walk(p);
        else if (TOKEN_FILE_RE.test(name)) found.push(p);
      }
    };
    walk(resolved);
    if (found.length === 0) {
      throw new CliUsageError(`No *.tokens.json / *.dtcg.json files in directory: ${rest}`);
    }
    if (prefix) {
      throw new CliUsageError(
        `--tokens "${entry}": a slot prefix names ONE tree — "${rest}" is a directory (${found.length} files). Drop the prefix, or list the files.`,
      );
    }
    out.push(...found.sort());
  }
  return out;
}

/** Strip slot prefixes — for consumers that want plain paths (the `react`
 *  target hands its file list to the repo generator, which builds its own
 *  flat inventory and does not care about layering). */
export const tokenPathsOf = (entries: string[]): string[] =>
  entries.map((e) => parseTokenEntry(e).file);

/** Route every `--tokens` entry to its slot, deep-merging within a slot, and
 *  refusing by name when two files in the same slot fight over a token. */
export function buildTokenRouting(tokenEntries: string[]): TokenRouting {
  const bySlot = new Map<string, Record<string, unknown>>();
  const decisions: TokenRouteDecision[] = [];
  // path → {file, value} of whatever already claimed it, per slot.
  const claimed = new Map<string, Map<string, { file: string; value: string }>>();
  const collisions: string[] = [];

  for (const entry of tokenEntries) {
    const { prefix, file } = parseTokenEntry(entry);
    const explicit = prefix ? normalizeSlot(prefix, entry) : '';
    const { slot, why } = explicit
      ? { slot: explicit, why: 'explicit' as const }
      : classifyTokenFile(file);

    let tree: Record<string, unknown>;
    try {
      tree = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      throw new CliUsageError(
        `Token file not readable as JSON: ${file} — ${String(err instanceof Error ? err.message : err)}`,
      );
    }

    const seen = claimed.get(slot) ?? new Map<string, { file: string; value: string }>();
    for (const [tokenPath, leaf] of flattenTokens(tree)) {
      const value = JSON.stringify(leaf.value);
      const prev = seen.get(tokenPath);
      if (prev && prev.value !== value) {
        collisions.push(
          `${tokenPath}: ${path.basename(prev.file)} says ${prev.value}, ${path.basename(file)} says ${value}`,
        );
      }
      seen.set(tokenPath, { file, value });
    }
    claimed.set(slot, seen);

    let target = bySlot.get(slot);
    if (!target) bySlot.set(slot, (target = {}));
    deepMerge(target, tree);
    decisions.push({ file, slot, why });
  }

  if (collisions.length > 0) {
    const shown = collisions.slice(0, 5);
    throw new CliUsageError(
      `Refused — ${collisions.length} token(s) defined twice with different values inside ONE slot; the merge would silently drop one layer:\n` +
        shown.map((c) => `  - ${c}`).join('\n') +
        (collisions.length > shown.length ? `\n  … and ${collisions.length - shown.length} more` : '') +
        `\nIf these are separate layers (light/dark, brand modes), name the slot: --tokens light=<file>,dark=<file>. Slots: ${SLOT_NAMES}`,
    );
  }
  return { bySlot, decisions };
}

/** One-line-per-file account of where each token tree landed — printed with
 *  any "Cannot resolve token" failure, so an empty slot is visible instead of
 *  being a mystery. */
export function describeTokenRouting(routing: TokenRouting): string {
  if (routing.decisions.length === 0) return '  (no --tokens files were given — every slot is empty)';
  const lines = routing.decisions.map(
    (d) => `  ${d.slot.padEnd(14)} ← ${path.basename(d.file)}  [${d.why}]`,
  );
  const empty = ['primitives', 'semantic', 'light', 'dark', 'brand.default'].filter(
    (s) => !routing.bySlot.has(s),
  );
  if (empty.length > 0) lines.push(`  EMPTY SLOTS: ${empty.join(', ')}`);
  return lines.join('\n');
}

/** Run an emit and, if a token ref cannot be resolved, re-throw naming the
 *  slot layout that was actually loaded. */
export function withTokenDiagnostics<T>(routing: TokenRouting, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (!/Cannot resolve token/.test(msg)) throw err;
    throw new CliUsageError(
      `${msg}\nToken slots as loaded from --tokens:\n${describeTokenRouting(routing)}\n` +
        `A ref that leaves the loaded inventory is usually a MISSING LAYER (a brand tree, a mode tree), not a bad contract. ` +
        `Pass the whole layout — a directory works: --tokens <dir> — or name slots explicitly (${SLOT_NAMES}).`,
    );
  }
}

/** Build the shared EmitterCtx from routed token files + icons + scope. */
export function buildEmitterCtx(
  contracts: Map<string, Contract>,
  tokenEntries: string[],
  iconsDir?: string,
  fileKey?: string,
): EmitterCtx {
  return buildEmitterCtxWithRouting(contracts, tokenEntries, iconsDir, fileKey).ctx;
}

export function buildEmitterCtxWithRouting(
  contracts: Map<string, Contract>,
  tokenEntries: string[],
  iconsDir?: string,
  fileKey?: string,
): { ctx: EmitterCtx; routing: TokenRouting } {
  const routing = buildTokenRouting(tokenEntries);
  const brands: Record<string, Record<string, unknown>> = { default: {} };
  for (const [slot, tree] of routing.bySlot) {
    if (slot.startsWith('brand.')) brands[slot.slice('brand.'.length)] = tree;
  }
  return {
    ctx: {
      tokens: {
        primitives: routing.bySlot.get('primitives') ?? {},
        semantic: routing.bySlot.get('semantic') ?? {},
        light: routing.bySlot.get('light') ?? {},
        dark: routing.bySlot.get('dark') ?? {},
        brands,
      },
      icons: loadIcons(iconsDir),
      contracts,
      fileKey,
    },
    routing,
  };
}

export const splitList = (v: string | undefined): string[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
