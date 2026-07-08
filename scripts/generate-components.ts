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
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, sortByDependencies, type Contract } from './contract-schema.js';
import { generateCss, generateStories, generateTsx, validateContract } from '../core/emit-react.js';
import { formatCss, formatTsx } from '../core/format.js';
import { tokenInventoryFromJson } from '../core/tokens.js';

const ROOT = process.cwd();
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const TOKENS_DIR = path.join(ROOT, 'tokens');
const OUT_DIR = path.join(ROOT, 'src', 'components');

/** Icon assets are SOURCE (like tokens): assets/icons/<name>.svg, inlined by
 *  the generator on the code side and rendered as vectors in Figma. */
function loadIconAssets(): Map<string, string> {
  try {
    return new Map(
      readdirSync(path.join(ROOT, 'assets', 'icons'))
        .filter((f) => f.endsWith('.svg'))
        .map((f) => [
          f.replace(/\.svg$/, ''),
          readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim(),
        ]),
    );
  } catch {
    return new Map();
  }
}

function loadTokenInventory(): Set<string> {
  const files = [
    path.join(TOKENS_DIR, 'primitives.tokens.json'),
    path.join(TOKENS_DIR, 'semantic.tokens.json'),
    path.join(TOKENS_DIR, 'modes', 'semantic.light.tokens.json'),
    path.join(TOKENS_DIR, 'modes', 'semantic.dark.tokens.json'),
  ];
  return tokenInventoryFromJson(files.map((file) => JSON.parse(readFileSync(file, 'utf8'))));
}

async function main() {
  const tokenInventory = loadTokenInventory();
  const iconAssets = loadIconAssets();
  const contractFiles = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.contract.json'));
  const errors: string[] = [];
  const generated: string[] = [];

  const parsedContracts: Contract[] = [];
  for (const file of contractFiles) {
    const raw = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, file), 'utf8'));
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
    console.error(`✘ Refused — ${errors.length} contract violation(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  for (const contract of ordered) {
    validateContract(contract, byId, errors, iconAssets);
    if (errors.length > 0 && errors.some((e) => e.startsWith(contract.id))) continue;

    const css = generateCss(contract, tokenInventory, errors);
    if (errors.some((e) => e.startsWith(contract.id))) continue;

    const dir = path.join(OUT_DIR, contract.name);
    mkdirSync(dir, { recursive: true });

    writeFileSync(path.join(dir, `${contract.name}.module.css`), await formatCss(css));
    writeFileSync(
      path.join(dir, `${contract.name}.tsx`),
      await formatTsx(generateTsx(contract, byId, iconAssets)),
    );
    writeFileSync(
      path.join(dir, `${contract.name}.stories.tsx`),
      await formatTsx(generateStories(contract, byId)),
    );
    writeFileSync(
      path.join(dir, 'index.ts'),
      `export { ${contract.name} } from './${contract.name}';\nexport type { ${contract.name}Props } from './${contract.name}';\n`,
    );
    generated.push(contract.name);
  }

  if (errors.length > 0) {
    console.error('✖ Contract validation failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, 'index.ts'),
    generated
      .sort()
      .map((n) => `export * from './${n}';`)
      .join('\n') + '\n',
  );

  console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.sort().join(', ')}`);
}

await main();
