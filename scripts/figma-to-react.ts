/**
 * Headless Figma → React: `npm run figma:to-react -- --dump <dump.json> --out <dir>`.
 *
 * Runs the playground's own import engine (playground/src/engine/
 * headless-figma-to-react.ts) under Vite's SSR module loader — the engine's
 * data modules use import.meta.glob and ?raw imports, so Vite, not plain
 * Node, is what can load them unchanged — then packages the request with the
 * app server's buildReactLibrary. Same engine functions, same order, same
 * packager as the local app's "Prepare React library", on a fresh session.
 *
 * Writes <out>/request.json (the library request the app would POST),
 * <out>/<name>.tgz and <out>/result.json. With --expect-request <input.json>
 * it refuses unless the request is canonically equal to a recorded one.
 */
import { createServer } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactLibrary, parseLibraryRequest } from '../playground/server/react-library.js';
import { canonicalJson } from '../core/contract-provenance.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** A fresh tab: the playground's session stores persist to sessionStorage. */
function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

export async function figmaToReact(dumpPath: string, outDir: string, expectRequest?: string) {
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  installSessionStorage();
  const server = await createServer({
    configFile: false,
    root: path.join(repoRoot, 'playground'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repoRoot] } },
    resolve: {
      alias: {
        '@ds-contracts/core': path.join(repoRoot, 'packages', 'core', 'src', 'index.ts'),
        '@ds-contracts/schema': path.join(repoRoot, 'packages', 'schema', 'src', 'index.ts'),
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  let imported;
  try {
    const engine = await server.ssrLoadModule('/src/engine/headless-figma-to-react.ts');
    imported = engine.figmaDumpToLibraryRequest(dump);
  } finally {
    await server.close();
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'request.json'), JSON.stringify(imported.request, null, 2) + '\n');
  if (expectRequest) {
    const recorded = JSON.parse(readFileSync(expectRequest, 'utf8'));
    if (canonicalJson(recorded) !== canonicalJson(imported.request)) {
      const differ = (['rootId', 'contracts', 'tokens', 'icons'] as const)
        .filter(k => canonicalJson(recorded[k]) !== canonicalJson((imported.request as Record<string, unknown>)[k]));
      throw Error(`figma-to-react-request-differs: ${differ.join(', ') || 'shape'} (recorded ${expectRequest})`);
    }
  }
  const input = parseLibraryRequest(imported.request);
  const library = await buildReactLibrary(repoRoot, input, path.join(outDir, 'work'));
  const generatedDir = path.join(path.dirname(library.tarball), 'generated');
  if (!existsSync(generatedDir)) throw Error('figma-to-react-generated-missing: ' + generatedDir);
  const tarball = path.join(outDir, path.basename(library.tarball));
  copyFileSync(library.tarball, tarball);
  const result = { setName: imported.setName, rootId: imported.request.rootId, proposed: imported.proposed,
    skipped: imported.skipped, tarball: path.basename(tarball), tarballSha256: library.tarballSha256,
    requestSha256: createHash('sha256').update(canonicalJson(imported.request)).digest('hex'), notes: imported.notes };
  writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return { ...result, generatedDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dump = flag('--dump'), out = flag('--out');
  if (!dump || !out) {
    console.error('usage: npm run figma:to-react -- --dump <dump.json> --out <dir> [--expect-request <input.json>]');
    process.exit(2);
  }
  figmaToReact(dump, out, flag('--expect-request')).then(r => {
    console.log(`✔ figma:to-react ${r.setName} → ${r.tarball} (sha256 ${r.tarballSha256.slice(0, 12)})`);
  }).catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
