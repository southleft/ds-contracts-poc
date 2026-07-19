/**
 * `ds-contracts generate <contracts..> --out <dir>` — contract → code.
 *
 *   --target react (default)   the shipping generator (TSX + CSS Module +
 *                              optional stories + index barrels, prettier-
 *                              formatted) — the exact code path npm run
 *                              generate byte-guards in the reference repo
 *   --target html|react-inline|figma-script|<registered>
 *                              any emitter in the open registry — files are
 *                              written exactly as the emitter returns them
 *   --emitter <module>         dynamic-import a plugin emitter module and
 *                              registerEmitter() it BEFORE generation; the
 *                              module exports an Emitter as `default`,
 *                              `emitter`, or an `emitters` array
 *
 * Positional args are *.contract.json files or directories; the union is
 * both the generation set and the composition-ref resolution scope.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitterByName, getEmitters, registerEmitter, type Emitter } from '../../../../core/emitter.js';
import { generateComponents } from '../../../../scripts/generate-components.js';
import {
  buildEmitterCtx,
  CliUsageError,
  expandContractArgs,
  flagString,
  loadContracts,
  parseFlags,
  splitList,
} from '../lib.js';

/** Load + register a plugin emitter module (path or bare specifier). */
export async function loadEmitterModule(spec: string): Promise<Emitter[]> {
  const target =
    spec.startsWith('.') || spec.startsWith('/') || /\.(m?[tj]s|cjs)$/.test(spec)
      ? pathToFileURL(path.resolve(spec)).href
      : spec;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(target)) as Record<string, unknown>;
  } catch (err) {
    throw new CliUsageError(`--emitter ${spec}: module failed to load — ${String(err instanceof Error ? err.message : err)}`);
  }
  const candidates: unknown[] = Array.isArray(mod.emitters)
    ? (mod.emitters as unknown[])
    : [mod.default ?? mod.emitter];
  const registered: Emitter[] = [];
  for (const c of candidates) {
    if (!c) {
      throw new CliUsageError(
        `--emitter ${spec}: module exports no Emitter (expected \`default\`, \`emitter\`, or an \`emitters\` array)`,
      );
    }
    registered.push(registerEmitter(c as Emitter));
  }
  return registered;
}

export async function generateCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ['out', 'target', 'tokens', 'icons', 'emitter', 'file-key'],
    bool: ['stories'],
  });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError('generate needs at least one contract file or directory');
  }
  const out = flagString(parsed, 'out');
  if (!out) throw new CliUsageError('generate needs --out <dir>');

  const emitterSpec = flagString(parsed, 'emitter');
  if (emitterSpec) {
    for (const e of await loadEmitterModule(emitterSpec)) {
      console.log(`✔ Registered emitter "${e.name}" (${e.label})`);
    }
  }

  const target = flagString(parsed, 'target') ?? 'react';
  const files = expandContractArgs(parsed.positionals);
  const tokenFiles = splitList(flagString(parsed, 'tokens')).map((f) => path.resolve(f));
  const iconsDir = flagString(parsed, 'icons');
  const outDir = path.resolve(out);

  if (target === 'react') {
    // The shipping generator — same exported function `npm run generate`
    // runs (prettier formatting, per-component index, root barrel).
    const { generated } = await generateComponents({
      contractFiles: files,
      tokenFiles: tokenFiles.length > 0 ? tokenFiles : undefined,
      iconsDir,
      outDir,
      stories: parsed.flags.get('stories') === true,
    });
    console.log(`✔ Generated ${generated.length} component(s) → ${outDir}: ${generated.sort().join(', ')}`);
    return 0;
  }

  const emitter = emitterByName.get(target);
  if (!emitter) {
    throw new CliUsageError(
      `Unknown --target "${target}" — registered emitters: ${getEmitters().map((e) => e.name).join(', ')}`,
    );
  }
  const contracts = loadContracts(files);
  const ctx = buildEmitterCtx(contracts, tokenFiles, iconsDir, flagString(parsed, 'file-key'));
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const contract of contracts.values()) {
    for (const file of emitter.emit(contract, ctx)) {
      const dest = path.join(outDir, file.path);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, file.contents);
      written.push(file.path);
    }
  }
  console.log(`✔ Emitted ${written.length} file(s) with "${emitter.name}" → ${outDir}: ${written.join(', ')}`);
  return 0;
}
