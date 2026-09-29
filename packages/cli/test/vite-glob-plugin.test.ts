/**
 * The build-time stand-in for Vite's import.meta.glob and ?raw
 * (packages/cli/vite-glob-plugin.mjs) must give `ds-contracts figma-to-react`
 * the SAME engine data the in-repo `npm run figma:to-react` gets from Vite:
 * data.ts loaded both ways, and the icons (order and bytes), the contract
 * order (contractsById is insertion-ordered, and name linking iterates it) and
 * the token trees and stylesheets compared. Unsupported glob forms refuse the
 * build by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createServer } from 'vite';
import { globFiles, transformGlobs, viteGlobPlugin } from '../vite-glob-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const dataTs = path.join(repoRoot, 'playground', 'src', 'engine', 'data.ts');
const alias = {
  '@ds-contracts/core': path.join(repoRoot, 'packages', 'core', 'src', 'index.ts'),
  '@ds-contracts/schema': path.join(repoRoot, 'packages', 'schema', 'src', 'index.ts'),
};

type Data = typeof import('../../../playground/src/engine/data.js');

async function viaPlugin(t: test.TestContext): Promise<Data> {
  const dir = mkdtempSync(path.join(tmpdir(), 'vite-glob-plugin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = await build({ entryPoints: [dataTs], bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false,
    alias, logLevel: 'silent', plugins: [viteGlobPlugin()],
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
  const file = path.join(dir, 'data.mjs');
  writeFileSync(file, out.outputFiles[0].contents);
  return import(pathToFileURL(file).href);
}

async function viaVite(): Promise<Data> {
  const server = await createServer({
    configFile: false, root: path.join(repoRoot, 'playground'), logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null, fs: { allow: [repoRoot] } },
    resolve: { alias }, optimizeDeps: { noDiscovery: true, include: [] },
  });
  try { return await server.ssrLoadModule('/src/engine/data.ts') as Data; }
  finally { await server.close(); }
}

test('data.ts through the plugin equals data.ts through Vite: icons, contract order, token trees', async t => {
  const [bundled, vite] = await Promise.all([viaPlugin(t), viaVite()]);
  assert.ok(vite.icons.size > 0 && vite.contractsById.size > 0, 'Vite loaded the real data');
  assert.deepEqual([...bundled.icons], [...vite.icons], 'icons: same names, same order, same SVG text');
  assert.deepEqual([...bundled.contractsById.keys()], [...vite.contractsById.keys()], 'contractsById: same ids in the same order');
  assert.deepEqual([...bundled.contractsById.values()], [...vite.contractsById.values()]);
  assert.deepEqual([...bundled.rawContractById], [...vite.rawContractById]);
  assert.deepEqual([...bundled.contractIdByName], [...vite.contractIdByName]);
  assert.deepEqual([...bundled.contractIdByKey], [...vite.contractIdByKey]);
  assert.deepEqual(bundled.tokenTree, vite.tokenTree);
  assert.deepEqual(bundled.tokenStylesheets, vite.tokenStylesheets);
  assert.deepEqual([...bundled.tokenInventory], [...vite.tokenInventory]);
});

test('glob keys are the literal relative paths, sorted the way Vite sorts absolute paths', () => {
  const files = globFiles(dataTs, '../../../assets/icons/*.svg');
  assert.ok(files.length > 0);
  assert.ok(files.every(f => f.key.startsWith('../../../assets/icons/') && f.key.endsWith('.svg')));
  assert.deepEqual(files.map(f => f.absolute), files.map(f => f.absolute).slice().sort());
});

test('every other import.meta.glob form, and import.meta.env in playground code, refuses the build by name', () => {
  const file = path.join(repoRoot, 'playground', 'src', 'engine', 'x.ts');
  const refuses = (source: string, pattern: RegExp) => assert.throws(() => transformGlobs(file, source), pattern);
  refuses("const m = import.meta.glob('../../../contracts/*.contract.json');", /import-meta-glob-unsupported: .*x\.ts:1: expected exactly/);
  refuses("const m = import.meta.glob('../../../contracts/*.contract.json', { import: 'default' });", /options \{import\} are not supported/);
  refuses("const m = import.meta.glob('../../../contracts/*.contract.json', { eager: false, import: 'default' });", /eager must be true/);
  refuses("const m = import.meta.glob('../../../contracts/*.contract.json', { eager: true, import: 'named' });", /import must be "default"/);
  refuses("const m = import.meta.glob('../../../contracts/*.contract.json', { eager: true, import: 'default', query: '?url' });", /query must be "\?raw"/);
  refuses("const m = import.meta.glob('../../../**/*.json', { eager: true, import: 'default' });", /must be <dir>\/<prefix>\*<suffix>/);
  refuses("const m = import.meta.glob(['../a/*.json'], { eager: true, import: 'default' });", /one string literal/);
  refuses("const m = import.meta.glob('/contracts/*.json', { eager: true, import: 'default' });", /must be relative/);
  refuses('const g = import.meta.glob;', /only supported as a direct call/);
  refuses('const u = import.meta.env.VITE_URL;', /import-meta-vite-unsupported: .*import\.meta\.env/);
  assert.equal(transformGlobs(path.join(repoRoot, 'scripts', 'x.ts'), 'const u = import.meta.env;'), null, 'outside playground code env is left alone');
  assert.equal(transformGlobs(file, 'const x = 1; // import.meta.glob in a comment'), null);
});
