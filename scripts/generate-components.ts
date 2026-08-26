/**
 * Contract → code generator — the CLI SHELL. (v2 — composition)
 *
 * All contract→code string building lives in core/emit-react.ts (pure,
 * browser-importable); this script owns only the file system: read
 * contracts/ + tokens/ + assets/icons/, run the core emitters, format, and
 * write per component:
 *
 *   src/components/<Name>/<Name>.tsx           React component
 *   src/components/<Name>/<Name>.module.css    styles from anatomy token bindings
 *   src/components/<Name>/<Name>.stories.tsx   CSF3 stories (argTypes from contract)
 *   src/components/<Name>/index.ts             re-export
 *   src/components/tokens.css                  EVERY custom property the CSS Modules
 *                                              reference — `:root` (default/light slot)
 *                                              + `[data-theme="dark"]` + `[data-brand=…]`
 *                                              (core/emit-tokens-css.ts); the root barrel
 *                                              and every story import it
 *
 * Output is byte-guarded by evals/golden.json (the golden-generated-output
 * eval): refactors of the core must not change a single emitted byte.
 *
 * ATOMIC PER CONTRACT (phase-2 exam, 2026-08-22): a contract that fails to
 * parse, validate, or emit is REFUSED BY NAME and leaves no file; every
 * contract that validates is generated; a contract depending on a refused
 * one is refused too ("depends on refused contract"). The shells print the
 * generated set AND the refused list and exit non-zero when anything was
 * refused. A batch-level failure (token routing, tokens.css itself) still
 * throws ContractViolationError and writes nothing.
 *
 * Generated files are never edited by hand. To change a component, change
 * its contract and re-run `npm run generate`.
 *
 * PARAMETERIZED (Phase 1, @ds-contracts/cli): every path is now an option —
 *   --contracts <dir>   contract documents        (default: <cwd>/contracts)
 *   --tokens <files>    comma-separated DTCG files, optionally `slot=path`
 *                       (default: the repo's layered layout incl. brand.* trees)
 *   --icons <dir>       SVG icon assets           (default: <cwd>/assets/icons)
 *   --out <dir>         output root               (default: <cwd>/src/components)
 * Defaults are the repo paths, so `npm run generate` is byte-identical to
 * the pre-parameterization script. The `ds-contracts generate` verb calls
 * the same exported generateComponents() — one code path, two shells.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, componentRefsOf, slotsOf, sortByDependencies, type Contract } from './contract-schema.js';
import { generateCss, generateStories, generateTsx, validateContract } from '../core/emit-react.js';
import {
  emitTokensCss,
  referencedCssVars,
  tokensCssLayers,
  undefinedCssVars,
  type TokensCssReport,
} from '../core/emit-tokens-css.js';
import { formatCss, formatTsx } from '../core/format.js';
import { tokenInventoryFromJson } from '../core/tokens.js';
import { checkRequiredFacts } from '../core/required-facts.js';
// Token ROUTING (which file is the dark slot, which the brand) is the CLI's
// rule — one rule for every target, so the react shell cannot call a tree
// "dark" that `--target html` calls "primitives". lib.ts imports only core/
// and the schema package; no cycle.
import { buildTokenRouting, tokenTreesFromRouting } from '../packages/cli/src/lib.js';

export interface GenerateComponentsOptions {
  /** Directory of *.contract.json documents. */
  contractsDir?: string;
  /** Explicit contract document paths — when present, these are the set
   *  (contractsDir is not listed). The CLI's `generate <contracts..>` uses
   *  this; the npm script keeps directory discovery. */
  contractFiles?: string[];
  /** DTCG token files — the union is the token inventory. An entry may carry
   *  a `slot=` prefix (primitives, semantic, light, dark, brand, brand.<name>;
   *  see packages/cli/src/lib.ts) — the slot decides which tokens.css block
   *  the tree lands in; a bare `*.dtcg.json` is the default (`:root`) slot. */
  tokenFiles?: string[];
  /** Directory of <name>.svg icon assets. */
  iconsDir?: string;
  /** Output root — one directory per component is written under it. */
  outDir?: string;
  /** Emit <Name>.stories.tsx per component (default true — the repo path). */
  stories?: boolean;
  /** The "Regenerate with:" line in the emitted tokens.css header. */
  regenerateHint?: string;
}

/** What landed in <outDir>/tokens.css — printed by both shells, asserted by
 *  core/css-vars-check.ts. Counts, not judgements: an unreferenced token is
 *  a fact about the inventory, not a defect. */
export interface TokensCssSummary {
  path: string;
  /** Custom properties defined in `:root`. */
  defined: number;
  /** Distinct `var(--x)` names the generated CSS Modules reference. */
  referenced: number;
  unreferenced: number;
  modes: TokensCssReport['modes'];
  danglingAliases: string[];
  skippedComposite: string[];
}

/** One line per fact, the same wording in `npm run generate` and the CLI. */
export function describeTokensCss(t: TokensCssSummary): string[] {
  const modes = t.modes.length > 0 ? ` + ${t.modes.map((m) => `${m.selector} (${m.count})`).join(', ')}` : '';
  const lines = [
    `✔ tokens.css: ${t.defined} custom properties in :root${modes} → ${t.path} — ${t.referenced} referenced by the components, ${t.unreferenced} unreferenced`,
  ];
  if (t.danglingAliases.length > 0) {
    lines.push(
      `⚠ tokens.css: ${t.danglingAliases.length} alias target(s) are in none of the supplied token files (kept as var() refs — define them in a stylesheet of your own, or pass the missing tree): ${t.danglingAliases.slice(0, 5).join(', ')}${t.danglingAliases.length > 5 ? ', …' : ''}`,
    );
  }
  if (t.skippedComposite.length > 0) {
    lines.push(
      `⚠ tokens.css: ${t.skippedComposite.length} composite token(s) have no single-custom-property form and were skipped: ${t.skippedComposite.slice(0, 5).join(', ')}${t.skippedComposite.length > 5 ? ', …' : ''}`,
    );
  }
  return lines;
}

/** Named refusal — the caller prints `header` then one `  - line` per error
 *  and exits 1 (both shells keep the exact historical wording). */
export class ContractViolationError extends Error {
  constructor(
    public header: string,
    public violations: string[],
  ) {
    super(`${header}\n${violations.map((e) => `  - ${e}`).join('\n')}`);
  }
}

interface PlannedFile {
  path: string;
  contents: string;
}

/** One refused contract — by id (the file's basename when it did not even
 *  parse), with every violation named. */
export interface RefusedContract {
  id: string;
  file: string;
  violations: string[];
}

/** Direct composition dependencies of a contract (component refs, slot
 *  accepts, slot defaultContent) — the edges a refusal propagates along. */
export function contractDependencyIds(contract: Contract): string[] {
  const ids = new Set<string>();
  for (const { ref } of componentRefsOf(contract)) ids.add(ref.id);
  for (const { slot } of slotsOf(contract)) {
    for (const id of slot.accepts ?? []) ids.add(id);
    for (const item of slot.defaultContent ?? []) ids.add(item.id);
  }
  return [...ids];
}

/** Parse contract files leniently: a file that is not JSON or not a valid
 *  contract is REFUSED BY NAME (the file's basename, or its `id` when the
 *  document carries one), never a batch failure. Duplicate ids and names
 *  refuse every contract involved. Shared by both generate shells. */
export function parseContractFiles(files: string[]): {
  parsed: { contract: Contract; file: string }[];
  refused: RefusedContract[];
} {
  const refused: RefusedContract[] = [];
  const parsed: { contract: Contract; file: string }[] = [];
  for (const filePath of files) {
    const file = path.basename(filePath);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      refused.push({ id: file, file: filePath, violations: [`${file}: not JSON — ${String(err instanceof Error ? err.message : err)}`] });
      continue;
    }
    const result = ContractSchema.safeParse(raw);
    if (!result.success) {
      const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : file;
      refused.push({
        id,
        file: filePath,
        violations: [`${file}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`],
      });
      continue;
    }
    parsed.push({ contract: result.data, file: filePath });
  }
  // Identity gates: contract ids and names must be unique across the set —
  // a duplicate id silently forks identity in the dependency map; a
  // duplicate name silently clobbers the other contract's generated output.
  const byIdCount = new Map<string, { contract: Contract; file: string }[]>();
  const byNameCount = new Map<string, { contract: Contract; file: string }[]>();
  for (const e of parsed) {
    byIdCount.set(e.contract.id, [...(byIdCount.get(e.contract.id) ?? []), e]);
    byNameCount.set(e.contract.name, [...(byNameCount.get(e.contract.name) ?? []), e]);
  }
  const dropped = new Set<{ contract: Contract; file: string }>();
  for (const [id, entries] of byIdCount) {
    if (entries.length < 2) continue;
    for (const e of entries) {
      refused.push({
        id,
        file: e.file,
        violations: [`${id}: duplicate contract id (declared by ${entries.map((x) => path.basename(x.file)).join(', ')})`],
      });
      dropped.add(e);
    }
  }
  for (const [name, entries] of byNameCount) {
    if (entries.length < 2) continue;
    for (const e of entries) {
      if (dropped.has(e)) continue;
      refused.push({
        id: e.contract.id,
        file: e.file,
        violations: [
          `${e.contract.id}: duplicate contract name "${name}" (also used by ${entries
            .filter((x) => x !== e)
            .map((x) => x.contract.id)
            .join(', ')}) — would overwrite <out>/${name}/`,
        ],
      });
      dropped.add(e);
    }
  }
  return { parsed: parsed.filter((e) => !dropped.has(e)), refused };
}

/** The refusal ledger of one batch: refuse by id, then propagate along the
 *  composition graph so no generated file imports a component that was not
 *  written. Deterministic: propagation walks the batch in input order. */
export class RefusalLedger {
  readonly refused: RefusedContract[] = [];
  private readonly ids = new Set<string>();
  constructor(
    private readonly entries: { contract: Contract; file: string }[],
    seed: RefusedContract[] = [],
  ) {
    for (const r of seed) this.refused.push(r), this.ids.add(r.id);
  }
  has(id: string): boolean {
    return this.ids.has(id);
  }
  refuse(id: string, violations: string[]): void {
    const file = this.entries.find((e) => e.contract.id === id)?.file ?? id;
    const existing = this.refused.find((r) => r.id === id);
    if (existing) existing.violations.push(...violations);
    else this.refused.push({ id, file, violations: [...violations] });
    this.ids.add(id);
  }
  /** Refuse every active contract that depends (transitively) on a refused one. */
  propagate(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const { contract } of this.entries) {
        if (this.ids.has(contract.id)) continue;
        const dep = contractDependencyIds(contract).find((d) => this.ids.has(d));
        if (dep === undefined) continue;
        this.refuse(contract.id, [`${contract.id}: depends on refused contract "${dep}" — not generated`]);
        changed = true;
      }
    }
  }
  active(): Contract[] {
    return this.entries.filter((e) => !this.ids.has(e.contract.id)).map((e) => e.contract);
  }
}

/** Topological order of the active set; a cycle or a reference to a contract
 *  that was never in the batch refuses the contracts on that chain (by name)
 *  and the sort is retried — deterministic, bounded by the batch size. */
export function orderActive(ledger: RefusalLedger): Contract[] {
  for (let guard = 0; ; guard++) {
    const active = ledger.active();
    try {
      return sortByDependencies(active);
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      const chain = message.match(/(?:cycle|dependency): (.+)$/)?.[1];
      const offenders = chain
        ? chain.split(' → ').map((s) => s.trim()).filter((id) => active.some((c) => c.id === id))
        : [message.match(/^([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*): /)?.[1] ?? ''].filter((id) => active.some((c) => c.id === id));
      if (offenders.length === 0 || guard > active.length + 1) {
        throw new ContractViolationError('✘ Refused — 1 contract violation(s):', [message]);
      }
      for (const id of offenders) ledger.refuse(id, [message]);
      ledger.propagate();
    }
  }
}

/** The repo's layered layout — the same files scripts/build-tokens.mjs
 *  reads, brand trees included (discovered, sorted), so the emitted
 *  tokens.css resolves every `{brand.*}` alias instead of leaving it dangling.
 *  Brand files are named explicitly by slot: the filename convention in
 *  packages/cli/src/lib.ts would classify them the same way, but a default
 *  should not depend on a heuristic. */
const defaultTokenFiles = (root: string) => {
  const modes = path.join(root, 'tokens', 'modes');
  let brandFiles: string[] = [];
  try {
    brandFiles = readdirSync(modes)
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .sort()
      .map((f) => `brand.${f.replace(/^brand\.|\.tokens\.json$/g, '')}=${path.join(modes, f)}`);
  } catch {
    brandFiles = [];
  }
  return [
    path.join(root, 'tokens', 'primitives.tokens.json'),
    path.join(root, 'tokens', 'semantic.tokens.json'),
    path.join(modes, 'semantic.light.tokens.json'),
    path.join(modes, 'semantic.dark.tokens.json'),
    ...brandFiles,
  ];
};

/** Icon assets are SOURCE (like tokens): <iconsDir>/<name>.svg, inlined by
 *  the generator on the code side and rendered as vectors in Figma. */
function loadIconAssets(iconsDir: string): Map<string, string> {
  try {
    return new Map(
      readdirSync(iconsDir)
        .filter((f) => f.endsWith('.svg'))
        .map((f) => [
          f.replace(/\.svg$/, ''),
          readFileSync(path.join(iconsDir, f), 'utf8').trim(),
        ]),
    );
  } catch {
    return new Map();
  }
}

export async function generateComponents(
  options: GenerateComponentsOptions = {},
): Promise<{
  generated: string[];
  refused: RefusedContract[];
  outDir: string;
  tokensCss: TokensCssSummary;
  /** REQUIRED-FACTS warnings — one line per load-bearing fact a contract does
   *  not carry for its archetype. `generate` WARNS and never refuses: code
   *  renders through CSS inheritance and survives an absence the canvas
   *  cannot, so the same fact that stops `figma bundle --strict` is only named
   *  here. Both shells print them (describeRequiredFacts). */
  requiredFacts: string[];
}> {
  const root = process.cwd();
  const contractsDir = options.contractsDir ?? path.join(root, 'contracts');
  const outDir = options.outDir ?? path.join(root, 'src', 'components');
  const stories = options.stories ?? true;
  // ROUTED, not merely read: the union of every slot is the inventory (the
  // same set the flat read produced), and the slots themselves become the
  // tokens.css blocks. A same-slot value collision refuses by name here
  // exactly as it does for every other target.
  const routing = buildTokenRouting(options.tokenFiles ?? defaultTokenFiles(root));
  const tokenTrees = tokenTreesFromRouting(routing);
  const tokenInventory = tokenInventoryFromJson([...routing.bySlot.values()]);
  const iconAssets = loadIconAssets(options.iconsDir ?? path.join(root, 'assets', 'icons'));
  const contractFiles =
    options.contractFiles ??
    readdirSync(contractsDir)
      .filter((f) => f.endsWith('.contract.json'))
      .map((f) => path.join(contractsDir, f));

  // PER-CONTRACT REFUSALS: parse, identity, graph, validation, CSS, emission
  // each refuse BY NAME and propagate to dependents; the survivors are
  // generated. Only a batch-level failure (tokens) throws.
  const { parsed, refused: parseRefusals } = parseContractFiles(contractFiles);
  const ledger = new RefusalLedger(parsed, parseRefusals);
  ledger.propagate();
  const byId = new Map(parsed.map((e) => [e.contract.id, e.contract]));
  let ordered = orderActive(ledger);

  // Complete contract validation before emission; a refused contract (and
  // everything composing it) leaves no file.
  for (const contract of ordered) {
    const errors: string[] = [];
    validateContract(contract, byId, errors, iconAssets);
    if (errors.length > 0) ledger.refuse(contract.id, errors);
  }
  ledger.propagate();
  ordered = ordered.filter((c) => !ledger.has(c.id));

  const cssById = new Map<string, string>();
  for (const contract of ordered) {
    const errors: string[] = [];
    const css = generateCss(contract, tokenInventory, errors);
    if (errors.length > 0) ledger.refuse(contract.id, errors);
    else cssById.set(contract.id, css);
  }
  ledger.propagate();
  ordered = ordered.filter((c) => !ledger.has(c.id));

  // tokens.css — the sheet the CSS Modules above reference. Built from the
  // routed slots; a $type disagreement between slots refuses by name.
  let sheet: TokensCssReport;
  try {
    sheet = emitTokensCss(tokensCssLayers(tokenTrees), {
      sources: routing.decisions.map((d) => `${path.basename(d.file)} [${d.slot}]`),
      regenerate: options.regenerateHint ?? 'npm run generate',
    });
  } catch (err) {
    const [head, ...rest] = String(err instanceof Error ? err.message : err).split('\n');
    throw new ContractViolationError(`✘ tokens.css ${head}`, rest.map((l) => l.replace(/^\s*-\s*/, '')));
  }
  // THE GATE: every var(--x) the generated CSS references is defined in
  // :root. The inventory check above makes this hold by construction for
  // token refs; a composite the sheet had to skip is the case it catches —
  // refused per referencing contract.
  for (const contract of ordered) {
    const referenced = [...referencedCssVars(cssById.get(contract.id)!)];
    const undefinedVars = undefinedCssVars(referenced, sheet.defined);
    if (undefinedVars.length > 0) {
      ledger.refuse(
        contract.id,
        undefinedVars.map(
          (n) => `${contract.id}: custom property ${n} the generated CSS references is not defined in tokens.css (it would render as nothing, silently)`,
        ),
      );
    }
  }
  ledger.propagate();
  ordered = ordered.filter((c) => !ledger.has(c.id));

  const planById = new Map<string, PlannedFile[]>();
  for (const contract of ordered) {
    const css = cssById.get(contract.id)!;
    const dir = path.join(outDir, contract.name);
    try {
      const plan: PlannedFile[] = [];
      plan.push({
        path: path.join(dir, `${contract.name}.module.css`),
        contents: await formatCss(css),
      });
      plan.push({
        path: path.join(dir, `${contract.name}.tsx`),
        contents: await formatTsx(generateTsx(contract, byId, iconAssets, css)),
      });
      if (stories) {
        plan.push({
          path: path.join(dir, `${contract.name}.stories.tsx`),
          contents: await formatTsx(generateStories(contract, byId)),
        });
      }
      plan.push({
        path: path.join(dir, 'index.ts'),
        contents: `export { ${contract.name} } from './${contract.name}';\nexport type { ${contract.name}Props } from './${contract.name}';\n`,
      });
      planById.set(contract.id, plan);
    } catch (err) {
      ledger.refuse(contract.id, [`${contract.id}: emit failed — ${String(err instanceof Error ? err.message : err)}`]);
    }
  }
  ledger.propagate();
  ordered = ordered.filter((c) => !ledger.has(c.id));

  const referencedBy = new Map<string, string[]>();
  for (const contract of ordered) {
    for (const name of referencedCssVars(cssById.get(contract.id)!)) {
      referencedBy.set(name, [...(referencedBy.get(name) ?? []), contract.name]);
    }
  }
  const tokensCss: TokensCssSummary = {
    path: path.join(outDir, 'tokens.css'),
    defined: sheet.defined.length,
    referenced: referencedBy.size,
    unreferenced: sheet.defined.filter((n) => !referencedBy.has(n)).length,
    modes: sheet.modes,
    danglingAliases: sheet.danglingAliases,
    skippedComposite: sheet.skippedComposite,
  };

  const generated = ordered.map((contract) => contract.name).sort();
  const plan: PlannedFile[] = ordered.flatMap((c) => planById.get(c.id)!);
  if (ordered.length > 0) {
    // The root barrel imports the sheet so `import { Button } from '<out>'`
    // paints; every story imports it too (core/emit-react.ts generateStories),
    // so a Storybook glob over the tree paints without a preview.ts line.
    plan.push({
      path: path.join(outDir, 'index.ts'),
      contents: `import './tokens.css';\n` + generated.map((n) => `export * from './${n}';`).join('\n') + '\n',
    });
    plan.push({ path: tokensCss.path, contents: sheet.css });
  }

  // The destination remains untouched until every surviving contract has
  // been parsed, validated, sorted, emitted, and formatted successfully; a
  // refused contract has NO file in the plan.
  for (const file of plan) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents);
  }

  // REQUIRED FACTS PER ARCHETYPE — named on the code surface too, in the
  // generate voice: the fact is missing, the code still renders, and the
  // CANVAS is where it will show. One place, both shells.
  const requiredFacts: string[] = [];
  for (const contract of ordered) {
    const result = checkRequiredFacts(contract, { voice: 'generate' });
    requiredFacts.push(...result.missing.map((m) => m.line));
  }

  return { generated, refused: ledger.refused, outDir, tokensCss, requiredFacts };
}

/** The required-facts warnings, one header + one `  - <line>` each — the same
 *  wording in `npm run generate` and every CLI target. */
export function describeRequiredFacts(requiredFacts: string[]): string[] {
  if (requiredFacts.length === 0) return [];
  return [
    `⚠ ${requiredFacts.length} required fact(s) missing for the contract's archetype — generated anyway (code carries them through CSS defaults; the canvas cannot). ` +
      `\`ds-contracts figma bundle --strict\` refuses these instead:`,
    ...requiredFacts.map((line) => `  - ${line}`),
  ];
}

/** The refused list, one header + one `  - id: violation` line each — the
 *  same wording in `npm run generate` and every CLI target. */
export function describeRefused(refused: RefusedContract[]): string[] {
  if (refused.length === 0) return [];
  return [
    `✘ Refused ${refused.length} contract(s) — each by name; every other contract was generated:`,
    ...refused.flatMap((r) => r.violations.map((v) => `  - ${v.startsWith(`${r.id}:`) ? v : `${r.id}: ${v}`}`)),
  ];
}

/** Shared by both shells (this script and the ds-contracts CLI): run, print
 *  the historical success wording plus the refused list, exit non-zero when
 *  anything was refused. */
export async function runGenerateComponents(options: GenerateComponentsOptions = {}): Promise<void> {
  try {
    const { generated, refused, tokensCss, requiredFacts } = await generateComponents(options);
    console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.sort().join(', ')}`);
    if (generated.length > 0) for (const line of describeTokensCss(tokensCss)) console.log(line);
    for (const line of describeRequiredFacts(requiredFacts)) console.log(line);
    if (refused.length > 0) {
      for (const line of describeRefused(refused)) console.error(line);
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof ContractViolationError) {
      console.error(err.header);
      for (const e of err.violations) console.error(`  - ${e}`);
      process.exit(1);
    }
    throw err;
  }
}

/** Minimal flag parsing for the script shell — no CLI framework, repo culture. */
export function parseGenerateArgs(argv: string[]): GenerateComponentsOptions {
  const options: GenerateComponentsOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      return v;
    };
    if (arg === '--contracts') options.contractsDir = next();
    else if (arg === '--tokens') options.tokenFiles = next().split(',').filter(Boolean);
    else if (arg === '--icons') options.iconsDir = next();
    else if (arg === '--out') options.outDir = next();
    else if (arg === '--no-stories') options.stories = false;
    else if (arg === '--stories') options.stories = true;
    else throw new Error(`Unknown argument "${arg}" — flags: --contracts <dir> --tokens <f,f,…> --icons <dir> --out <dir> [--no-stories]`);
  }
  return options;
}

// Direct-run shell: `tsx scripts/generate-components.ts [flags]` (npm run
// generate). Filename-matched (not import.meta.url-compared) so bundling this
// module into the ds-contracts CLI can never trigger it at import time.
if (process.argv[1] && /generate-components\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  await runGenerateComponents(parseGenerateArgs(process.argv.slice(2)));
}
