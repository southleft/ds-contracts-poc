/**
 * CLI shared helpers — flag parsing (hand-rolled, zero-dep: repo culture is
 * "no heavy CLI framework"), contract-document loading, and the EmitterCtx
 * builder every emit verb shares.
 *
 * Token layout note: the CLI accepts a FLAT list of DTCG files and deep-
 * merges them into the `primitives` slot — the same "flat foreign set maps
 * to the Primitives collection" pattern the Polaris showcase established
 * (examples/polaris/generate.ts). The repo's 4-tree layout stays a repo
 * feature; a consumer's token set rides one or more files.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../schema/src/index.js';
import type { EmitterCtx } from '../../../core/emitter.js';

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

/** Build the shared EmitterCtx from flat token files + icons + scope. */
export function buildEmitterCtx(
  contracts: Map<string, Contract>,
  tokenFiles: string[],
  iconsDir?: string,
  fileKey?: string,
): EmitterCtx {
  const primitives: Record<string, unknown> = {};
  for (const f of tokenFiles) {
    try {
      deepMerge(primitives, JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>);
    } catch (err) {
      throw new CliUsageError(`Token file not readable as JSON: ${f} — ${String(err instanceof Error ? err.message : err)}`);
    }
  }
  return {
    tokens: { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: loadIcons(iconsDir),
    contracts,
    fileKey,
  };
}

export const splitList = (v: string | undefined): string[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
