/** Shared React library packaging. This module has no local HTTP service or
 * host occurrence authentication dependency; the CLI uses the same builder. */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateComponents } from '../../scripts/generate-components.js';
import { packageReactLibrary, type Toolchain } from '../../scripts/package-react-library.js';
import { parseLibraryRequest } from './react-library-input.js';

/** `repoRoot` only names the default parent for prepared downloads; the
 *  packaging toolchain resolves from where the packager is installed. */
export async function buildReactLibrary(repoRoot: string, input: ReturnType<typeof parseLibraryRequest>,
  parent = path.join(repoRoot, 'private', 'react-library-downloads'), options: { packageName?: string; toolchain?: Toolchain } = {}) {
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(path.join(parent, 'library-'));
  const inputs = path.join(work, 'inputs'), generated = path.join(work, 'generated'), iconsDir = path.join(inputs, 'icons');
  mkdirSync(iconsDir, { recursive: true });
  const contractFiles = input.contracts.map((contract, index) => {
    const file = path.join(inputs, `${index}.contract.json`); writeFileSync(file, JSON.stringify(contract, null, 2), { flag: 'wx' }); return file;
  });
  const tokenFiles: string[] = [];
  const token = (slot: string, tree: Record<string, unknown>) => {
    const file = path.join(inputs, `${slot}.tokens.json`); writeFileSync(file, JSON.stringify(tree), { flag: 'wx' }); tokenFiles.push(`${slot}=${file}`);
  };
  for (const slot of ['primitives', 'semantic', 'light', 'dark'] as const) token(slot, input.tokens[slot]);
  for (const [brand, tree] of Object.entries(input.tokens.brands)) token(`brand.${brand}`, tree);
  for (const [name, svg] of input.icons) writeFileSync(path.join(iconsDir, `${name}.svg`), svg, { flag: 'wx' });
  // A package ships only the tokens its own components reach (tokensScope):
  // the request's token tree also holds the repository's demo tokens.
  const result = await generateComponents({ contractFiles, tokenFiles, iconsDir, outDir: generated, stories: false, tokensScope: 'reachable', regenerateHint: 'Export this family again from the local Contract Playground.' });
  if (result.refused.length || result.generated.length !== input.contracts.length) throw Error('react-library-generation-refused: ' + result.refused.flatMap(r => r.violations).join('; '));
  if (result.tokensCss.danglingAliases.length) throw Error('react-library-token-alias-missing: ' + result.tokensCss.danglingAliases.join(', '));
  const library = await packageReactLibrary(generated, input.root.name, work, options);
  writeFileSync(path.join(work, 'receipt.json'), JSON.stringify({ rootId: input.root.id, contracts: input.contracts.map(c => ({ id: c.id, name: c.name })), generated: result.generated, requiredFacts: result.requiredFacts, tarballSha256: library.tarballSha256 }, null, 2), { flag: 'wx' });
  return { ...library, bytes: readFileSync(library.tarball), filename: path.basename(library.tarball) };
}
