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
 *
 * Output is byte-guarded by evals/golden.json (the golden-generated-output
 * eval): refactors of the core must not change a single emitted byte.
 *
 * Generated files are never edited by hand. To change a component, change
 * its contract and re-run `npm run generate`.
 *
 * PARAMETERIZED (Phase 1, @ds-contracts/cli): every path is now an option —
 *   --contracts <dir>   contract documents        (default: <cwd>/contracts)
 *   --tokens <files>    comma-separated DTCG files (default: the repo's 4-file layout)
 *   --icons <dir>       SVG icon assets           (default: <cwd>/assets/icons)
 *   --out <dir>         output root               (default: <cwd>/src/components)
 * Defaults are the repo paths, so `npm run generate` is byte-identical to
 * the pre-parameterization script. The `ds-contracts generate` verb calls
 * the same exported generateComponents() — one code path, two shells.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractSchema, sortByDependencies, type Contract } from './contract-schema.js';
import { generateCss, generateStories, generateTsx, validateContract } from '../core/emit-react.js';
import { formatCss, formatTsx } from '../core/format.js';
import { tokenInventoryFromJson } from '../core/tokens.js';

export interface GenerateComponentsOptions {
  /** Directory of *.contract.json documents. */
  contractsDir?: string;
  /** DTCG token files — the union is the token inventory. */
  tokenFiles?: string[];
  /** Directory of <name>.svg icon assets. */
  iconsDir?: string;
  /** Output root — one directory per component is written under it. */
  outDir?: string;
  /** Emit <Name>.stories.tsx per component (default true — the repo path). */
  stories?: boolean;
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

const defaultTokenFiles = (root: string) => [
  path.join(root, 'tokens', 'primitives.tokens.json'),
  path.join(root, 'tokens', 'semantic.tokens.json'),
  path.join(root, 'tokens', 'modes', 'semantic.light.tokens.json'),
  path.join(root, 'tokens', 'modes', 'semantic.dark.tokens.json'),
];

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

function loadTokenInventory(tokenFiles: string[]): Set<string> {
  return tokenInventoryFromJson(tokenFiles.map((file) => JSON.parse(readFileSync(file, 'utf8'))));
}

export async function generateComponents(
  options: GenerateComponentsOptions = {},
): Promise<{ generated: string[]; outDir: string }> {
  const root = process.cwd();
  const contractsDir = options.contractsDir ?? path.join(root, 'contracts');
  const outDir = options.outDir ?? path.join(root, 'src', 'components');
  const stories = options.stories ?? true;
  const tokenInventory = loadTokenInventory(options.tokenFiles ?? defaultTokenFiles(root));
  const iconAssets = loadIconAssets(options.iconsDir ?? path.join(root, 'assets', 'icons'));
  const contractFiles = readdirSync(contractsDir).filter((f) => f.endsWith('.contract.json'));
  const errors: string[] = [];
  const generated: string[] = [];

  const parsedContracts: Contract[] = [];
  for (const file of contractFiles) {
    const raw = JSON.parse(readFileSync(path.join(contractsDir, file), 'utf8'));
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

  for (const contract of ordered) {
    validateContract(contract, byId, errors, iconAssets);
    if (errors.length > 0 && errors.some((e) => e.startsWith(contract.id))) continue;

    const css = generateCss(contract, tokenInventory, errors);
    if (errors.some((e) => e.startsWith(contract.id))) continue;

    const dir = path.join(outDir, contract.name);
    mkdirSync(dir, { recursive: true });

    writeFileSync(path.join(dir, `${contract.name}.module.css`), await formatCss(css));
    writeFileSync(
      path.join(dir, `${contract.name}.tsx`),
      await formatTsx(generateTsx(contract, byId, iconAssets)),
    );
    if (stories) {
      writeFileSync(
        path.join(dir, `${contract.name}.stories.tsx`),
        await formatTsx(generateStories(contract, byId)),
      );
    }
    writeFileSync(
      path.join(dir, 'index.ts'),
      `export { ${contract.name} } from './${contract.name}';\nexport type { ${contract.name}Props } from './${contract.name}';\n`,
    );
    generated.push(contract.name);
  }

  if (errors.length > 0) {
    throw new ContractViolationError('✖ Contract validation failed:\n', errors);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'index.ts'),
    generated
      .sort()
      .map((n) => `export * from './${n}';`)
      .join('\n') + '\n',
  );

  return { generated, outDir };
}

/** Shared by both shells (this script and the ds-contracts CLI): run, print
 *  the historical success/refusal wording, exit non-zero on violations. */
export async function runGenerateComponents(options: GenerateComponentsOptions = {}): Promise<void> {
  try {
    const { generated } = await generateComponents(options);
    console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.sort().join(', ')}`);
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

// Direct-run shell: `tsx scripts/generate-components.ts [flags]` (npm run generate).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGenerateComponents(parseGenerateArgs(process.argv.slice(2)));
}
