/**
 * N-axis variant support verification — `node scripts/verify-naxis.mjs`.
 *
 * Copies the 4-axis fixture contract (evals/fixtures/four-axis.contract.json,
 * variant × size × emphasis × iconPosition = 36 combos) into a scratch copy
 * of the repo, runs the REAL generators, and asserts:
 *
 *   (a) the emitted figma-sync script for FourAxis names every variant with
 *       ALL FOUR axes ("Variant=…, Size=…, Emphasis=…, Icon Position=…")
 *       and emits the full cartesian product (36 variants)
 *   (b) the all-defaults combo is the FIRST variant (Figma's default variant
 *       is positional) and the grid maps rows=axis 0, cols=product(axes 1..n)
 *   (c) per-axis {prop} token substitutions resolved correctly in a
 *       non-default combo (danger/lg/semibold/end)
 *   (d) the generated component + stories typecheck
 *
 * Also guards the amend-path invariant: 2-axis component names must stay
 * byte-identical to the pre-N-axis spelling (Button "Variant=…, Size=…").
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCRATCH = path.join(ROOT, 'evals', '.scratch-naxis');

// node_modules may live in an ancestor (git worktrees resolve deps from the
// primary checkout via Node's upward walk) — mirror that lookup.
function findNodeModules(from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules');
    if (existsSync(path.join(candidate, '.bin', 'tsx'))) return candidate;
    if (path.dirname(dir) === dir) throw new Error('node_modules with tsx not found — run npm install');
  }
}
const NODE_MODULES = findNodeModules(ROOT);
const TSX = path.join(NODE_MODULES, '.bin', 'tsx');
const TSC = path.join(NODE_MODULES, '.bin', 'tsc');

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: SCRATCH, encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// --- Scratch setup ----------------------------------------------------------
rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });
for (const dir of ['contracts', 'tokens', 'scripts', 'src', 'assets']) {
  cpSync(path.join(ROOT, dir), path.join(SCRATCH, dir), { recursive: true });
}
for (const file of ['package.json', 'tsconfig.json']) {
  cpSync(path.join(ROOT, file), path.join(SCRATCH, file));
}
symlinkSync(NODE_MODULES, path.join(SCRATCH, 'node_modules'), 'dir');

// The fixture joins the contract set only inside the scratch copy.
cpSync(
  path.join(ROOT, 'evals', 'fixtures', 'four-axis.contract.json'),
  path.join(SCRATCH, 'contracts', 'four-axis.contract.json'),
);

console.log('N-axis verification (scratch: evals/.scratch-naxis)');

// --- Generators run on the real pipeline ------------------------------------
const gen = run(TSX, ['scripts/generate-components.ts']);
check('generate-components accepts a 4-enum-axis contract (refusal removed)', gen.status === 0, gen.out.trim().split('\n').slice(-8).join(' | '));

const figma = run(TSX, ['scripts/generate-figma.ts']);
check('generate-figma runs with the 4-axis contract', figma.status === 0, figma.out.trim().split('\n').slice(-8).join(' | '));

if (failures > 0) {
  console.error(`\n✘ ${failures} failure(s) — aborting before assertions.`);
  process.exit(1);
}

// --- (a) full cartesian product, all axes in every name ----------------------
const syncDir = path.join(SCRATCH, 'figma-sync');
const scriptFile = readdirSync(syncDir).find(
  (f) => /^\d+-fouraxis\.js$/.test(f),
);
check('per-component figma-sync script emitted for FourAxis', Boolean(scriptFile));
const script = readFileSync(path.join(syncDir, scriptFile), 'utf8');
const m = script.match(/const VARIANTS = (\[[\s\S]*?\n\]);/);
check('VARIANTS payload parseable', Boolean(m));
const variants = JSON.parse(m[1]);

check(`full cartesian product: 3×3×2×2 = 36 variants (got ${variants.length})`, variants.length === 36);
const AXES = ['Variant', 'Size', 'Emphasis', 'Icon Position'];
const allAxesNamed = variants.every((v) => {
  const segs = v.name.split(', ');
  return segs.length === 4 && segs.every((s, i) => s.startsWith(`${AXES[i]}=`));
});
check('every variant name carries all 4 axes in prop declaration order', allAxesNamed, variants.find((v) => v.name.split(', ').length !== 4)?.name);
check('all 36 names unique', new Set(variants.map((v) => v.name)).size === 36);

// --- (b) defaults-first ordering + grid shape --------------------------------
check(
  'FIRST variant is the all-defaults combo',
  variants[0].name === 'Variant=Primary, Size=Medium, Emphasis=Medium, Icon Position=Start',
  variants[0].name,
);
check('first variant sits at row 0, col 0', variants[0].row === 0 && variants[0].col === 0);
const rowsN = Math.max(...variants.map((v) => v.row)) + 1;
const colsN = Math.max(...variants.map((v) => v.col)) + 1;
check(`grid: rows = axis 0 values (3), got ${rowsN}`, rowsN === 3);
check(`grid: cols = product of axes 1..3 (3×2×2 = 12), got ${colsN}`, colsN === 12);
const cellKeys = new Set(variants.map((v) => `${v.row}:${v.col}`));
check('every (row, col) cell distinct and fully populated', cellKeys.size === 36);

// --- (c) per-axis token substitution in a non-default combo ------------------
const nonDefault = variants.find(
  (v) => v.name === 'Variant=Danger, Size=Large, Emphasis=Semibold, Icon Position=End',
);
check('non-default combo (danger/lg/semibold/end) present', Boolean(nonDefault));
const spec = nonDefault.spec;
check(
  'axis 1 subst: background-color → color/action/danger/background',
  spec.fill === 'color/action/danger/background',
  spec.fill,
);
check(
  'axis 2 subst: padding-inline → space/inset-x/lg',
  spec.bindings?.paddingLeft === 'space/inset-x/lg' && spec.bindings?.paddingRight === 'space/inset-x/lg',
  JSON.stringify(spec.bindings),
);
const labelNode = (spec.children ?? []).find((cIn) => cIn.name === 'label');
check(
  'axis 3 subst: font-weight {emphasis}=semibold → label fontStyle "Semi Bold"',
  labelNode?.fontStyle === 'Semi Bold',
  labelNode?.fontStyle,
);
const childNames = (spec.children ?? []).map((cIn) => cIn.name);
check(
  'axis 4 visibleWhen: iconPosition=end keeps iconEnd, drops iconStart',
  childNames.includes('iconEnd') && !childNames.includes('iconStart'),
  childNames.join(','),
);
const defaultChildren = (variants[0].spec.children ?? []).map((cIn) => cIn.name);
check(
  'default combo keeps iconStart, drops iconEnd',
  defaultChildren.includes('iconStart') && !defaultChildren.includes('iconEnd'),
  defaultChildren.join(','),
);

// --- amend-path safety: 2-axis names byte-identical to today's spelling ------
const buttonFile = readdirSync(syncDir).find((f) => /^\d+-button\.js$/.test(f));
const buttonVariants = JSON.parse(
  readFileSync(path.join(syncDir, buttonFile), 'utf8').match(/const VARIANTS = (\[[\s\S]*?\n\]);/)[1],
);
check(
  '2-axis Button names unchanged (amend reconciles by name)',
  buttonVariants[0].name === 'Variant=Primary, Size=Medium' && buttonVariants.length === 12,
  buttonVariants[0].name,
);

// --- (d) generated component + stories typecheck -----------------------------
const storiesPath = path.join(SCRATCH, 'src', 'components', 'FourAxis', 'FourAxis.stories.tsx');
const stories = readFileSync(storiesPath, 'utf8');
const matrix = stories.match(/gridTemplateColumns: 'repeat\((\d+), max-content\)'/);
check(`stories Matrix: ${matrix?.[1]} columns = product of axes 1..3 (12)`, matrix?.[1] === '12');
check(
  'stories Matrix cells carry all four axis props',
  /variant="danger" size="lg" emphasis="semibold" iconPosition="end"/.test(stories),
);
writeFileSync(
  path.join(SCRATCH, 'tsconfig.naxis.json'),
  JSON.stringify({ extends: './tsconfig.json', include: ['src'] }, null, 2),
);
const tsc = run(TSC, ['--noEmit', '-p', 'tsconfig.naxis.json']);
check('generated src/ (incl. FourAxis stories) typechecks', tsc.status === 0, tsc.out.trim().split('\n').slice(0, 6).join(' | '));

rmSync(SCRATCH, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n✘ N-axis verification: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\n✔ N-axis verification passed.');
