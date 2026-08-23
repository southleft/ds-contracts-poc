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
 *
 * ATOMIC PER CONTRACT: a contract that fails to parse, validate or emit is
 * refused BY NAME (and so is anything composing it); every other contract
 * is written; the verb exits 1 with the refused list. A refused contract
 * leaves no file.
 *
 * EVERY code target also gets `<out>/tokens.css` — the custom-property sheet
 * the emitted CSS references (core/emit-tokens-css.ts): `:root` for the
 * default/light slot, `[data-theme="dark"]` for dark, `[data-brand="<n>"]`
 * per brand. The react shell writes it inside generateComponents(); the
 * registry targets get it here, after the emit, behind the same gate:
 * referenced ⊆ defined, or refuse by name.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Emitter } from '@ds-contracts/core';
// The registry comes through the repo's core/emitter.ts, which registers the
// four built-ins into @ds-contracts/core's registry at load — importing the
// registry from the package alone would see them only if something else in
// the graph had loaded the built-ins first.
import { emitterByName, getEmitters, registerEmitter } from '../../../../core/emitter.js';
import { emitTokensCss, referencedCssVars, tokensCssLayers, undefinedCssVars } from '../../../../core/emit-tokens-css.js';
import {
  describeRefused,
  describeTokensCss,
  generateComponents,
  orderActive,
  parseContractFiles,
  RefusalLedger,
} from '../../../../scripts/generate-components.js';
import {
  buildEmitterCtxWithRouting,
  CliUsageError,
  expandContractArgs,
  expandTokenArgs,
  flagString,
  parseFlags,
  parseTokenEntry,
  withTokenDiagnostics,
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
  const tokenEntries = expandTokenArgs(flagString(parsed, 'tokens'));
  const iconsDir = flagString(parsed, 'icons');
  const outDir = path.resolve(out);

  // BYTE-STABLE across output dirs: the header names the verb and the token
  // files, never `--out` or the contract paths (cli-smoke generates the same
  // set into gen-a/ and gen-b/ and hashes the trees equal).
  const regenerateHint = `ds-contracts generate <contracts..> --out <dir> --target ${target}${
    tokenEntries.length > 0
      ? ` --tokens ${tokenEntries
          .map((e) => {
            const { prefix, file } = parseTokenEntry(e);
            return prefix ? `${prefix}=${path.basename(file)}` : path.basename(file);
          })
          .join(',')}`
      : ''
  }`;
  if (target === 'react') {
    // The shipping generator — same exported function `npm run generate`
    // runs (prettier formatting, per-component index, root barrel,
    // tokens.css). Slot prefixes travel WITH the entries: the generator
    // routes them through the same lib.ts rule as every other target.
    const { generated, refused, tokensCss } = await generateComponents({
      contractFiles: files,
      tokenFiles: tokenEntries.length > 0 ? tokenEntries : undefined,
      iconsDir,
      outDir,
      stories: parsed.flags.get('stories') === true,
      regenerateHint,
    });
    console.log(`✔ Generated ${generated.length} component(s) → ${outDir}: ${generated.sort().join(', ')}`);
    if (generated.length > 0) for (const line of describeTokensCss(tokensCss)) console.log(line);
    for (const line of describeRefused(refused)) console.error(line);
    return refused.length > 0 ? 1 : 0;
  }

  const emitter = emitterByName.get(target);
  if (!emitter) {
    throw new CliUsageError(
      `Unknown --target "${target}" — registered emitters: ${getEmitters().map((e) => e.name).join(', ')}`,
    );
  }
  // Per-contract parse + identity + graph refusals (the react shell's
  // ledger) — a contract that does not parse refuses by name, the rest go on.
  const { parsed: parsedContracts, refused: parseRefusals } = parseContractFiles(files);
  const ledger = new RefusalLedger(parsedContracts, parseRefusals);
  ledger.propagate();
  const contracts = new Map(parsedContracts.map((e) => [e.contract.id, e.contract]));
  let ordered = orderActive(ledger);
  const { ctx, routing } = buildEmitterCtxWithRouting(
    contracts,
    tokenEntries,
    iconsDir,
    flagString(parsed, 'file-key'),
  );
  // Emit everything to memory first, PER CONTRACT: an emitter refusal names
  // that contract (and everything composing it) and leaves it no file; the
  // rest are written.
  const plannedById = new Map<string, { path: string; contents: string }[]>();
  for (const contract of ordered) {
    try {
      plannedById.set(
        contract.id,
        withTokenDiagnostics(routing, () => emitter.emit(contract, ctx)).map((file) => ({ path: file.path, contents: file.contents })),
      );
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      ledger.refuse(contract.id, [message.startsWith(`${contract.id}:`) ? message : `${contract.id}: ${message}`]);
    }
  }
  ledger.propagate();
  ordered = ordered.filter((c) => !ledger.has(c.id));
  const planned = ordered.flatMap((c) => plannedById.get(c.id)!);
  // tokens.css beside the emitted files, gated: every var(--x) the
  // stylesheets reference (.css, .css.ts, .html — never a .js/.tsx comment)
  // must be defined in :root.
  let sheet;
  try {
    sheet = emitTokensCss(tokensCssLayers(ctx.tokens), {
      sources: routing.decisions.map((d) => `${path.basename(d.file)} [${d.slot}]`),
      regenerate: regenerateHint,
    });
  } catch (err) {
    throw new CliUsageError(`tokens.css ${String(err instanceof Error ? err.message : err)}`);
  }
  const referencedBy = new Map<string, string[]>();
  for (const file of planned) {
    if (!/\.(css|css\.ts|html)$/.test(file.path)) continue;
    for (const name of referencedCssVars(file.contents)) {
      referencedBy.set(name, [...(referencedBy.get(name) ?? []), file.path]);
    }
  }
  const missing = undefinedCssVars(referencedBy.keys(), sheet.defined);
  if (missing.length > 0) {
    throw new CliUsageError(
      `Refused — ${missing.length} custom propert(ies) the emitted "${emitter.name}" stylesheets reference are not defined in tokens.css (they would render as nothing, silently):\n` +
        missing.map((n) => `  - ${n} — referenced by ${referencedBy.get(n)!.join(', ')}`).join('\n'),
    );
  }
  if (ordered.length > 0) planned.push({ path: 'tokens.css', contents: sheet.css });

  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const file of planned) {
    const dest = path.join(outDir, file.path);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, file.contents);
    written.push(file.path);
  }
  console.log(`✔ Emitted ${written.length} file(s) with "${emitter.name}" → ${outDir}: ${written.join(', ')}`);
  for (const line of describeTokensCss({
    path: path.join(outDir, 'tokens.css'),
    defined: sheet.defined.length,
    referenced: referencedBy.size,
    unreferenced: sheet.defined.filter((n) => !referencedBy.has(n)).length,
    modes: sheet.modes,
    danglingAliases: sheet.danglingAliases,
    skippedComposite: sheet.skippedComposite,
  })) {
    if (ordered.length > 0) console.log(line);
  }
  for (const line of describeRefused(ledger.refused)) console.error(line);
  return ledger.refused.length > 0 ? 1 : 0;
}
