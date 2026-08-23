/**
 * `ds-contracts onboard` — the code→canvas pipeline as ONE command, in TWO
 * phases with a human acknowledgement between them.
 *
 * THE PROBLEM IT CLOSES (the owner's words): *"having to generate a JSON
 * object from a component set and then copy and paste into Figma seems like a
 * lot of steps and could potentially introduce some errors."* It was six-plus
 * steps — `init --detect`, hand-review, `extract --computed` per component, a
 * per-library promote script that lived in `examples/` and was not a verb at
 * all, `figma`, `figma bundle`, `figma publish` — and the last leg ended in a
 * clipboard.
 *
 * WHY TWO PHASES AND NOT ONE. The drafted capture config REFUSES to run
 * unreviewed: `extract/draft-capture-config.ts` writes `__review:*` markers and
 * `extract/computed/capture.ts` loadConfig refuses any config still carrying
 * the top-level `__unreviewed-draft` key, BY NAME. That refusal is not
 * ceremony — `classAllow`, `varPrefix` and the mount recipe are the three
 * fields a machine cannot infer, and a wrong answer on any of them produces a
 * CONFIDENT WRONG CONTRACT rather than an error (docs/21 §4). So there is no
 * `--yes`, no `--skip-review`, no `--force` past it. Phase 1 does everything a
 * machine can decide and stops at the one place a human must; phase 2 runs the
 * rest without stopping.
 *
 *   ds-contracts onboard <package-or-path> [--components a,b,c]
 *       phase 1 — detect · sandbox · seed · draft capture config · STOP
 *
 *   ds-contracts onboard --continue [--channel-key K] [--dry-run]
 *       phase 2 — capture · promote · emit · bundle · publish
 *
 * END STATE: the designer clicks *Check for updates* in the plugin. NO JSON
 * EVER TOUCHES A CLIPBOARD.
 *
 * The per-library half of all of this is ONE manifest, `ds-library.json` (see
 * `examples/carbon/ds-library.json`). A directory that already has one is
 * ADOPTED rather than re-detected — which is also what a second `onboard` run
 * on the same library does.
 */
import { lstatSync, realpathSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CliUsageError, flagString, parseFlags, splitList } from '../lib.js';
import { detectConfig, gatherDetectFacts, type DetectFacts } from './init.js';
import { figmaCommand } from './figma.js';
import { promote, parsePromoteConfig, type PromoteConfig } from '../promote.js';
import { DRAFT_MARKER_KEY, draftRefusalMessage, runDraftCaptureConfig } from '../../../../extract/draft-capture-config.js';
import { runExtractCommand } from '../../../../extract/run.js';
import { disclosureAdvisory, type DisclosureAdvisory } from '../../../../extract/computed/mount-sanity.js';

export const MANIFEST_FILENAME = 'ds-library.json';
export const STATE_FILENAME = 'onboard.state.json';
export const DEFAULT_WORKSPACE = '.ds-contracts/onboard';

/** The library manifest — the promote config (packages/cli/src/promote.ts)
 *  plus the stages either side of it. Every path is repo-root-relative. */
export interface LibraryManifest extends PromoteConfig {
  capture: { config: string; harness: string; env?: Record<string, string> };
  seeds?: string;
  emit: { out: string; icons?: string };
  bundle: { out: string; name: string; modes?: string[] };
}

export interface OnboardState {
  version: 1;
  /** What the user named on the command line. */
  target: string;
  library: string;
  /** Repo-relative path to the manifest phase 2 executes. */
  manifest: string;
  /** Repo root the manifest's relative paths resolve against. */
  root: string;
  /** Capture-config component names to sweep (config spelling, e.g. TextInput). */
  captureComponents: string[];
  /** True when phase 1 adopted an existing library instead of drafting. */
  adopted: boolean;
}

// ---------------------------------------------------------------------------
// Pure core — the review gate and its printed checklist
// ---------------------------------------------------------------------------

export interface ReviewStatus {
  /** Reviewed = the top-level draft marker is gone. Phase 2 refuses otherwise. */
  reviewed: boolean;
  /** Every `__review:*` field still in the config, as `path → guidance`. */
  open: Array<{ field: string; guidance: string }>;
  /** The three fields a wrong answer on fails QUIETLY (docs/21 §4), with the
   *  value the config carries today — `null` when absent. */
  craft: Array<{ field: string; value: string | null; why: string }>;
}

const CRAFT_WHY: Record<string, string> = {
  'library.classAllow':
    'which CSS classes survive into a part SIGNATURE. Too loose on a hashed/atomic system (StyleX, Tailwind) and every combo looks like a different element, so the anatomy union explodes; too tight and two genuinely different parts collapse into one. Absent = keep every class (the CSS-Modules behaviour).',
  'library.varPrefix':
    'the custom-property prefix the CSS-vars source reader follows to learn the NAME of the token a channel binds. Absent = reader off: the pixels stay correct and the token names degrade to anonymous literals — a silent loss of semantics, not an error.',
  'mount.wrapperOpen':
    'the mount recipe wrapped around EVERY stage — the theme provider / locale wrapper the library needs to render at all. Wrong here and you capture an unthemed component that still renders, which is the worst kind of wrong: it looks like a result.',
};

/** PURE: walk a capture config, collecting every `__review:*` marker and the
 *  three craft fields, so the gate can be printed without a browser. */
export function reviewStatus(config: Record<string, unknown>): ReviewStatus {
  const open: Array<{ field: string; guidance: string }> = [];
  (function walk(node: unknown, trail: string[]) {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, [...trail, String(i)]));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('__review')) {
        open.push({ field: [...trail, k.replace(/^__review:?/, '') || k].join('.'), guidance: String(v) });
      } else walk(v, [...trail, k]);
    }
  })(config, []);

  const at = (dotted: string): unknown =>
    dotted.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), config);
  const craft = Object.entries(CRAFT_WHY).map(([field, why]) => {
    const v = at(field);
    return { field, value: v === undefined ? null : String(v), why };
  });

  return { reviewed: config[DRAFT_MARKER_KEY] === undefined, open, craft };
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

const readJson = (p: string): Record<string, unknown> => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory();

/** True when `child` is `parent` or inside it (path containment, not string
 *  prefix — `foo-bar` is not inside `foo`).
 *
 *  REALPATH-HARDENED (2026-08-03, adversarial verifier): the string form is a
 *  lie in the presence of symlinks — `sandbox/node_modules/<pkg>` pointing at
 *  the host repo satisfies string containment while every read goes to the
 *  host. That is exactly what `npm i <dir>` / `npm link` / workspaces produce,
 *  and a sandbox left by a PREVIOUS CLI version is reused as-is. Both sides
 *  resolve through realpathSync before comparison, so a symlinked entry can no
 *  longer smuggle the host repo inside the sandbox boundary. */
const within = (child: string, parent: string): boolean => {
  const rc = existsSync(child) ? realpathSync(child) : child;
  const rp = existsSync(parent) ? realpathSync(parent) : parent;
  const r = path.relative(rp, rc);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

const SKIP_WALK = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

/** Bounded walk: does this directory hold any .tsx source the static pass can
 *  read? (dist-only npm packages hold none — the refusal names that.) */
function hasTsx(dir: string, depth: number): boolean {
  if (depth < 0 || !isDir(dir)) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) if (e.isFile() && e.name.endsWith('.tsx')) return true;
  for (const e of entries) {
    if (e.isDirectory() && !SKIP_WALK.has(e.name) && hasTsx(path.join(dir, e.name), depth - 1)) return true;
  }
  return false;
}

/** The repo root a manifest's relative paths resolve against: the manifest
 *  names its own `exampleDir`, so the root is that many levels up. */
export const rootForManifest = (manifestPath: string, exampleDir: string): string =>
  path.resolve(path.dirname(manifestPath), ...exampleDir.split('/').map(() => '..'));

function parseManifest(file: string): LibraryManifest {
  const raw = readJson(file);
  const base = parsePromoteConfig(raw, file);
  for (const [k, shape] of [['capture', 'an object with "config" and "harness"'], ['emit', 'an object with "out"'], ['bundle', 'an object with "out" and "name"']] as const) {
    if (!raw[k] || typeof raw[k] !== 'object') throw new CliUsageError(`${file}: "${k}" must be ${shape}`);
  }
  const m = { ...base, ...(raw as object) } as LibraryManifest;
  if (!m.capture.config || !m.capture.harness) throw new CliUsageError(`${file}: "capture" needs both "config" and "harness"`);
  if (!m.emit.out) throw new CliUsageError(`${file}: "emit" needs "out"`);
  if (!m.bundle.out || !m.bundle.name) throw new CliUsageError(`${file}: "bundle" needs both "out" and "name"`);
  return m;
}

/** Re-invoke this same CLI in a child process. Under `tsx` the loader flags
 *  live in execArgv, so the same call works in-repo and from dist.
 *
 *  stderr is PIPED (and re-printed verbatim after the child exits) so the
 *  caller can tell a runner's NAMED refusal from an engine fault — the walk
 *  showed a `REFUSED:` throw out of the capture runner being relabeled "an
 *  engine fault" because nothing here could read what the child said. stdout
 *  stays inherited: the capture's live progress is still live. */
function runChild(entry: string, args: string[], env: Record<string, string> = {}): { status: number; stderr: string } {
  const r = spawnSync(process.execPath, [...process.execArgv, entry, ...args], {
    stdio: ['inherit', 'inherit', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) throw new Error(`could not run ${path.basename(entry)}: ${r.error.message}`);
  return { status: r.status ?? 1, stderr: r.stderr ?? '' };
}

/** The computed-capture runner: the separately bundled chunk beside dist/cli.js
 *  when installed, extract/computed/run.ts when running in the repo.
 *
 *  TWO LAYOUTS, both real: from the BUNDLED dist/cli.js this module's URL is
 *  dist/cli.js itself, so the chunk is a SIBLING ('./computed.js'); tsx-run
 *  from source it is src/commands/onboard.ts, so neither sibling spelling
 *  exists and the repo's extract/computed/run.ts is found by walking UPWARD —
 *  never by a fixed '../../../../' hop, which from dist/cli.js escapes the
 *  repo entirely and lands on a path that exists for nobody. */
function computedRunnerEntry(root: string): string {
  const tried: string[] = [];
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const chunk of [path.join(here, 'computed.js'), path.join(here, '..', 'computed.js')]) {
    if (existsSync(chunk)) return chunk;
    tried.push(chunk);
  }
  // In-repo: walk upward from both this module and the workspace root,
  // accepting only a directory that is recognizably THIS repo (package.json
  // present beside extract/computed/run.ts) — an arbitrary ancestor's
  // extract/ dir must not be mistaken for the runner.
  for (const start of [here, root]) {
    let dir = path.resolve(start);
    for (let i = 0; i < 12; i++) {
      const runner = path.join(dir, 'extract', 'computed', 'run.ts');
      if (existsSync(path.join(dir, 'package.json')) && existsSync(runner)) return runner;
      tried.push(runner);
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  throw new Error(
    'the computed-capture runner is not available here — expected dist/computed.js beside the installed CLI, ' +
      'or extract/computed/run.ts in a repo above the CLI or the workspace. Looked at:\n' +
      [...new Set(tried)].map((t) => `  - ${t}`).join('\n'),
  );
}

/** Print paths relative to the cwd when that is shorter and clearer, absolute
 *  when the target is outside it — `../../../tmp/x` helps nobody. */
export const displayPath = (p: string, from: string = process.cwd()): string => {
  const r = path.relative(from, p);
  return r === '' || r.startsWith('..') ? p : r.split(path.sep).join('/');
};

const stage = (n: number, total: number, name: string, detail: string): void =>
  console.log(`[${n}/${total}] ${name.padEnd(8)} ${detail}`);

// ---------------------------------------------------------------------------
// Phase 1 — detect · sandbox · seed · draft · STOP
// ---------------------------------------------------------------------------

function phaseOne(argv: string[]): number {
  const parsed = parseFlags(argv, { value: ['components', 'workspace'], bool: ['force'] });
  const target = parsed.positionals[0];
  if (!target) {
    throw new CliUsageError(
      'onboard needs a package or path: `ds-contracts onboard <package-or-path>` (a directory that already has a ds-library.json is adopted; anything else is onboarded from scratch)',
    );
  }
  const workspace = path.resolve(flagString(parsed, 'workspace') ?? DEFAULT_WORKSPACE);
  const only = splitList(flagString(parsed, 'components'));

  // ---- ADOPT: the target already carries a library manifest ----
  const manifestPath = isDir(target) ? path.join(path.resolve(target), MANIFEST_FILENAME) : null;
  if (manifestPath && existsSync(manifestPath)) {
    const manifest = parseManifest(manifestPath);
    const root = rootForManifest(manifestPath, manifest.exampleDir);
    console.log(`ds-contracts onboard — phase 1 of 2\n`);
    stage(1, 4, 'detect', `ADOPTED ${path.relative(root, manifestPath) || manifestPath} — this library is already described; nothing was re-detected or re-drafted.`);

    const missing: string[] = [];
    const need: Array<[string, string]> = [
      ['capture config', manifest.capture.config],
      ['sandbox (harness)', manifest.capture.harness],
      ['base tokens', manifest.dtcg],
    ];
    if (manifest.seeds) need.push(['seed contracts', manifest.seeds]);
    for (const [label, rel] of need) if (!existsSync(path.resolve(root, rel))) missing.push(`${label}: ${rel}`);
    if (missing.length > 0) {
      throw new CliUsageError(
        `${path.basename(manifestPath)} names input(s) that do not exist here:\n${missing.map((m) => `  - ${m}`).join('\n')}\n` +
          '  The sandbox is git-ignored by design — recreate it from the library\'s PROVENANCE.md before continuing.',
      );
    }
    stage(2, 4, 'sandbox', `REUSED ${manifest.capture.harness} (git-ignored; its recreate recipe is the library's PROVENANCE.md)`);
    stage(3, 4, 'seed', manifest.seeds ? `REUSED ${manifest.seeds} — the prop space the capture enumerates against` : 'none declared — the capture reads its prop space from the promoted contracts');

    const captureCfg = readJson(path.resolve(root, manifest.capture.config));
    const status = reviewStatus(captureCfg);
    const captureComponents = (captureCfg.components as Array<{ name: string }> | undefined ?? []).map((c) => c.name);
    const selected = only.length > 0
      ? captureComponents.filter((n) => only.some((o) => o.toLowerCase() === n.toLowerCase()))
      : captureComponents;
    if (only.length > 0 && selected.length !== only.length) {
      const unknown = only.filter((o) => !captureComponents.some((n) => n.toLowerCase() === o.toLowerCase()));
      throw new CliUsageError(`--components names component(s) the capture config does not declare: ${unknown.join(', ')} (declared: ${captureComponents.join(', ')})`);
    }
    stage(4, 4, 'review', `${manifest.capture.config} — ${status.reviewed ? 'REVIEWED (no "__unreviewed-draft" marker)' : 'UNREVIEWED DRAFT'}`);

    writeState(workspace, {
      version: 1,
      target,
      library: manifest.library,
      manifest: path.relative(root, manifestPath),
      root,
      captureComponents: selected,
      adopted: true,
    });
    printReviewGate(status, path.resolve(root, manifest.capture.config), workspace, selected, manifest, captureCfg, root);
    return 0;
  }

  // ---- FRESH: detect · sandbox · seed · draft ----
  return freshOnboard(target, workspace, only, parsed.flags.get('force') === true);
}

function freshOnboard(target: string, workspace: string, only: string[], force: boolean): number {
  console.log('ds-contracts onboard — phase 1 of 2\n');
  mkdirSync(workspace, { recursive: true });
  const stateFile = path.join(workspace, STATE_FILENAME);
  if (existsSync(stateFile) && !force) {
    throw new CliUsageError(
      `${displayPath(stateFile)} already exists — an onboarding is in flight here.\n` +
        '  Continue it:  ds-contracts onboard --continue\n' +
        '  Start over:   ds-contracts onboard <target> --force',
    );
  }

  /** The root every manifest-relative path resolves against. Phase 2 reads it
   *  back from onboard.state.json; the review gate resolves seed contracts
   *  against it too. */
  const root = process.cwd();

  // 1 · detect — the SAME pure detector `init --detect` uses. Every prefilled
  //     value is detected, NEVER confirmed. A PATH target is detected in
  //     place; an NPM PACKAGE is detected AFTER the sandbox install, from the
  //     installed copy — never from this cwd, whose own sources are exactly
  //     the thing this command must not extract.
  const local = isDir(target) ? path.resolve(target) : null;
  let facts: DetectFacts | null = local ? gatherDetectFacts(local) : null;
  const pkgName = local
    ? (facts?.pkg?.name ?? path.basename(local))
    : target.replace(/@[^@/]+$/, '');
  const library = pkgName.replace(/^@/, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  if (local && facts) {
    const { stylingHints } = detectConfig(facts);
    stage(1, 4, 'detect', `${pkgName} — adapter ${facts.cemManifest ? 'cem' : 'react-tsx'}${stylingHints.length ? `, styling: ${stylingHints.join(', ')}` : ''} (DETECTED, not confirmed)`);
  } else {
    stage(1, 4, 'detect', `${pkgName} — npm package: adapter/styling detection runs against the INSTALLED copy inside the sandbox, never against this cwd's own sources`);
  }

  // 2 · sandbox — created or reused. The ONLY network-touching step in the
  //     whole pipeline; everything downstream is a pure function of it.
  const sandbox = path.join(workspace, 'sandbox');
  const installed = existsSync(path.join(sandbox, 'node_modules', ...pkgName.split('/')));
  if (!installed) {
    mkdirSync(sandbox, { recursive: true });
    if (!existsSync(path.join(sandbox, 'package.json'))) {
      writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: `${library}-sandbox`, private: true }, null, 2) + '\n');
    }
    // PATH FORM: npm pack → install the TARBALL. `npm i <dir>` SYMLINKS the
    // path and never installs its runtime deps, so the capture harness's
    // esbuild later fails with a wall of unresolvable imports. A packed
    // tarball installs like a registry package — real copy, deps resolve.
    let spec = target;
    if (local) {
      console.log(`         packing ${displayPath(local)} → tarball (an \`npm i <dir>\` symlink leaves the package's own deps uninstalled) …`);
      const packed = spawnSync('npm', ['pack', local, '--pack-destination', sandbox], { cwd: sandbox, encoding: 'utf8' });
      const tarball = (packed.stdout ?? '').trim().split('\n').pop() ?? '';
      if ((packed.status ?? 1) !== 0 || tarball === '' || !existsSync(path.join(sandbox, tarball))) {
        throw new Error(
          `npm pack failed for ${displayPath(local)} — the sandbox installs a PACKED tarball (a real copy whose deps resolve), never a file: symlink. ` +
            `Check ${displayPath(path.join(local, 'package.json'))} (does it exist, and do its "files" include the sources?), then re-run.` +
            ((packed.stderr ?? '').trim() ? `\n  npm said:\n${(packed.stderr ?? '').trim().split('\n').map((l) => `    ${l}`).join('\n')}` : ''),
        );
      }
      spec = path.join(sandbox, tarball);
    }
    console.log(`         installing ${displayPath(spec)} + react + react-dom + esbuild into ${displayPath(sandbox)} …`);
    const r = spawnSync('npm', ['i', spec, 'react', 'react-dom', 'esbuild'], { cwd: sandbox, stdio: 'inherit' });
    if ((r.status ?? 1) !== 0) {
      throw new Error(
        `sandbox install failed for ${spec}. The sandbox is the one step that touches the network; fix it before continuing ` +
          `(some packages need an env flag — @carbon/react needs IBM_TELEMETRY_DISABLED=true, or its postinstall phones home and the pin is not reproducible).`,
      );
    }
  }
  stage(2, 4, 'sandbox', `${installed ? 'REUSED' : 'created'} ${displayPath(sandbox)}`);

  // WHERE EXTRACTION READS FROM. Path form: the path itself (a source
  // checkout). Package form: the INSTALLED package inside the sandbox — its
  // shipped sources or nothing. Falling back to this cwd's ./src walked the
  // HOST repo and shipped 51 confident wrong contracts under the wrong
  // idPrefix, reported as ✔ success; that fallback no longer exists.
  let extractionBase: string;
  if (local) {
    extractionBase = local;
  } else {
    const pkgDir = path.join(sandbox, 'node_modules', ...pkgName.split('/'));
    if (!existsSync(path.join(pkgDir, 'package.json'))) {
      throw new Error(
        `${pkgName} installed, but no package landed at ${displayPath(pkgDir)} — cannot locate the installed package to extract from, and extracting anything else (this cwd) is refused.`,
      );
    }
    // A SYMLINKED node_modules entry is refused for the package form: a
    // registry install never symlinks, so a symlink here means a file:/link:
    // install or a sandbox a previous CLI left behind — and its target can be
    // ANY directory, including this host repo. Verified escape (2026-08-03):
    // string containment passed while extraction read the host's src/.
    if (lstatSync(pkgDir).isSymbolicLink()) {
      throw new CliUsageError(
        `${pkgName}: ${displayPath(pkgDir)} is a SYMLINK (target ${realpathSync(pkgDir)}) — a registry install never symlinks, so this sandbox was built by an older CLI or a linked install and its target may be OUTSIDE the sandbox. Delete ${displayPath(path.join(sandbox))} and re-run onboard so the package is installed as a real copy.`,
      );
    }
    extractionBase = pkgDir;
    facts = gatherDetectFacts(pkgDir);
    const { stylingHints } = detectConfig(facts);
    console.log(`         detected in the installed package: adapter ${facts.cemManifest ? 'cem' : 'react-tsx'}${stylingHints.length ? `, styling: ${stylingHints.join(', ')}` : ''} (DETECTED, not confirmed)`);
  }
  const f = facts as DetectFacts;

  const srcRoot = f.cemManifest ? null : (f.existingRoots.find((r2) => hasTsx(path.join(extractionBase, r2), 4)) ?? null);
  if (!f.cemManifest && !srcRoot) {
    if (local) {
      throw new CliUsageError(
        `${displayPath(local)} has no .tsx sources under src/components, src, components or lib, and no custom-elements manifest — nothing the static pass can extract. Point onboard at the package's SOURCE directory.`,
      );
    }
    throw new CliUsageError(
      `${pkgName} (installed at ${displayPath(extractionBase)}) ships NO extractable .tsx sources — many packages publish only built output (dist/), and the static pass reads .tsx prop surfaces.\n` +
        `  onboard REFUSES to fall back to this cwd's own sources: that extraction would produce confident wrong ${library}.* contracts cut from the HOST repo, reported as success.\n` +
        `  Point onboard at a SOURCE CHECKOUT of ${pkgName} instead:\n` +
        `    git clone <its repository> && ds-contracts onboard <path-to-the-clone>\n` +
        `  (an unpacked source tarball works the same).`,
    );
  }
  const extractRootAbs = srcRoot ? path.join(extractionBase, srcRoot) : null;
  // THE HOST-REPO GUARD — it must be IMPOSSIBLE for the extraction root to
  // escape the target. Belt over the logic above, refused by name.
  if (extractRootAbs && (!within(extractRootAbs, extractionBase) || (!local && !within(extractRootAbs, sandbox)))) {
    throw new Error(`internal guard: extraction root ${extractRootAbs} escaped the target ${extractionBase} — refusing to extract`);
  }
  if (!local && extractRootAbs && !within(extractRootAbs, sandbox)) {
    throw new Error(`internal guard: the package form's extraction root must live INSIDE the sandbox (got ${extractRootAbs}) — extracting the host repo is refused`);
  }

  // 3 · seed — the static pass over the TARGET's own source. The capture
  //     NEVER re-derives the API; it reads the prop space from these
  //     contracts.
  const extractConfig = path.join(workspace, 'extract.config.json');
  const seedOut = path.join(workspace, 'extract-out');
  writeFileSync(
    extractConfig,
    JSON.stringify({
      $comment: `written by \`ds-contracts onboard ${target}\` — the static pass that produces the seed contracts the capture enumerates against`,
      code: f.cemManifest
        ? { adapter: 'cem', manifest: path.relative(root, path.join(extractionBase, f.cemManifest)) }
        : { adapter: 'react-tsx', root: path.relative(root, extractRootAbs!) },
      design: { source: 'design-dump.json' },
      tokens: f.tokenFiles.map((t) => path.relative(root, path.join(extractionBase, t))),
      idPrefix: library,
      out: path.relative(root, seedOut),
    }, null, 2) + '\n',
  );
  runExtractCommand('code', extractConfig);
  stage(3, 4, 'seed', `${displayPath(seedOut)}/contracts — the prop space the capture enumerates against`);

  // 4 · draft — machine-generated, marked UNREVIEWED, and REFUSED by the
  //     capture runner until a human deletes the marker.
  const draftPath = runDraftCaptureConfig(extractConfig, path.join(workspace, 'capture-config.json'));
  const captureCfg = readJson(draftPath);
  const captureComponents = (captureCfg.components as Array<{ name: string }> | undefined ?? []).map((c) => c.name);
  if (only.length > 0) {
    const unknown = only.filter((o) => !captureComponents.some((n) => n.toLowerCase() === o.toLowerCase()));
    if (unknown.length > 0) {
      throw new CliUsageError(`--components names component(s) the static pass did not find: ${unknown.join(', ')} (found: ${captureComponents.join(', ')})`);
    }
  }
  const selected = only.length > 0 ? captureComponents.filter((n) => only.some((o) => o.toLowerCase() === n.toLowerCase())) : captureComponents;
  // --components narrows the DRAFT CONFIG TOO — otherwise the review gate
  // points a human at markers on components nobody selected, and phase 2's
  // "whole-library sweep" captures components the manifest then drops.
  if (selected.length !== captureComponents.length) {
    const keep = new Set(selected.map((s) => s.toLowerCase()));
    captureCfg.components = (captureCfg.components as Array<{ name: string }>).filter((c) => keep.has(c.name.toLowerCase()));
  }
  // library.package/version — the draft shell reads THIS cwd's package.json;
  // the truth is the TARGET's own manifest (the capture runner refuses
  // version drift against the sandbox, so a host-repo name here would refuse
  // every run).
  try {
    const tp = JSON.parse(readFileSync(path.join(extractionBase, 'package.json'), 'utf8')) as { name?: string; version?: string };
    const lib = captureCfg.library as Record<string, unknown> | undefined;
    if (lib && typeof tp.name === 'string' && typeof tp.version === 'string') {
      lib.package = tp.name;
      lib.version = tp.version;
      delete lib['__review:package'];
      lib['__review:version'] = `detected from the TARGET's package.json (${displayPath(extractionBase)}), NOT confirmed — the harness must carry ${tp.name}@${tp.version} exactly (the runner refuses version drift)`;
    }
  } catch {
    /* unreadable target package.json — the draft's own review marker stands */
  }
  writeFileSync(draftPath, JSON.stringify(captureCfg, null, 2) + '\n');
  const status = reviewStatus(captureCfg);

  // The manifest phase 2 executes. Written now so the human reviews the whole
  // plan, not just the capture config.
  const manifestPath = path.join(workspace, MANIFEST_FILENAME);
  const rel = (p: string): string => displayPath(p);
  const manifest: LibraryManifest = {
    library,
    exampleDir: rel(workspace),
    captureOut: rel(path.join(workspace, 'out')),
    dtcg: f.tokenFiles[0] ? rel(path.join(extractionBase, f.tokenFiles[0])) : rel(path.join(workspace, 'tokens', `${library}.dtcg.json`)),
    mintedOut: rel(path.join(workspace, 'tokens', `${library}-minted.dtcg.json`)),
    mintedDoc: rel(path.join(workspace, 'tokens', 'MINTED.md')),
    components: selected.map((n) => n.toLowerCase()),
    contractStem: {},
    contractVersion: '0.2.0',
    promoterPath: `ds-contracts promote --config ${rel(manifestPath)}`,
    possessive: "the library's",
    mintedDocTitle: `${library} minted tokens`,
    capture: { config: rel(draftPath), harness: rel(sandbox) },
    seeds: rel(path.join(seedOut, 'contracts')),
    emit: { out: rel(path.join(workspace, 'figma')) },
    bundle: { out: rel(path.join(workspace, 'figma', `${library}.bundle.json`)), name: library },
  };
  mkdirSync(path.join(workspace, 'contracts'), { recursive: true });
  mkdirSync(path.join(workspace, 'tokens'), { recursive: true });
  // THE PROMISED TOKEN FILE. When the target ships no token file, the
  // manifest's "dtcg" names a path — so that path must EXIST, as a skeleton a
  // human authors, or promote later dies on a bare ENOENT for a file this
  // command promised and never wrote.
  if (!f.tokenFiles[0]) {
    const skeletonPath = path.join(workspace, 'tokens', `${library}.dtcg.json`);
    if (!existsSync(skeletonPath)) {
      writeFileSync(
        skeletonPath,
        JSON.stringify({
          $description:
            `SKELETON DTCG token file, written by \`ds-contracts onboard ${target}\` because no token file was detected in the target. ` +
            `The manifest's "dtcg" names THIS file: phase 2's promote stage aliases minted leaves against it, and while it is empty every ` +
            `minted leaf stays an anonymous literal. AUTHOR YOUR LIBRARY'S TOKENS HERE. THE FLAT-NAME RULE: every leaf's key must equal the ` +
            `CSS custom property name minus its leading "--" (the token for --btn-bg is the TOP-LEVEL key "btn-bg") — the source-alias join ` +
            `matches on that flat spelling, so a nested tree verifies 0 facts. Leaf shape: {"$value": "#1f6feb", "$type": "color"}. ` +
            `Delete this $description once authored.`,
        }, null, 2) + '\n',
      );
      console.log(`         tokens: none detected in the target — SKELETON written → ${rel(skeletonPath)} (author your tokens there; FLAT leaf names: css var minus "--")`);
    }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  stage(4, 4, 'draft', `${rel(draftPath)} + ${rel(manifestPath)}`);

  writeState(workspace, {
    version: 1,
    target,
    library,
    manifest: rel(manifestPath),
    root,
    captureComponents: selected,
    adopted: false,
  });
  printReviewGate(status, draftPath, workspace, selected, manifest, captureCfg, root);
  return 0;
}

function writeState(workspace: string, state: OnboardState): void {
  mkdirSync(workspace, { recursive: true });
  writeFileSync(path.join(workspace, STATE_FILENAME), JSON.stringify(state, null, 2) + '\n');
}

/** Reads each queued component's seed contract for a disclosure/anchor prop the
 *  config leaves undriven. Absent seeds are skipped in silence rather than
 *  guessed at — the advisory's only job is to be right when it speaks. */
export function mountAdvisories(
  captureCfg: Record<string, unknown> | undefined,
  root: string | undefined,
  components: string[],
): DisclosureAdvisory[] {
  if (!captureCfg || !root) return [];
  const queued = new Set(components.map((c) => c.toLowerCase()));
  const entries = (captureCfg.components as Array<Record<string, unknown>> | undefined) ?? [];
  const out: DisclosureAdvisory[] = [];
  for (const e of entries) {
    const name = String(e.name ?? '');
    if (!queued.has(name.toLowerCase())) continue;
    const seed = typeof e.contract === 'string' ? path.resolve(root, e.contract) : null;
    if (!seed || !existsSync(seed)) continue;
    let propNames: string[] = [];
    try {
      propNames = ((JSON.parse(readFileSync(seed, 'utf8')) as { props?: Array<{ name: string }> }).props ?? []).map((p) => p.name);
    } catch {
      continue;
    }
    const a = disclosureAdvisory(name, propNames, {
      openDriver: e.openDriver,
      portalCapture: e.portalCapture,
      fixedProps: e.fixedProps as Record<string, unknown> | undefined,
    });
    if (a) out.push(a);
  }
  return out;
}

/** The whole point of phase 1: say exactly what a human must decide, why each
 *  field matters, and the ONE command that continues. */
function printReviewGate(
  status: ReviewStatus,
  captureConfigPath: string,
  workspace: string,
  components: string[],
  manifest: LibraryManifest,
  captureCfg?: Record<string, unknown>,
  root?: string,
): void {
  const wsFlag = path.resolve(DEFAULT_WORKSPACE) === path.resolve(workspace) ? '' : ` --workspace ${displayPath(workspace)}`;
  const cfgRel = displayPath(captureConfigPath);
  console.log('');
  if (!status.reviewed) {
    console.log(`⏸  STOPPED at the review gate — ${cfgRel} is an UNREVIEWED DRAFT.`);
    console.log('');
    console.log('   There is no flag that skips this, and that is deliberate. The three fields');
    console.log('   below cannot be inferred from source, and a wrong answer on any of them does');
    console.log('   not error — it produces a CONFIDENT WRONG CONTRACT (docs/21 §4).');
  } else {
    console.log(`✔  ${cfgRel} is REVIEWED (no "${DRAFT_MARKER_KEY}" marker) — phase 2 will run.`);
    console.log('   Confirm the three fields below before you do; they are the ones that fail quietly.');
  }
  console.log('');
  console.log('   THE THREE THAT FAIL QUIETLY');
  for (const c of status.craft) {
    console.log(`   · ${c.field} = ${c.value === null ? '(absent)' : JSON.stringify(c.value)}`);
    console.log(`       ${c.why}`);
  }
  if (status.open.length > 0) {
    console.log('');
    console.log(`   ${status.open.length} FIELD(S) STILL MARKED "__review:*" — fix the value, then delete the marker`);
    for (const o of status.open) console.log(`   · ${o.field}\n       ${o.guidance}`);
  }
  // MOUNT ADVISORY (task #48). A component whose own prop surface says it has
  // a closed state, with nothing in the config driving it open, is the one
  // class of capture that goes WRONG WITHOUT ERRORING: the harness renders the
  // activator, the sweep measures the activator, and a contract ships
  // describing a button. The review gate is where a person is already looking,
  // so this is where it belongs. It is an advisory, not a refusal — a
  // component can legitimately be captured closed (MUI's Accordion is) and the
  // run-level mount-sanity check is the hard stop.
  const advisories = mountAdvisories(captureCfg, root, components);
  if (advisories.length > 0) {
    console.log('');
    console.log(`   ⚠  ${advisories.length} COMPONENT(S) MAY CAPTURE THEIR TRIGGER INSTEAD OF THEMSELVES`);
    for (const a of advisories) console.log(`   · ${a.component}\n       ${a.message}`);
  }
  console.log('');
  console.log(`   Components queued for capture (${components.length}): ${components.join(', ') || '(none)'}`);
  console.log(`   Then, without stopping: promote → emit → bundle (${manifest.bundle.out}) → publish.`);
  console.log('');
  if (!status.reviewed) {
    console.log(`   1. Open ${cfgRel}, answer every "__review:*" field, delete each marker.`);
    console.log(`   2. Delete the top-level "${DRAFT_MARKER_KEY}" key. That deletion IS the acknowledgement.`);
    console.log(`   3. ds-contracts onboard --continue${wsFlag}`);
  } else {
    console.log(`   ds-contracts onboard --continue${wsFlag} [--channel-key <K>]`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Phase 2 — capture · promote · emit · bundle · publish
// ---------------------------------------------------------------------------

async function phaseTwo(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ['workspace', 'channel-key', 'bridge', 'from'],
    bool: ['continue', 'dry-run'],
  });
  const workspace = path.resolve(flagString(parsed, 'workspace') ?? DEFAULT_WORKSPACE);
  const stateFile = path.join(workspace, STATE_FILENAME);
  if (!existsSync(stateFile)) {
    throw new CliUsageError(
      `no onboarding in flight at ${displayPath(workspace)} (${STATE_FILENAME} not found).\n` +
        '  Start one:  ds-contracts onboard <package-or-path>',
    );
  }
  const state = JSON.parse(readFileSync(stateFile, 'utf8')) as OnboardState;
  const manifestPath = path.resolve(state.root, state.manifest);
  const manifest = parseManifest(manifestPath);
  const root = state.root;
  const abs = (rel: string): string => path.resolve(root, rel);

  // ---- THE REVIEW GATE. Checked here, before a browser starts, using the
  //      SAME marker and the SAME refusal message the capture runner uses —
  //      one rule, two places it can be heard.
  const captureConfigPath = abs(manifest.capture.config);
  if (!existsSync(captureConfigPath)) throw new CliUsageError(`capture config not found: ${manifest.capture.config}`);
  const captureCfg = JSON.parse(readFileSync(captureConfigPath, 'utf8')) as Record<string, unknown>;
  if (captureCfg[DRAFT_MARKER_KEY] !== undefined) {
    const status = reviewStatus(captureCfg);
    console.error(`✘ ${draftRefusalMessage(manifest.capture.config)}`);
    console.error(`  ${status.open.length} "__review:*" field(s) are still open:`);
    for (const o of status.open) console.error(`    - ${o.field}`);
    console.error('  Nothing was captured, promoted, bundled or published. Review, delete the marker, then re-run.');
    return 1;
  }

  // The base DTCG file is read by promote AND emit AND bundle — a missing one
  // used to surface as a bare ENOENT out of promote. Refuse it BY NAME, with
  // the authoring step, before any browser time is spent.
  if (!existsSync(abs(manifest.dtcg))) {
    console.error(`✘ REFUSED — the base DTCG token file the manifest names does not exist: ${manifest.dtcg}`);
    console.error(`  (named as "dtcg" in ${state.manifest}). Onboard writes a SKELETON there when the target ships no token file;`);
    console.error('  author your library\'s tokens in it — FLAT leaf names: each key = the CSS custom property minus "--"');
    console.error('  (the token for --btn-bg is the top-level key "btn-bg"; a nested tree verifies 0 facts) — then re-run:');
    console.error('  ds-contracts onboard --continue');
    console.error('  Nothing was captured, promoted, bundled or published.');
    return 1;
  }

  // `--from <stage>` RESUMES a run whose earlier stages already produced
  // artifacts — a bundle step that failed should not cost another 40 minutes
  // of browser time. It is NOT a way past the review gate: the gate above runs
  // first and unconditionally, whatever stage you resume from.
  const STAGES = ['capture', 'promote', 'emit', 'bundle', 'publish'] as const;
  const fromArg = flagString(parsed, 'from') ?? 'capture';
  const fromIdx = STAGES.indexOf(fromArg as (typeof STAGES)[number]);
  if (fromIdx < 0) throw new CliUsageError(`--from must be one of: ${STAGES.join(', ')} (got "${fromArg}")`);
  const skip = (s: (typeof STAGES)[number]): boolean => STAGES.indexOf(s) < fromIdx;

  const TOTAL = 5;
  const key = flagString(parsed, 'channel-key') ?? process.env.DS_CONTRACTS_CHANNEL_KEY;
  const dryRun = parsed.flags.get('dry-run') === true;
  console.log(`ds-contracts onboard --continue — phase 2 of 2 (${state.library})\n`);

  // ---- 1 · CAPTURE ----
  //
  // ONE SWEEP FOR THE WHOLE LIBRARY unless the run was narrowed. This is not
  // just faster (one browser launch, one esbuild of the harness): the runner's
  // read-boundary frontier receipts are collected ACROSS the components of a
  // run and written into every component's LEDGER.md / enriched.extension.json,
  // so a per-component sweep and a whole-library sweep produce DIFFERENT
  // committed bytes for the same component. Measured, not assumed —
  // `--component Button` alone rewrites carbon/button/LEDGER.md without the
  // Accordion/Tabs frontier lines the committed file carries. Narrowing with
  // `--components` is therefore an explicitly narrowed artifact set, and it
  // says so.
  // TOKENS.CSS PREFLIGHT (adversarial walk): a capture config whose
  // tokens.css was "" passed the runner's load, burned ALL browser phases,
  // and died as an uncaught runGate stack trace that the engine-fault message
  // below then mislabeled. The capture runner (extract/computed/capture.ts
  // loadConfig) and the gate (extract/computed/gate.ts gateInventory) now
  // refuse this by name; checking it HERE too costs nothing and names the
  // authoring step before a browser starts.
  if (!skip('capture')) {
    const css = (captureCfg.tokens as { css?: unknown } | undefined)?.css;
    const cssPath = typeof css === 'string' && css.trim() !== '' ? path.resolve(root, css) : null;
    if (css !== undefined && (cssPath === null || !existsSync(cssPath) || !statSync(cssPath).isFile())) {
      console.error(`✘ REFUSED — the capture config's tokens.css ${cssPath === null ? 'is empty' : `is not a readable file: ${String(css)} (resolved ${cssPath})`}`);
      console.error(`  (named in ${manifest.capture.config}). The gate page renders against the library token stylesheet, so it must name a built CSS file of custom properties.`);
      console.error('  If the library ships NO custom-properties stylesheet, author a small one yourself: define each DTCG leaf as a custom property');
      console.error(`  (the token for leaf "btn-bg" is the rule \`--btn-bg: <value>;\` under :root) — the skeleton token file's $description in ${manifest.dtcg} explains the flat-name rule — then point tokens.css at that file.`);
      console.error('  Nothing was captured, promoted, bundled or published.');
      return 1;
    }
  }

  const declared = (captureCfg.components as Array<{ name: string }> | undefined ?? []).map((c) => c.name);
  const narrowed = state.captureComponents.length !== declared.length;
  const sweeps: Array<string | null> = narrowed ? state.captureComponents : [null];
  const quarantined: Array<{ component: string; reason: string }> = [];
  if (skip('capture')) {
    stage(1, TOTAL, 'capture', `SKIPPED (--from ${fromArg}) — resuming over the artifacts already in ${manifest.captureOut}`);
    for (const c of state.captureComponents) {
      const refusal = path.join(abs(manifest.captureOut), c.toLowerCase(), 'refusal.json');
      if (!existsSync(refusal)) continue;
      const r = JSON.parse(readFileSync(refusal, 'utf8')) as { reason?: string };
      quarantined.push({ component: c, reason: r.reason ?? 'quarantined' });
      console.log(`         ✖ QUARANTINED ${c} — ${r.reason ?? 'see REFUSAL.md'} (from the previous run's receipt)`);
    }
  }
  const runner = skip('capture') ? '' : computedRunnerEntry(root);
  for (const [i, comp] of skip('capture') ? [] : sweeps.entries()) {
    stage(1, TOTAL, 'capture', comp === null
      ? `${state.captureComponents.length} component(s) in ONE sweep — real browser, full longhand enumeration, double-run byte-identity`
      : `${comp} (${i + 1}/${sweeps.length}) — NARROWED run: this component's artifacts will not match a whole-library sweep's`);
    const { status: code, stderr: runnerErr } = runChild(runner, [
      '--harness', abs(manifest.capture.harness),
      '--config', captureConfigPath,
      ...(comp === null ? [] : ['--component', comp]),
      '--out', abs(manifest.captureOut),
      '--root', root,
    ], manifest.capture.env ?? {});
    // A quarantine is per-component and scoped: the runner writes refusal.json
    // + REFUSAL.md and NO contract, and exits non-zero. Anything else non-zero
    // is an engine fault and stops the run.
    for (const c of comp === null ? state.captureComponents : [comp]) {
      const refusal = path.join(abs(manifest.captureOut), c.toLowerCase(), 'refusal.json');
      if (!existsSync(refusal)) continue;
      const r = JSON.parse(readFileSync(refusal, 'utf8')) as { reason?: string };
      quarantined.push({ component: c, reason: r.reason ?? 'quarantined' });
      console.log(`         ✖ QUARANTINED ${c} — ${r.reason ?? 'see REFUSAL.md'}; no contract for it, the rest continue`);
    }
    if (code !== 0 && quarantined.length === 0) {
      // A NAMED refusal out of the runner (loadConfig, the gate, the draft
      // marker) is the runner doing its job — reprint it as what it is. Only
      // an exit with no quarantine AND no named refusal is an engine fault.
      const refusalLines = runnerErr.split('\n').filter((l) => l.includes('REFUSED'));
      if (refusalLines.length > 0) {
        console.error(`\n✘ capture REFUSED (exit ${code}) — the runner named its refusal; this is NOT an engine fault:`);
        for (const l of refusalLines) console.error(`  ${l.trim()}`);
        console.error('  Fix the named input, then re-run: ds-contracts onboard --continue');
        console.error('  Nothing was promoted, bundled or published.');
        return 1;
      }
      throw new Error(`capture failed (exit ${code}) with no per-component quarantine — that is an engine fault, so the run stops here`);
    }
  }
  const captured = state.captureComponents.filter((c) => !quarantined.some((q) => q.component === c));

  // A quarantined component produced NO contract, on purpose. It drops out of
  // the promoted set (and so out of the minted tree and the bundle) — that IS
  // the library that ships. Anything else missing was never captured, and a
  // promotion over an accidental subset is not this library's minted tree.
  const quarantinedDirs = new Set(quarantined.map((q) => q.component.toLowerCase()));
  const promoteComponents = manifest.components.filter((d) => !quarantinedDirs.has(d));
  const stillMissing = promoteComponents.filter((d) => !existsSync(path.join(abs(manifest.captureOut), d, 'enriched.extension.json')));
  if (stillMissing.length > 0) {
    console.error(`\n✘ promote REFUSED — the manifest declares component(s) with no capture artifacts and no quarantine: ${stillMissing.join(', ')}`);
    console.error("  A promotion over an accidental subset is not this library's minted tree, so none is written.");
    console.error(`  Capture them, or narrow "components" in ${state.manifest}.`);
    return 1;
  }

  // ---- 2 · PROMOTE ----
  if (skip('promote')) stage(2, TOTAL, 'promote', `SKIPPED (--from ${fromArg}) — reusing the promoted contracts in ${manifest.exampleDir}/contracts`);
  else stage(2, TOTAL, 'promote', `${promoteComponents.length} contract(s) → ${manifest.exampleDir}/contracts (source-alias pass + statePreviews probe)`
    + (quarantined.length > 0 ? ` — ${quarantined.length} quarantined component(s) excluded BY NAME` : ''));
  const promoted = skip('promote')
    ? { promoted: promoteComponents, promotedAssets: [], aliased: 0, literalKept: 0, receipts: [], statePreviewsOn: [], stateRefusals: [] }
    : promote(root, { ...manifest, components: promoteComponents }, (l) => console.log(`         ${l}`));

  // ---- 3 · EMIT ----
  const tokenArg = [manifest.dtcg, manifest.mintedOut].map((p) => abs(p)).join(',');
  if (skip('emit')) {
    stage(3, TOTAL, 'emit', `SKIPPED (--from ${fromArg})`);
  } else {
    stage(3, TOTAL, 'emit', `Figma sync scripts → ${manifest.emit.out}`);
    const emitCode = await figmaCommand([
      path.join(abs(manifest.exampleDir), 'contracts'),
      '--out', abs(manifest.emit.out),
      '--tokens', tokenArg,
      ...(manifest.emit.icons ? ['--icons', abs(manifest.emit.icons)] : []),
    ]);
    if (emitCode !== 0) return emitCode;
  }

  // ---- 4 · BUNDLE ----
  if (skip('bundle')) {
    stage(4, TOTAL, 'bundle', `SKIPPED (--from ${fromArg})`);
  } else {
    stage(4, TOTAL, 'bundle', `${manifest.bundle.out} — contracts + tokenSet + icon SVGs in ONE JSON`);
    const bundleCode = await figmaCommand([
      'bundle',
      path.join(abs(manifest.exampleDir), 'contracts'),
      '--tokens', tokenArg,
      ...(manifest.bundle.modes?.length ? ['--modes', manifest.bundle.modes.map((p) => abs(p)).join(',')] : []),
      '--name', manifest.bundle.name,
      ...(manifest.emit.icons ? ['--icons', abs(manifest.emit.icons)] : []),
      '--out', abs(manifest.bundle.out),
    ]);
    if (bundleCode !== 0) return bundleCode;
  }

  // ---- 5 · PUBLISH ----
  let published = false;
  if (key) {
    stage(5, TOTAL, 'publish', dryRun ? 'DRY RUN — nothing leaves this machine' : 'standing channel — the designer clicks "Check for updates"');
    const pubCode = await figmaCommand([
      'publish', abs(manifest.bundle.out),
      '--channel-key', key,
      ...(flagString(parsed, 'bridge') ? ['--bridge', flagString(parsed, 'bridge')!] : []),
      ...(dryRun ? ['--dry-run'] : []),
    ]);
    if (pubCode !== 0) return pubCode;
    published = true;
  } else {
    stage(5, TOTAL, 'publish', 'SKIPPED — no channel key');
  }

  // ---- SUMMARY ----
  console.log('\n── onboard summary ──────────────────────────────────────────');
  console.log(`  library        ${state.library} (${state.adopted ? 'adopted' : 'onboarded'} from ${state.target})`);
  console.log(`  captured       ${captured.length} component(s): ${captured.join(', ') || '(none — all reused)'}`);
  console.log(`  promoted       ${promoted.promoted.length} contract(s) → ${manifest.exampleDir}/contracts`);
  console.log(`  minted         ${manifest.mintedOut} — ${promoted.aliased} source-aliased, ${promoted.literalKept} literal, ${promoted.receipts.length} named refusal(s)`);
  console.log(`  state previews ${promoted.statePreviewsOn.length} accepted by the referee, ${promoted.stateRefusals.length} REFUSED BY NAME`);
  for (const r of promoted.stateRefusals) console.log(`                 - ${r}`);
  console.log(`  bundle         ${manifest.bundle.out}`);
  if (quarantined.length > 0) {
    console.log(`  QUARANTINED    ${quarantined.length} component(s) shipped NO CONTRACT:`);
    for (const q of quarantined) console.log(`                 - ${q.component}: ${q.reason} (REFUSAL.md + refusal.json in ${manifest.captureOut}/${q.component.toLowerCase()}/)`);
  }
  if (published) {
    console.log(dryRun
      ? '  published      DRY RUN — the request was composed and NOT sent'
      : '  published      to the standing channel. The designer clicks "Check for updates" in the plugin — no JSON on a clipboard.');
  } else {
    console.log('  published      no. Mint a channel once with `ds-contracts figma claim-channel`, then re-run with --channel-key <write key>.');
  }
  // THE NEXT STEP, spelled runnable (walked defect: generate over these
  // outputs fails with unresolved {imported.*} refs unless --tokens carries
  // BOTH the base DTCG file and the minted tree — a directory holding both
  // works too — and no output said so).
  const contractsDir = path.join(abs(manifest.exampleDir), 'contracts');
  console.log('  next           generate code from the promoted contracts (--tokens must carry the base AND minted trees, or every {imported.*} ref is unresolved):');
  console.log(`                 ds-contracts generate ${displayPath(contractsDir)} --out ${displayPath(path.join(abs(manifest.exampleDir), 'generated'))} --tokens ${displayPath(abs(manifest.dtcg))},${displayPath(abs(manifest.mintedOut))}${manifest.emit.icons ? ` --icons ${displayPath(abs(manifest.emit.icons))}` : ''}`);
  console.log('─────────────────────────────────────────────────────────────');
  // A quarantine is a defect, not a waiver — the same posture the capture
  // runner takes. Everything else finished, and the exit status says so.
  return quarantined.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------

export async function onboardCommand(argv: string[]): Promise<number> {
  if (argv.includes('--continue')) return phaseTwo(argv);
  return phaseOne(argv);
}

// ---------------------------------------------------------------------------
// `ds-contracts promote` — the step that was never a verb
// ---------------------------------------------------------------------------

export function promoteCommand(argv: string[]): number {
  const parsed = parseFlags(argv, { value: ['config', 'root'] });
  const configArg = flagString(parsed, 'config') ?? parsed.positionals[0];
  if (!configArg) {
    throw new CliUsageError(
      'promote needs --config <ds-library.json> (the library manifest — see examples/carbon/ds-library.json)',
    );
  }
  const abs = path.resolve(configArg);
  if (!existsSync(abs)) throw new CliUsageError(`promote config not found: ${configArg}`);
  const cfg = parsePromoteConfig(readJson(abs), configArg);
  const root = flagString(parsed, 'root') ? path.resolve(flagString(parsed, 'root')!) : rootForManifest(abs, cfg.exampleDir);
  if (!existsSync(path.resolve(root, cfg.dtcg))) {
    throw new CliUsageError(
      `the base DTCG token file the promote config names does not exist: ${cfg.dtcg} (resolved against ${root}).\n` +
        '  `ds-contracts onboard` writes a SKELETON there when the target ships no token file — author your library\'s tokens in it first.\n' +
        '  FLAT-NAME RULE: each leaf key = the CSS custom property minus "--" (--btn-bg → top-level "btn-bg"); a nested tree verifies 0 facts.',
    );
  }
  promote(root, cfg);
  return 0;
}

// Directory listing helper kept beside the command for the adopt path's error
// message (a workspace with no manifest is a common first mistake).
export const manifestCandidates = (dir: string): string[] =>
  isDir(dir) ? readdirSync(dir).filter((f) => f === MANIFEST_FILENAME || f.endsWith('.contract.json')).sort() : [];
