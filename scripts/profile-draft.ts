/**
 * THE INIT STEP (notes/v1-product-plan.md, P1; reviewer, 2026-11-14): a first profile for a new system, drafted from the
 * library itself and labeled "drafted". It builds and serves the library's own Storybook (storybook-local.ts), runs the
 * unchanged reader with --grammar-only and no profile, and copies each title's stories and the matrix axes the reader
 * inferred into a profile that passes the reader's schema. A title whose matrix is refused, or whose name another title
 * already took, is left out and listed by name on the terminal only. The draft never counts anywhere: the scored runner
 * and scripts/reading.ts refuse it by name (profile-drafted-not-reviewed) until a person reviews it and changes its
 * provenance. No model call; the same grammar reading and package give the same draft.
 *
 *   npx tsx scripts/profile-draft.ts --dir <library> --run <new folder> --out <profile.json>
 *
 * Never run on a system with a held-out list (AGENTS.md rule 5): it reads every title.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocalStorybook, serveInChild, STORYBOOK_PORT } from './storybook-local.js';
import { SystemProfile } from './storybook-reader.js';

interface GrammarReading { index: { sha256: string }; stories: Array<{ id: string; title: string }>;
  components: Array<{ title: string; matrix: { status: 'ok'; axes: string[] } | { status: 'refused'; reason: string } }> }

/** A title's last segment as a component name: its words, each capitalized, joined ("Forms/date picker" → "DatePicker"). */
export const componentName = (title: string): string =>
  (title.split('/').pop() ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');

export function draftProfile(pkg: { name?: unknown; version?: unknown }, grammar: GrammarReading): { profile: SystemProfile; refused: Array<{ title: string; reason: string }> } {
  if (typeof pkg.name !== 'string' || !pkg.name || typeof pkg.version !== 'string') throw Error('profile-draft-package-unnamed: package.json needs a name and a version');
  const refused: Array<{ title: string; reason: string }> = [], taken = new Map<string, string>(), components: SystemProfile['components'] = [];
  for (const c of grammar.components) {
    const name = componentName(c.title);
    if (c.matrix.status !== 'ok') { refused.push({ title: c.title, reason: c.matrix.reason }); continue; }
    if (!name) { refused.push({ title: c.title, reason: 'title-gives-no-name' }); continue; }
    if (taken.has(name)) { refused.push({ title: c.title, reason: `name-taken:${name} (by ${taken.get(name)})` }); continue; }
    const stories = grammar.stories.filter((s) => s.title === c.title).map((s) => s.id);
    if (!stories.length) { refused.push({ title: c.title, reason: 'no-story' }); continue; }
    taken.set(name, c.title);
    components.push({ name, stories, axes: c.matrix.axes });
  }
  const profile = SystemProfile.parse({
    provenance: `drafted by ds-contracts init from Storybook index ${grammar.index.sha256.slice(0, 12)}; not reviewed`,
    system: pkg.name, version: '0.0.0',
    pins: { package: { name: pkg.name, version: pkg.version }, storybook: `http://localhost:${STORYBOOK_PORT}/ (the library's own Storybook, built by scripts/storybook-local.ts)`, figma: { fileKey: '', version: '' } },
    setup: { manifest: '', captureConfig: '' },
    tuning: { why: 'drafted: no tuning list', code: [], figma: [] },
    placementLeftOut: [], components, conventions: [], excluded: [],
  });
  return { profile, refused };
}

if (process.argv[1] && process.argv[1].endsWith('profile-draft.ts')) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1] : undefined; };
  const [dir, run, out] = [flag('--dir'), flag('--run'), flag('--out')];
  const refuse = (why: string): never => { console.error(`✖ ${why}`); process.exit(2); };
  if (!dir || !run || !out || argv.length !== 6) refuse('usage: npx tsx scripts/profile-draft.ts --dir <library> --run <new folder> --out <profile.json>');
  if (existsSync(out!)) refuse(`profile-draft-out-exists: ${out}`);
  if (existsSync(run!)) refuse(`profile-draft-run-exists: ${run}`);
  const pkgFile = path.join(path.resolve(dir!), 'package.json');
  if (!existsSync(pkgFile)) refuse(`profile-draft-package-missing: ${pkgFile}`);
  let stop = () => {};
  process.on('exit', () => stop());
  try {
    mkdirSync(run!, { recursive: true });
    const built = buildLocalStorybook(dir!, path.join(run!, 'storybook-static')), served = await serveInChild(built.static);
    stop = served.stop;
    const reader = fileURLToPath(new URL('./storybook-reader.ts', import.meta.url));
    const r = spawnSync(process.execPath, ['--import', 'tsx', reader, '--storybook', served.url, '--out', path.join(run!, 'reader'), '--grammar-only'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    writeFileSync(path.join(run!, 'reader.log'), `${r.stdout}${r.stderr}`);
    if (r.status !== 0) refuse(`profile-draft-reader-failed: exit ${r.status} (log ${path.join(run!, 'reader.log')})`);
    const { profile, refused } = draftProfile(JSON.parse(readFileSync(pkgFile, 'utf8')), JSON.parse(readFileSync(path.join(run!, 'reader', 'grammar.json'), 'utf8')));
    writeFileSync(out!, JSON.stringify(profile, null, 2) + '\n');
    console.log(`drafted ${profile.components.length} component(s) → ${out} (labeled "drafted": it counts nowhere until a person reviews it)`);
    for (const t of refused) console.log(`  not drafted: ${t.title} (${t.reason})`);
  } catch (e) { refuse(e instanceof Error ? e.message : String(e)); }
}
