/**
 * `ds-contracts figma-to-react` — a Figma component set → an installable React
 * package, checked against the design, with no clone of the reference repo:
 *
 *   npx @ds-contracts/cli figma-to-react --url "<component set link>" --out ./out
 *   npx @ds-contracts/cli figma-to-react --dump <dump.json> --out ./out
 *
 * The same command as the reference repo's `npm run figma:to-react`
 * (scripts/figma-to-react-lib.ts runs both): the playground's own import
 * engine, the app's generator and packager, then the consumer check, which
 * prints PASS, FAIL or UNVERIFIED for each variant. Only the engine loader
 * differs. Here the engine is BUNDLED into dist/cli.js (build.mjs resolves its
 * import.meta.glob and ?raw imports at build time with vite-glob-plugin.mjs)
 * and imported lazily, only by this verb, after the fresh session is
 * installed. Packaging runs esbuild, tsc and @types/react from this CLI's own
 * pinned dependencies (resolveToolchain), never from a repository.
 *
 * Known limit, kept for parity with the in-repo command: the reference repo's
 * demo contracts and tokens are bundled with the engine and still inform name
 * linking and nearest-token matching. macOS and Linux only in this release.
 */
import { runFigmaToReact, type EngineLoader, type FigmaToReactRun } from '../../../../scripts/figma-to-react-lib.js';
import { resolveToolchain } from '../../../../scripts/package-react-library.js';
import { CliUsageError, flagString, parseFlags } from '../lib.js';

export const FIGMA_TO_REACT_USAGE =
  'figma-to-react (--url <figma component-set link> | --dump <dump.json>) --out <dir> [--name <npm package name>] [--fonts <manifest.json>] [--allow-failures]';

/** Where this release runs: the packager and the check spawn npm, esbuild and
 *  tsc the POSIX way. */
export const FIGMA_TO_REACT_PLATFORMS: readonly string[] = ['darwin', 'linux'];

/** Match the consumer's Vite 7 engine range: ^20.19.0 || >=22.12.0. */
export function nodeSupported(version: string): boolean {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
}

/** The engine bundled into dist/cli.js, loaded on first use. */
export const bundledEngine: EngineLoader = async () => ({
  engine: await import('../../../../playground/src/engine/headless-figma-to-react.js'),
});

export function parseFigmaToReactArgs(argv: string[]): FigmaToReactRun {
  const parsed = parseFlags(argv, { value: ['dump', 'url', 'out', 'name', 'fonts'], bool: ['allow-failures'] });
  if (parsed.positionals.length) throw new CliUsageError(`figma-to-react takes no positional arguments (got ${parsed.positionals.join(' ')}); usage: ${FIGMA_TO_REACT_USAGE}`);
  const dump = flagString(parsed, 'dump'), url = flagString(parsed, 'url'), out = flagString(parsed, 'out');
  if (!dump === !url) throw new CliUsageError(`figma-to-react needs exactly one of --url or --dump; usage: ${FIGMA_TO_REACT_USAGE}`);
  if (!out) throw new CliUsageError(`figma-to-react needs --out <dir>; usage: ${FIGMA_TO_REACT_USAGE}`);
  const fonts = flagString(parsed, 'fonts');
  return { ...(dump ? { dump } : {}), ...(url ? { url } : {}), out, name: flagString(parsed, 'name'), ...(fonts ? { fonts } : {}), allowFailures: parsed.flags.get('allow-failures') === true };
}

export async function figmaToReactCommand(argv: string[], env: { platform: string; node: string } = { platform: process.platform, node: process.version },
  loadEngine: EngineLoader = bundledEngine): Promise<number> {
  const run = parseFigmaToReactArgs(argv);
  if (!FIGMA_TO_REACT_PLATFORMS.includes(env.platform))
    throw new Error(`figma-to-react-platform-unsupported: this release runs on macOS and Linux (this is ${env.platform}); use WSL on Windows`);
  if (!nodeSupported(env.node))
    throw new Error(`figma-to-react-node-unsupported: needs Node 20.19+ (20.x) or 22.12+ (the check builds the package with Vite 7); this is ${env.node}`);
  return runFigmaToReact(run, { loadEngine, toolchain: resolveToolchain(import.meta.url), label: 'figma-to-react' });
}
