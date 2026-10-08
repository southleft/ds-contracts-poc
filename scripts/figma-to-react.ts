/**
 * Headless Figma → React in this repository: `npm run figma:to-react -- --dump
 * <dump.json> --out <dir>`. The contributor path; users run the installed
 * `npx @ds-contracts/cli figma-to-react`, which shares everything but the
 * engine loader (scripts/figma-to-react-lib.ts).
 *
 * Here the playground's own import engine (playground/src/engine/
 * headless-figma-to-react.ts) runs under Vite's SSR module loader: its data
 * modules use import.meta.glob and ?raw imports, and Vite loads them unchanged.
 * Same engine functions, same order, same packager as the local app's
 * "Prepare React library", on a fresh session.
 *
 * Writes <out>/request.json (the library request the app would POST),
 * <out>/<name>.tgz and <out>/result.json. With --expect-request <input.json>
 * it refuses unless the request is canonically equal to a recorded one.
 *
 * The command then CHECKS what it generated (checkGenerated →
 * design:consumer:check, receipt and images in <out>/check) and prints one
 * line per variant: PASS, FAIL with the named reasons, or UNVERIFIED when
 * something could not be measured (no FIGMA_TOKEN for Figma's images). It
 * exits 1 when any variant fails, unless --allow-failures. Without a Chromium
 * it says NOT CHECKED. A green check is printed only when every variant
 * passed. The cold-start test (2026-09-28) found the old command printing ✔
 * for a Radio with no circle and a Dialog without its heading. The
 * programmatic figmaToReact() (the benchmark replay) does not run the check.
 * --fonts <manifest.json> authenticates the design's font files before any
 * fetch or write, then provides them to the consumer check.
 */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from './figma-to-react-lib.js';
import type { EngineLoader, HeadlessEngine } from './figma-to-react-lib.js';
import type { Toolchain } from './package-react-library.js';

export { checkGenerated, dumpFromFigmaUrl, reportCheck, type CheckOutcome } from './figma-to-react-lib.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The engine under Vite's SSR loader, on a fresh server (fresh module state) per run. */
export const viteEngine: EngineLoader = async () => {
  const server = await createServer({
    configFile: false,
    root: path.join(repoRoot, 'playground'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null, fs: { allow: [repoRoot] } },
    resolve: {
      alias: {
        '@ds-contracts/core': path.join(repoRoot, 'packages', 'core', 'src', 'index.ts'),
        '@ds-contracts/schema': path.join(repoRoot, 'packages', 'schema', 'src', 'index.ts'),
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const engine = await server.ssrLoadModule('/src/engine/headless-figma-to-react.ts') as HeadlessEngine;
    return { engine, close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
};

export function figmaToReact(dumpPath: string, outDirArg: string, expectRequest?: string, source: 'json' | 'figma' = 'json',
  options: { packageName?: string; toolchain?: Toolchain } = {}) {
  return lib.figmaToReact(viteEngine, dumpPath, outDirArg, expectRequest, source, options);
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// Filename-matched, as scripts/generate-components.ts does, so a bundle can never trigger it.
if (process.argv[1] && /(^|[\\/])figma-to-react\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  const dump = flag('--dump'), url = flag('--url'), out = flag('--out'), fonts = flag('--fonts'), nativeStrokes = flag('--native-strokes');
  if ((!dump && !url) || (dump && url) || !out || (process.argv.includes('--fonts') && (!fonts || fonts.startsWith('--'))) || (process.argv.includes('--native-strokes') && (!nativeStrokes || nativeStrokes.startsWith('--')))) {
    console.error('usage: npm run figma:to-react -- (--dump <dump.json> | --url <figma component-set URL>) --out <dir> [--name <npm package name>] [--expect-request <input.json>] [--fonts <manifest.json>] [--native-strokes <receipt.json>] [--allow-failures]\n'
      + '  --url reads FIGMA_TOKEN from the environment (never from the command line).\n'
      + '  --fonts gives the check your design\'s font files (a sha256-pinned manifest; see docs/PREVIEW.md).\n'
      + '  After packaging, the generated package is checked against the design (design:consumer:check) and each\n'
      + '  variant is reported pass / FAIL / unverified; any FAIL exits 1 unless --allow-failures is given.\n'
      + '  Outside this repository: npx @ds-contracts/cli figma-to-react (same flags but --expect-request).');
    process.exit(2);
  }
  lib.runFigmaToReact({ dump, url, out: out!, name: flag('--name'), expectRequest: flag('--expect-request'), fonts, nativeStrokes, allowFailures: process.argv.includes('--allow-failures') },
    { loadEngine: viteEngine, label: 'figma:to-react' })
    .then(code => process.exit(code))
    .catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
