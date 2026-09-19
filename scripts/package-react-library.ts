/** Package generated React sources for installation in a CSS Modules consumer.
 * Shared by the application download and the design-led consumer check. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const exec = promisify(execFile);
async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  try {
    const result = await exec(cmd, args, { cwd, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'FIGMA_TOKEN')), npm_config_update_notifier: 'false' } });
    return result.stdout;
  } catch (error: any) {
    throw new Error(`${path.basename(cmd)} failed: ${String(error.stdout ?? '').trim().split('\n').slice(0, 3).join(' | ')} ${String(error.stderr ?? '').trim().split('\n').slice(0, 3).join(' | ')}`);
  }
}

export async function packageReactLibrary(generatedDir: string, component: string, work: string, repoRoot = ROOT) {
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
  await run(path.join(repoRoot, 'node_modules', '.bin', 'esbuild'), [...tsSources, '--format=esm', '--jsx=automatic', '--target=es2022', `--outbase=${src}`, `--outdir=${dist}`], repoRoot);
  for (const f of sources.filter(f => f.endsWith('.css'))) { const rel = path.relative(src, f); mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); cpSync(f, path.join(dist, rel)); }
  // Declarations, so a TypeScript consumer sees the contract-derived props.
  writeFileSync(path.join(pkgDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { declaration: true, emitDeclarationOnly: true, jsx: 'react-jsx', module: 'ESNext', moduleResolution: 'Bundler',
    target: 'ES2022', strict: true, skipLibCheck: true, outDir: 'dist', rootDir: 'src', types: [],
    // Declaration emission needs React's types. This packaging step is the
    // repository's tool; only the consumer below must stay free of repo paths.
    paths: { react: [path.join(repoRoot, 'node_modules', '@types', 'react', 'index.d.ts')], 'react/jsx-runtime': [path.join(repoRoot, 'node_modules', '@types', 'react', 'jsx-runtime.d.ts')] } }, include: ['src'] }, null, 2));
  writeFileSync(path.join(src, 'css-modules.d.ts'), "declare module '*.module.css' { const classes: { readonly [key: string]: string }; export default classes; }\ndeclare module '*.css';\n");
  await run(path.join(repoRoot, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], pkgDir);
  const name = `@ds-contracts-generated/${component.toLowerCase()}`;
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

