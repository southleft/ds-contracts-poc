/**
 * THE INSTALLED-CLI SMOKE GATE — `npm run cli:figma-to-react:smoke:check`.
 *
 * Beta 1 promises that a user with no clone of this repository runs
 * `npx @ds-contracts/cli figma-to-react … --out ./out` and gets what the
 * in-repo `npm run figma:to-react` gives. This proves it on the packed
 * artifact, not the source tree:
 *
 *   1. build the CLI, `npm pack` it, install the tarball into an empty temp
 *      directory (the registry supplies its pinned dependencies), and install
 *      the Chromium the installed playwright-core names (as the README says);
 *   2. copy in benchmark/inputs/altitude-badge/dump.json and run
 *      `node node_modules/@ds-contracts/cli/dist/cli.js figma-to-react --dump
 *      dump.json --out ./out --fonts ./fonts.json` there, supplying the Public
 *      Sans family the dump names, with no FIGMA_TOKEN and no npm run environment;
 *   3. require the request and generated files to equal the altitude-badge pin;
 *      the archive may add only the explicit font assets and loading metadata;
 *   4. require the check to report UNVERIFIED for every one of the pin's 10
 *      variants and never a green check (no token means no Figma images);
 *   5. require that no absolute path of this repository appears in any file
 *      under out/;
 *   6. control: without fonts, and with PLAYWRIGHT_BROWSERS_PATH pointing at an
 *      empty directory, require the entire original pinned archive unchanged,
 *      NOT CHECKED, the install command, and exit 0.
 *   7. --fonts must reach the real consumer, record its faces, and reject a
 *      mismatched family before writing output from the installed artifact.
 *   8. build the Sync Runner plugin zip using its existing dump-source and
 *      engine-receipt guards. Native preparation is a separate remaining gap.
 *
 * Needs the npm registry (the install and the check's clean consumer) and
 * downloads Chromium when it is not cached. `--keep` leaves the temp directory.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tarballEntries, treeHashes, type Pin } from './benchmark-replay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN = path.join(ROOT, 'benchmark', 'pins', 'altitude-badge.figma-to-react.json');
const DUMP = path.join(ROOT, 'benchmark', 'inputs', 'altitude-badge', 'dump.json');

const problems: string[] = [];
const expect = (ok: boolean, problem: string) => { if (!ok) problems.push(problem); return ok; };
const firstDiff = (a: Record<string, string>, b: Record<string, string>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(k => a[k] !== b[k]);

/** A user's shell: no FIGMA_TOKEN and none of the npm_* variables `npm run` adds. */
function userEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'FIGMA_TOKEN' && !k.startsWith('npm_')));
  return { ...env, npm_config_update_notifier: 'false', ...extra };
}

function sh(cmd: string, args: string[], cwd: string, env = userEnv()): string {
  return execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
}

/** Every file under `dir` whose bytes contain `needle`. */
function filesContaining(dir: string, needle: string): string[] {
  const hits: string[] = [], bytes = Buffer.from(needle);
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e), st = statSync(p);
      if (st.isDirectory()) walk(p); else if (readFileSync(p).includes(bytes)) hits.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return hits;
}

function runCli(project: string, out: string, env: NodeJS.ProcessEnv, extraArgs: string[] = []) {
  const cli = path.join(project, 'node_modules', '@ds-contracts', 'cli', 'dist', 'cli.js');
  const r = spawnSync(process.execPath, [cli, 'figma-to-react', '--dump', 'dump.json', '--out', out, ...extraArgs], { cwd: project, env, encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

export async function smoke(keep = false): Promise<string[]> {
  const pin: Pin = JSON.parse(readFileSync(PIN, 'utf8'));
  const work = realpathSync(mkdtempSync(path.join(tmpdir(), 'cli-figma-to-react-smoke-')));
  try {
    console.log('building and packing @ds-contracts/cli…');
    sh('npm', ['--prefix', 'packages/cli', 'run', 'build'], ROOT, process.env);
    const packed = JSON.parse(sh('npm', ['pack', './packages/cli', '--json', '--pack-destination', work], ROOT, process.env))[0];
    const tarball = path.join(work, packed.filename);
    console.log(`  ${packed.filename}: ${packed.size} bytes packed, ${packed.unpackedSize} unpacked`);

    const project = path.join(work, 'project');
    mkdirSync(project);
    writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'cli-figma-to-react-smoke', private: true, version: '0.0.0' }, null, 2) + '\n');
    console.log('installing the tarball into an empty directory…');
    sh('npm', ['install', tarball, '--no-audit', '--no-fund', '--loglevel=error'], project);
    // The installed toolchain must be the repository's, or the bytes may differ.
    const version = (dir: string, name: string) => JSON.parse(readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8')).version as string;
    for (const name of ['esbuild', 'typescript', '@types/react', 'playwright-core'])
      expect(version(project, name) === version(ROOT, name), `toolchain-version:${name}: installed ${version(project, name)}, the repository runs ${version(ROOT, name)}`);
    console.log('installing the Chromium the installed playwright-core names…');
    sh(process.execPath, [path.join(project, 'node_modules', 'playwright-core', 'cli.js'), 'install', 'chromium'], project);
    copyFileSync(DUMP, path.join(project, 'dump.json'));
    // Supply the dump's actual family: a developer's installed Public Sans
    // otherwise masks the missing-font failure on a clean Linux runner.
    const fontFile = 'PublicSans-VariableFont_wght.ttf';
    copyFileSync(path.join(ROOT, 'extract', 'computed', 'fonts', 'public-sans', fontFile), path.join(project, fontFile));
    const licenseBytes = readFileSync(path.join(ROOT, 'extract', 'computed', 'fonts', 'public-sans', 'OFL.txt'));
    const licenseSha256 = createHash('sha256').update(licenseBytes).digest('hex');
    writeFileSync(path.join(project, 'PublicSans-OFL.txt'), licenseBytes);
    const fontFace = { family: 'Public Sans', weight: '100 900', style: 'normal',
      sha256: createHash('sha256').update(readFileSync(path.join(project, fontFile))).digest('hex'),
      license: { file: `${licenseSha256}.txt`, sha256: licenseSha256 } };
    writeFileSync(path.join(project, 'fonts.json'), JSON.stringify({ version: 1, fonts: [{ ...fontFace, file: fontFile,
      license: { ...fontFace.license, file: 'PublicSans-OFL.txt' } }] }));

    console.log('running figma-to-react from the installed CLI with local fonts (no FIGMA_TOKEN)…');
    const run = runCli(project, './out', userEnv(), ['--fonts', './fonts.json']);
    process.stdout.write(run.stdout.split('\n').map(l => '  | ' + l).join('\n') + '\n');
    if (run.stderr.trim()) process.stdout.write(run.stderr.split('\n').map(l => '  ! ' + l).join('\n') + '\n');
    if (expect(run.status === 0, `exit-code: expected 0, got ${run.status}${run.error ? ` (${run.error.message})` : ''}`)) {
      const out = path.join(project, 'out');
      const result = JSON.parse(readFileSync(path.join(out, 'result.json'), 'utf8'));
      expect(JSON.stringify(result.check?.fonts) === JSON.stringify([fontFace]), 'font-receipt: the supplied face was not recorded');
      const consumerReceipt = JSON.parse(readFileSync(path.join(out, 'check', 'receipt.json'), 'utf8'));
      expect(consumerReceipt.consumer?.fontProvision?.kind === 'package-assets', 'font-consumer: the installed check did not use packaged fonts');
      expect(consumerReceipt.package?.tarballSha256 === result.tarballSha256, 'checked-archive: the consumer did not install the emitted archive');
      const loadedFonts = consumerReceipt.consumer?.fontProvision?.loaded;
      expect(Array.isArray(loadedFonts) && loadedFonts.length === 1 &&
        Object.entries({ ...fontFace, file: `${fontFace.sha256}.ttf`, status: 'loaded' })
          .every(([key, value]) => JSON.stringify(loadedFonts[0][key]) === JSON.stringify(value)),
        'font-loaded: Chromium did not load the supplied Public Sans face');
      expect(existsSync(path.join(out, 'check', 'inputs', 'fonts', `${fontFace.sha256}.ttf`)), 'font-evidence: the authenticated font asset was not retained');
      expect(result.requestSha256 === pin.requestSha256, `request-sha256: ${result.requestSha256} ≠ pin ${pin.requestSha256}`);
      expect(result.rootId === pin.rootId, `root-id: ${result.rootId} ≠ pin ${pin.rootId}`);
      const libraries = readdirSync(path.join(out, 'work')).filter(d => d.startsWith('library-'));
      if (expect(libraries.length === 1, `work-dirs: expected one library-* directory, found ${libraries.length}`)) {
        const generated = treeHashes(path.join(out, 'work', libraries[0], 'generated'));
        const drift = firstDiff(generated, pin.generated);
        expect(drift.length === 0, `generated-files-differ: ${drift.join(', ')}`);
      }
      const entries = tarballEntries(readFileSync(path.join(out, result.tarball)));
      const fontChanges = new Set(['package/dist/index.js', 'package/package.json', 'package/README.md',
        'package/dist/fonts/fonts.css', 'package/dist/fonts/manifest.json',
        `package/dist/fonts/${fontFace.sha256}.ttf`, `package/dist/fonts/${licenseSha256}.txt`]);
      const withoutFontChanges = (tree: Record<string, string>) => Object.fromEntries(Object.entries(tree).filter(([file]) => !fontChanges.has(file)));
      const entryDrift = firstDiff(withoutFontChanges(entries), withoutFontChanges(pin.entries));
      expect(entryDrift.length === 0, `tarball-entries-differ: ${entryDrift.join(', ')}`);
      expect(entries[`package/dist/fonts/${fontFace.sha256}.ttf`] === fontFace.sha256, 'packed-font: the supplied font bytes did not travel');
      expect(entries[`package/dist/fonts/${licenseSha256}.txt`] === licenseSha256, 'packed-notice: the supplied notice did not travel');
      // The check: every variant the pin scored is reported, and none as a pass.
      const cases = pin.fidelity?.cases.length ?? 0;
      const variants: Array<{ verdict: string }> = result.check?.variants ?? [];
      expect(result.check?.status === 'unverified', `check-status: ${result.check?.status ?? 'missing'} (expected unverified without FIGMA_TOKEN)`);
      expect(variants.length === cases && variants.every(v => v.verdict === 'unverified'),
        `check-variants: ${variants.map(v => v.verdict).join(',') || 'none'} (expected ${cases} × unverified)`);
      const rows = run.stdout.split('\n').filter(l => /^ {2}\S.*\s{2}UNVERIFIED\s{2}/.test(l));
      expect(rows.length === cases, `printed-unverified-rows: ${rows.length} (expected ${cases})`);
      expect(!run.stdout.split('\n').some(l => l.startsWith('✔')), 'green-check-printed: a ✔ line without every variant passing');
      expect(/^◌ figma-to-react Badge: NOT VERIFIED/m.test(run.stdout), 'summary-line: no "◌ figma-to-react Badge: NOT VERIFIED" line');
      const leaks = filesContaining(out, ROOT);
      expect(leaks.length === 0, `repository-path-in-output: ${leaks.join(', ')}`);
    }

    console.log('control: the same run with no Chromium (PLAYWRIGHT_BROWSERS_PATH is an empty directory)…');
    const empty = path.join(work, 'no-browsers');
    mkdirSync(empty);
    const control = runCli(project, './out-control', userEnv({ PLAYWRIGHT_BROWSERS_PATH: empty }));
    process.stdout.write(control.stdout.split('\n').map(l => '  | ' + l).join('\n') + '\n');
    expect(control.status === 0, `control-exit-code: expected 0, got ${control.status}`);
    expect(/^◌ figma-to-react Badge: NOT CHECKED — no Chromium for the consumer check/m.test(control.stdout), 'control-not-checked: no NOT CHECKED line');
    expect(new RegExp(`npx playwright-core@${version(project, 'playwright-core').replace(/\./g, '\\.')} install chromium`).test(control.stdout),
      'control-install-hint: the NOT CHECKED line does not name the installed playwright-core version');
    expect(!control.stdout.split('\n').some(l => l.startsWith('✔')), 'control-green-check-printed');
    if (existsSync(path.join(project, 'out-control', 'result.json'))) {
      const controlResult = JSON.parse(readFileSync(path.join(project, 'out-control', 'result.json'), 'utf8'));
      expect(controlResult.check?.status === 'not-checked', 'control-result: check.status is not "not-checked"');
      expect(controlResult.check?.fonts === null, 'control-font-receipt: a run without fonts recorded a face');
      const controlEntries = tarballEntries(readFileSync(path.join(project, 'out-control', controlResult.tarball)));
      expect(firstDiff(controlEntries, pin.entries).length === 0, 'no-font-tarball: the original benchmark package changed');
    }
    else problems.push('control-result: out-control/result.json missing');
    console.log('control: a font file named as another family must refuse before output…');
    writeFileSync(path.join(project, 'wrong-family.json'), JSON.stringify({ version: 1, fonts: [{ ...fontFace, family: 'SF Pro', file: fontFile }] }));
    const wrongFamily = runCli(project, './out-wrong-family', userEnv(), ['--fonts', './wrong-family.json']);
    expect(wrongFamily.status === 1, `wrong-family-exit-code: expected 1, got ${wrongFamily.status}`);
    expect(/consumer-fonts:0:family-not-declared-by-font/.test(wrongFamily.stderr), 'wrong-family-refusal: no family mismatch diagnosis');
    expect(!existsSync(path.join(project, 'out-wrong-family')), 'wrong-family-output: files were written before the font refusal');
    console.log('building the Sync Runner plugin zip with its existing dump and engine receipt guards…');
    // Packaging only. Never re-record the engine receipt or dispatch to Figma.
    process.stdout.write(sh(process.execPath, [path.join(ROOT, 'scripts', 'build-plugin-zip.mjs'),
      path.join(work, 'ds-contracts-sync-runner-plugin.zip')], ROOT, process.env));
    return problems;
  } finally {
    if (keep) console.log(`kept ${work}`); else rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && /(^|[\\/])cli-figma-to-react-smoke\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  if (process.platform === 'win32') { console.error('✘ cli:figma-to-react:smoke:check runs on macOS and Linux (as the command does)'); process.exit(1); }
  smoke(process.argv.includes('--keep')).then(found => {
    if (found.length) {
      console.error(`✘ cli:figma-to-react:smoke:check — the installed CLI does not reproduce the pinned in-repo result:\n  - ${found.join('\n  - ')}`);
      process.exit(1);
    }
    console.log('✔ cli:figma-to-react:smoke:check — the packed CLI, installed with no repository, reproduces the altitude-badge pin; the check reports all 10 variants UNVERIFIED without a token and NOT CHECKED without a Chromium; the Sync Runner zip passes its dump and engine guards');
  }).catch(e => { console.error('✘ cli:figma-to-react:smoke:check — ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
