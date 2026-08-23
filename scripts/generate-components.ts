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
import { ContractSchema, sortByDependencies, type Contract } from './contract-schema.js';
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
): Promise<{ generated: string[]; outDir: string; tokensCss: TokensCssSummary }> {
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
  const errors: string[] = [];

  const parsedContracts: Contract[] = [];
  for (const filePath of contractFiles) {
    const file = path.basename(filePath);
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const parsed = ContractSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(
        `${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
      continue;
    }
    parsedContracts.push(parsed.data);
  }

  // Identity gates: contract ids and names must be unique across the set —
  // a duplicate id silently forks identity in the dependency map; a
  // duplicate name silently clobbers the other contract's generated output.
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();
  for (const c of parsedContracts) {
    if (seenIds.has(c.id)) {
      errors.push(`${c.id}: duplicate contract id (also declared by "${seenIds.get(c.id)}")`);
    }
    seenIds.set(c.id, c.name);
    if (seenNames.has(c.name)) {
      errors.push(`${c.id}: duplicate contract name "${c.name}" (also used by ${seenNames.get(c.name)}) — would overwrite src/components/${c.name}/`);
    }
    seenNames.set(c.name, c.id);
  }

  // Composition graph gate: cycles and unknown refs are refused.
  let ordered: Contract[] = parsedContracts;
  if (errors.length === 0) {
    try {
      ordered = sortByDependencies(parsedContracts);
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err));
    }
  }
  const byId = new Map(parsedContracts.map((c) => [c.id, c]));

  // Fail fast on parse/identity/graph errors: a refused contract leaves
  // dangling refs in byId, and generating dependents against a broken map
  // crashes with an unnamed TypeError INSTEAD of the named refusal — the
  // exact opposite of C2. Name the violations and stop.
  if (errors.length > 0) {
    throw new ContractViolationError(`✘ Refused — ${errors.length} contract violation(s):`, errors);
  }

  // Complete contract validation before emission. Emitters and formatters may
  // fail, and none of those failures may leave a partially updated outDir.
  for (const contract of ordered) {
    validateContract(contract, byId, errors, iconAssets);
  }

  if (errors.length > 0) {
    throw new ContractViolationError('✖ Contract validation failed:\n', errors);
  }

  const cssById = new Map<string, string>();
  for (const contract of ordered) {
    cssById.set(contract.id, generateCss(contract, tokenInventory, errors));
  }

  if (errors.length > 0) {
    throw new ContractViolationError('✖ Contract validation failed:\n', errors);
  }

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
  // token refs; a composite the sheet had to skip is the case it catches.
  const referencedBy = new Map<string, string[]>();
  for (const contract of ordered) {
    for (const name of referencedCssVars(cssById.get(contract.id)!)) {
      referencedBy.set(name, [...(referencedBy.get(name) ?? []), contract.name]);
    }
  }
  const undefinedVars = undefinedCssVars(referencedBy.keys(), sheet.defined);
  if (undefinedVars.length > 0) {
    throw new ContractViolationError(
      `✘ Refused — ${undefinedVars.length} custom propert(ies) the generated CSS references are not defined in tokens.css (they would render as nothing, silently):`,
      undefinedVars.map((n) => `${n} — referenced by ${referencedBy.get(n)!.join(', ')}`),
    );
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

  const plan: PlannedFile[] = [];
  const generated = ordered.map((contract) => contract.name).sort();
  for (const contract of ordered) {
    const css = cssById.get(contract.id)!;
    const dir = path.join(outDir, contract.name);
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
  }

  // The root barrel imports the sheet so `import { Button } from '<out>'`
  // paints; every story imports it too (core/emit-react.ts generateStories),
  // so a Storybook glob over the tree paints without a preview.ts line.
  plan.push({
    path: path.join(outDir, 'index.ts'),
    contents: `import './tokens.css';\n` + generated.map((n) => `export * from './${n}';`).join('\n') + '\n',
  });
  plan.push({ path: tokensCss.path, contents: sheet.css });

  // The destination remains untouched until every contract has been parsed,
  // validated, sorted, emitted, and formatted successfully.
  for (const file of plan) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents);
  }

  return { generated, outDir, tokensCss };
}

/** Shared by both shells (this script and the ds-contracts CLI): run, print
 *  the historical success/refusal wording, exit non-zero on violations. */
export async function runGenerateComponents(options: GenerateComponentsOptions = {}): Promise<void> {
  try {
    const { generated, tokensCss } = await generateComponents(options);
    console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.sort().join(', ')}`);
    for (const line of describeTokensCss(tokensCss)) console.log(line);
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
