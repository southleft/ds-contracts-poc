/**
 * `ds-contracts figma` — the canvas as an emit target, both directions.
 *
 *   figma <contracts..> --out <dir> [--tokens f,f] [--icons dir] [--file-key KEY]
 *       emit one Figma Plugin API sync script per contract
 *       (core/emit-figma-script — referee-gated, same engine as the repo)
 *
 *   figma push <bundle-or-contract.json> --code <PAIRING-CODE> [--bridge <url>]
 *       send a CONTRACTS-BUNDLE through the plugin bridge under a pairing
 *       code (the reverse direction of Send-to-Playground). A single
 *       contract document is wrapped into a one-contract bundle. The bridge
 *       stays a dumb pipe: the payload is tagged, never inspected beyond
 *       "is it JSON / is it a well-formed bundle envelope".
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaScriptEmitter } from '../../../../core/emitter.js';
import {
  buildEmitterCtx,
  CliUsageError,
  expandContractArgs,
  flagString,
  loadContracts,
  parseFlags,
  splitList,
} from '../lib.js';

export const DEFAULT_BRIDGE_URL = 'https://ds-contracts-assist.southleft-llc.workers.dev';

/** The bundle envelope the bridge and the plugin agree on. */
export const CONTRACTS_BUNDLE_TYPE = 'CONTRACTS-BUNDLE';

export interface ContractsBundle {
  type: typeof CONTRACTS_BUNDLE_TYPE;
  version: 1;
  contracts: unknown[];
}

/** Read a file as a bundle: an existing CONTRACTS-BUNDLE envelope passes
 *  through; a single contract document (has id/name) is wrapped. */
export function toBundle(filePath: string): ContractsBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new CliUsageError(`${filePath}: not JSON — ${String(err instanceof Error ? err.message : err)}`);
  }
  if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === CONTRACTS_BUNDLE_TYPE) {
    const contracts = (raw as { contracts?: unknown }).contracts;
    if (!Array.isArray(contracts) || contracts.length === 0) {
      throw new CliUsageError(`${filePath}: a ${CONTRACTS_BUNDLE_TYPE} needs a non-empty "contracts" array`);
    }
    return { type: CONTRACTS_BUNDLE_TYPE, version: 1, contracts };
  }
  if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
    return { type: CONTRACTS_BUNDLE_TYPE, version: 1, contracts: [raw] };
  }
  throw new CliUsageError(
    `${filePath}: neither a contract document (no "id") nor a ${CONTRACTS_BUNDLE_TYPE} envelope`,
  );
}

async function pushCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ['code', 'bridge'] });
  const file = parsed.positionals[0];
  if (!file) throw new CliUsageError('figma push needs a bundle or contract JSON file');
  const code = flagString(parsed, 'code');
  if (!code) {
    throw new CliUsageError(
      'figma push needs --code <PAIRING-CODE> — the 6-character code shown in the Figma plugin’s Receive panel',
    );
  }
  const base = (
    flagString(parsed, 'bridge') ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, '');
  const bundle = toBundle(file);
  const body = JSON.stringify(bundle);
  const res = await fetch(`${base}/bridge/${encodeURIComponent(code.toUpperCase())}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const answer = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; bytes?: number };
  if (!res.ok) {
    console.error(`✘ bridge refused (${res.status}): ${answer.error ?? 'unnamed error'}`);
    return 1;
  }
  console.log(
    `✔ Pushed ${CONTRACTS_BUNDLE_TYPE} (${bundle.contracts.length} contract(s), ${body.length} bytes) under code ${code.toUpperCase()} — deliver-once, 15-minute TTL`,
  );
  return 0;
}

export async function figmaCommand(argv: string[]): Promise<number> {
  if (argv[0] === 'push') return pushCommand(argv.slice(1));

  const parsed = parseFlags(argv, { value: ['out', 'tokens', 'icons', 'file-key'] });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError('figma needs contract files/directories (or the `push` subcommand)');
  }
  const out = flagString(parsed, 'out');
  if (!out) throw new CliUsageError('figma needs --out <dir>');
  const files = expandContractArgs(parsed.positionals);
  const contracts = loadContracts(files);
  const ctx = buildEmitterCtx(
    contracts,
    splitList(flagString(parsed, 'tokens')).map((f) => path.resolve(f)),
    flagString(parsed, 'icons'),
    flagString(parsed, 'file-key'),
  );
  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const contract of contracts.values()) {
    for (const file of figmaScriptEmitter.emit(contract, ctx)) {
      writeFileSync(path.join(outDir, file.path), file.contents);
      written.push(file.path);
    }
  }
  console.log(`✔ Emitted ${written.length} Figma sync script(s) → ${outDir}: ${written.join(', ')}`);
  return 0;
}
