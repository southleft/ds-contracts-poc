/** Package generated React sources for installation in a CSS Modules consumer.
 * Shared by the application download and the design-led consumer check. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const exec = promisify(execFile);
async function run(cmd: string, args: string[], cwd: string, label = path.basename(cmd)): Promise<string> {
  try {
    const result = await exec(cmd, args, { cwd, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'FIGMA_TOKEN')), npm_config_update_notifier: 'false' } });
    return result.stdout;
  } catch (error: any) {
    throw new Error(`${label} failed: ${String(error.stdout ?? '').trim().split('\n').slice(0, 3).join(' | ')} ${String(error.stderr ?? '').trim().split('\n').slice(0, 3).join(' | ')}`);
  }
}

/** The tools packaging runs, resolved from wherever this module is installed:
 *  the repository's node_modules in a checkout, the CLI's own pinned
 *  dependencies in an installed @ds-contracts/cli (which has no repository to
 *  reach into). The same versions both ways, so the same bytes. */
export interface Toolchain {
  /** the esbuild executable (TSX → ESM, file by file) */
  esbuild: string;
  /** TypeScript's tsc entry script, run with this Node */
  tsc: string;
  /** @types/react's directory (declaration emission needs React's types) */
  reactTypes: string;
}
export function resolveToolchain(from: string = import.meta.url): Toolchain {
  const require = createRequire(from);
  const dir = (name: string) => {
    try { return path.dirname(require.resolve(`${name}/package.json`)); }
    catch { throw new Error(`react-library-toolchain-missing: ${name} cannot be resolved from ${from}`); }
  };
  return { esbuild: path.join(dir('esbuild'), 'bin', 'esbuild'), tsc: path.join(dir('typescript'), 'bin', 'tsc'), reactTypes: dir('@types/react') };
}

/** An npm package name the user chose (scoped or not); anything else refuses. */
export const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

export async function packageReactLibrary(generatedDir: string, component: string, work: string,
  options: { packageName?: string; toolchain?: Toolchain } = {}) {
  const toolchain = options.toolchain ?? resolveToolchain();
  if (options.packageName !== undefined && (!PACKAGE_NAME.test(options.packageName) || options.packageName.length > 214))
    throw new Error(`react-library-package-name-invalid: "${options.packageName}" is not an npm package name`);
  const pkgDir = path.join(work, 'library'), src = path.join(pkgDir, 'src'), dist = path.join(pkgDir, 'dist');
  mkdirSync(src, { recursive: true }); mkdirSync(dist, { recursive: true });
  // Copy generated sources except stories (a Storybook consumer is a different check).
  const copy = (from: string, to: string) => {
    for (const entry of readdirSync(from)) {
      const source = path.join(from, entry), target = path.join(to, entry);
      if (statSync(source).isDirectory()) { mkdirSync(target, { recursive: true }); copy(source, target); }
      else if (!/\.stories\.[tj]sx?$/.test(entry)) cpSync(source, target);
    }
  };
  copy(generatedDir, src);
  if (!existsSync(path.join(src, 'index.ts')) || !existsSync(path.join(src, component))) throw new Error('design:consumer:check — generated dir lacks index.ts or the component folder');
  // Transpile TS/TSX → ESM JS, file by file (no bundling), and copy CSS as files.
  const sources: string[] = [];
  const walk = (dir: string) => { for (const entry of readdirSync(dir)) { const p = path.join(dir, entry); statSync(p).isDirectory() ? walk(p) : sources.push(p); } };
  walk(src);
  const tsSources = sources.filter(f => /\.tsx?$/.test(f));
  // --tsconfig-raw={}: otherwise esbuild reads any tsconfig.json above the work
  // directory (the user's own project when --out is inside it), and its
  // jsxImportSource or verbatimModuleSyntax would change the output. This is the
  // same output as no tsconfig at all.
  await run(toolchain.esbuild, [...tsSources, '--format=esm', '--jsx=automatic', '--target=es2022', '--tsconfig-raw={}', `--outbase=${src}`, `--outdir=${dist}`], pkgDir);
  for (const f of sources.filter(f => f.endsWith('.css'))) { const rel = path.relative(src, f); mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); cpSync(f, path.join(dist, rel)); }
  // Declarations, so a TypeScript consumer sees the contract-derived props.
  writeFileSync(path.join(pkgDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { declaration: true, emitDeclarationOnly: true, jsx: 'react-jsx', module: 'ESNext', moduleResolution: 'Bundler',
    target: 'ES2022', strict: true, skipLibCheck: true, outDir: 'dist', rootDir: 'src', types: [],
    // Declaration emission needs React's types, from the toolchain. This
    // tsconfig.json is not packed; the consumer must stay free of these paths.
    paths: { react: [path.join(toolchain.reactTypes, 'index.d.ts')], 'react/jsx-runtime': [path.join(toolchain.reactTypes, 'jsx-runtime.d.ts')] } }, include: ['src'] }, null, 2));
  writeFileSync(path.join(src, 'css-modules.d.ts'), "declare module '*.module.css' { const classes: { readonly [key: string]: string }; export default classes; }\ndeclare module '*.css';\n");
  await run(process.execPath, [toolchain.tsc, '-p', 'tsconfig.json'], pkgDir, 'tsc');
  const name = options.packageName ?? `@ds-contracts-generated/${component.toLowerCase()}`;
  writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name, version: '0.0.0-generated', private: false, type: 'module', license: 'UNLICENSED',
    description: `Generated from the ${component} contract by ds-contracts; not hand-edited.`,
    files: ['dist'], main: './dist/index.js', types: './dist/index.d.ts',
    exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './tokens.css': './dist/tokens.css', './package.json': './package.json' },
    // The barrel imports tokens.css on purpose; a consumer bundler must not drop it.
    sideEffects: ['./dist/index.js', '**/*.css'], peerDependencies: { react: '>=18', 'react-dom': '>=18' } }, null, 2));
  writeFileSync(path.join(pkgDir, 'README.md'), `# ${component} React library

Install the downloaded .tgz with npm install followed by its local file path.
Then import { ${component} } from '${name}'. The root import includes tokens.css.

Requires React 18 or later and a bundler supporting CSS Modules (such as Vite).
The archive includes generated dependencies, CSS and TypeScript declarations.
It does not include font files: load the font families declared by your design.
Generation and installation do not qualify visual fidelity or accessibility.
`);
  const packed = await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', work], pkgDir);
  const tarball = path.join(work, JSON.parse(packed)[0].filename as string);
  return { name, tarball, tarballSha256: sha256(readFileSync(tarball)), dist };
}

