/**
 * Flowbite hop-2 pin — the JSON a team pastes must be the current engine.
 *
 *   npx tsx scripts/flowbite-bundle-fresh-check.ts
 *
 * Two fresh builds are byte-identical, the committed tailwind.bundle.json
 * matches them, the eight committed `*.figma.js` scripts match a fresh
 * emit, and the P0 functional facts (Alert dismissable+onDismiss,
 * ToggleSwitch role=switch+onToggle, Button Disabled opacity unbind)
 * are in those artifacts — not only in the source contracts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const COMMITTED = path.join(ROOT, 'examples', 'tailwind', 'figma', 'tailwind.bundle.json');
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

const dir = mkdtempSync(path.join(tmpdir(), 'flowbite-bundle-'));
const aPath = path.join(dir, 'a.json');
const bPath = path.join(dir, 'b.json');
const args = (out: string) => [
  'packages/cli/src/cli.ts',
  'figma',
  'bundle',
  'examples/tailwind/contracts',
  '--tokens',
  'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json',
  '--name',
  'Tailwind',
  '--icons',
  'examples/tailwind/assets/icons',
  '--out',
  out,
];

try {
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  execFileSync(tsx, args(aPath), { cwd: ROOT, stdio: 'pipe' });
  execFileSync(tsx, args(bPath), { cwd: ROOT, stdio: 'pipe' });
  const a = readFileSync(aPath, 'utf8');
  const b = readFileSync(bPath, 'utf8');
  const committed = readFileSync(COMMITTED, 'utf8');
  check('two fresh Flowbite bundles are byte-identical', a === b);
  check('committed tailwind.bundle.json matches a fresh build', a === committed);

  const bundle = JSON.parse(a) as {
    contracts: Array<{
      id?: string;
      semantics?: { role?: string };
      props?: Array<{ name?: string; bindings?: { code?: { prop?: string } } }>;
      events?: Array<{ name?: string; bindings?: { code?: { prop?: string } } }>;
    }>;
  };
  const alert = bundle.contracts.find((c) => c.id === 'flowbite.alert');
  const toggle = bundle.contracts.find((c) => c.id === 'flowbite.toggleswitch');
  const alertProp = (name: string) =>
    alert?.props?.some((p) => p.name === name || p.bindings?.code?.prop === name) ?? false;
  const alertEvent = (name: string) =>
    alert?.events?.some((e) => e.name === name || e.bindings?.code?.prop === name) ?? false;
  const toggleEvent = (name: string) =>
    toggle?.events?.some((e) => e.name === name || e.bindings?.code?.prop === name) ?? false;
  check('bundle Alert carries dismissable as a boolean prop, not onDismiss', alertProp('dismissable') && !alertProp('onDismiss'));
  check('bundle Alert carries onDismiss as an event', alertEvent('onDismiss'));
  check('bundle ToggleSwitch is role=switch', toggle?.semantics?.role === 'switch');
  check('bundle ToggleSwitch carries onToggle as an event', toggleEvent('onToggle'));
  check('bundle has eight Flowbite contracts', bundle.contracts.length === 8);

  const scriptsDir = path.join(dir, 'scripts');
  execFileSync(tsx, [
    'packages/cli/src/cli.ts',
    'figma',
    'examples/tailwind/contracts',
    '--out',
    scriptsDir,
    '--tokens',
    'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json',
    '--icons',
    'examples/tailwind/assets/icons',
  ], { cwd: ROOT, stdio: 'pipe' });
  const stems = [
    'alert.figma.js',
    'badge.figma.js',
    'button.figma.js',
    'card.figma.js',
    'helper-text.figma.js',
    'kbd.figma.js',
    'label.figma.js',
    'toggle-switch.figma.js',
  ];
  const stale = stems.filter((name) => {
    const fresh = readFileSync(path.join(scriptsDir, name), 'utf8');
    const committed = readFileSync(path.join(ROOT, 'examples', 'tailwind', 'figma', name), 'utf8');
    return fresh !== committed;
  });
  check(`committed genesis scripts match a fresh emit (${stems.length} stems)`, stale.length === 0);
  const buttonSrc = readFileSync(path.join(ROOT, 'examples', 'tailwind', 'figma', 'button.figma.js'), 'utf8');
  const batchSrc = readFileSync(path.join(ROOT, 'examples', 'tailwind', 'figma', 'GENESIS-BATCH.figma.js'), 'utf8');
  check("committed button.figma.js unbinds stale OPACITY before writing the literal", buttonSrc.includes("setBoundVariable('opacity', null)"));
  check("GENESIS-BATCH.figma.js carries the same OPACITY unbind", batchSrc.includes("setBoundVariable('opacity', null)"));
  const toggleSrc = readFileSync(path.join(ROOT, 'examples', 'tailwind', 'figma', 'toggle-switch.figma.js'), 'utf8');
  check('committed toggle-switch.figma.js draws root counter CENTER', toggleSrc.includes('"counter": "CENTER"'));
  check('committed toggle-switch.figma.js stamps semantics.role=switch', toggleSrc.includes('"role": "switch"'));
  const helperSrc = readFileSync(path.join(ROOT, 'examples', 'tailwind', 'figma', 'helper-text.figma.js'), 'utf8');
  check(
    'HelperText genesis does not emit silent root margins (FC-EMIT-ROOT-MARGIN-SILENT)',
    !helperSrc.includes('"margins":'),
  );
  check(
    'ToggleSwitch genesis still wraps the label margin box (child residual, not root)',
    toggleSrc.includes('"margins":'),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✘ flowbite-bundle-fresh: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ flowbite-bundle-fresh: hop-2 bundle and genesis scripts are current and carry the P0 events');
