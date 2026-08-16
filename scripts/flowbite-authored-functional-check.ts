/**
 * Authored-contract functional gate — ToggleSwitch clicks, Alert dismisses.
 *
 * Proves the shipping emit-react path by EXECUTION, not grep:
 *   1. emitReact on the committed Flowbite contracts
 *   2. esbuild + react-dom/server for controlled markup
 *   3. playwright-core + system Chrome: real click flips aria-checked;
 *      dismiss button fires and unmounts
 *
 *   npx tsx scripts/flowbite-authored-functional-check.ts
 *   npm run functional:flowbite
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact } from '../core/emit-react.js';
import { tokenInventoryFromJson } from '../core/tokens.js';

const ROOT = process.cwd();
const WORK = path.join(ROOT, 'evals', '.scratch-flowbite-functional');
const CONTRACTS_DIR = path.join(ROOT, 'examples', 'tailwind', 'contracts');
const ICONS_DIR = path.join(ROOT, 'examples', 'tailwind', 'assets', 'icons');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) failures.push(`${name}: ${detail}`);
  console.log(`  ${ok ? '✔' : '✘'} ${name} — ${detail}`);
};

const contracts = new Map<string, Contract>();
for (const f of readdirSync(CONTRACTS_DIR).filter((n) => n.endsWith('.contract.json'))) {
  const c = ContractSchema.parse(readJson(path.join(CONTRACTS_DIR, f)));
  contracts.set(c.id, c);
}
const icons = new Map<string, string>(
  readdirSync(ICONS_DIR)
    .filter((n) => n.endsWith('.svg'))
    .map((n) => [n.replace(/\.svg$/, ''), readFileSync(path.join(ICONS_DIR, n), 'utf8').trim()]),
);
const tokens = tokenInventoryFromJson([
  readJson(path.join(ROOT, 'examples', 'tailwind', 'tokens', 'tailwind.dtcg.json')),
  readJson(path.join(ROOT, 'examples', 'tailwind', 'tokens', 'tailwind-minted.dtcg.json')),
]);
const ctx = { tokens, icons, contracts };

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const toggle = contracts.get('flowbite.toggleswitch')!;
const alert = contracts.get('flowbite.alert')!;
const toggleOut = emitReact(toggle, ctx);
const alertOut = emitReact(alert, ctx);

writeFileSync(path.join(WORK, 'ToggleSwitch.tsx'), toggleOut.tsx);
writeFileSync(path.join(WORK, 'ToggleSwitch.module.css'), toggleOut.css);
writeFileSync(path.join(WORK, 'Alert.tsx'), alertOut.tsx);
writeFileSync(path.join(WORK, 'Alert.module.css'), alertOut.css);

check(
  'toggle-source',
  toggleOut.tsx.includes('useState') &&
    toggleOut.tsx.includes('onClick={handleToggle}') &&
    toggleOut.tsx.includes("aria-checked={checked === 'checked'}") &&
    toggleOut.tsx.includes('role="switch"') &&
    toggleOut.tsx.includes('type="button"'),
  'ToggleSwitch emits uncontrolled state, click, aria-checked, role=switch',
);
check(
  'alert-source',
  alertOut.tsx.includes('dismissable') &&
    alertOut.tsx.includes('onDismiss') &&
    alertOut.tsx.includes('onClick={handleDismiss}') &&
    alertOut.tsx.includes('aria-label="Dismiss"') &&
    !alertOut.tsx.includes('onDismiss?: boolean'),
  'Alert emits dismissable boolean + onDismiss callback on a labeled button',
);

writeFileSync(
  path.join(WORK, 'ssr-entry.tsx'),
  [
    "import { createElement } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    "import { ToggleSwitch } from './ToggleSwitch';",
    "import { Alert } from './Alert';",
    "export const off = renderToStaticMarkup(createElement(ToggleSwitch, { checked: 'unchecked', label: 'Toggle' }));",
    "export const on = renderToStaticMarkup(createElement(ToggleSwitch, { checked: 'checked', label: 'Toggle' }));",
    "export const hidden = renderToStaticMarkup(createElement(Alert, { dismissable: false }, 'Alert message'));",
    "export const shown = renderToStaticMarkup(createElement(Alert, { dismissable: true }, 'Alert message'));",
  ].join('\n'),
);

await build({
  entryPoints: [path.join(WORK, 'ssr-entry.tsx')],
  outfile: path.join(WORK, 'ssr-entry.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  logLevel: 'silent',
  loader: { '.css': 'empty' },
  external: ['react', 'react-dom'],
});

const ssr = (await import(pathToFileURL(path.join(WORK, 'ssr-entry.cjs')).href)) as {
  off: string;
  on: string;
  hidden: string;
  shown: string;
};

check('toggle-ssr-off', /aria-checked="false"/.test(ssr.off) && /role="switch"/.test(ssr.off), 'controlled unchecked renders aria-checked=false');
check('toggle-ssr-on', /aria-checked="true"/.test(ssr.on), 'controlled checked renders aria-checked=true');
check('alert-ssr-hidden', !ssr.hidden.includes('aria-label="Dismiss"'), 'dismissable=false hides the dismiss control');
check('alert-ssr-shown', ssr.shown.includes('aria-label="Dismiss"') && ssr.shown.includes('<button'), 'dismissable=true shows a dismiss button');

writeFileSync(
  path.join(WORK, 'browser-entry.tsx'),
  [
    "import { createElement, useState } from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { ToggleSwitch } from './ToggleSwitch';",
    "import { Alert } from './Alert';",
    'function App() {',
    '  const [gone, setGone] = useState(false);',
    '  return createElement(',
    "    'div',",
    '    null,',
    "    createElement(ToggleSwitch, { label: 'Toggle' }),",
    '    gone ? null : createElement(Alert, { dismissable: true, onDismiss: () => setGone(true) }, "Alert message"),',
    '  );',
    '}',
    "createRoot(document.getElementById('root')!).render(createElement(App));",
  ].join('\n'),
);

await build({
  entryPoints: [path.join(WORK, 'browser-entry.tsx')],
  outfile: path.join(WORK, 'browser.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  logLevel: 'silent',
  loader: { '.css': 'empty' },
});

const bundle = readFileSync(path.join(WORK, 'browser.js'), 'utf8');
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
} catch {
  try {
    browser = await chromium.launch();
  } catch (err) {
    check('browser', false, `could not launch Chrome/Chromium: ${String(err)}`);
    rmSync(WORK, { recursive: true, force: true });
    if (failures.length > 0) {
      console.error(`\n${failures.length} functional pin(s) failed:\n  - ${failures.join('\n  - ')}`);
      process.exit(1);
    }
    process.exit(0);
  }
}

const page = await (await browser.newContext()).newPage();
await page.setContent(`<!doctype html><html><body><div id="root"></div><script>${bundle}</script></body></html>`, {
  waitUntil: 'domcontentloaded',
});
const switchBtn = page.locator('button[role="switch"]');
await switchBtn.waitFor({ state: 'visible', timeout: 5000 });
const before = await switchBtn.getAttribute('aria-checked');
await switchBtn.click();
const after = await switchBtn.getAttribute('aria-checked');
await switchBtn.click();
const back = await switchBtn.getAttribute('aria-checked');
check('toggle-click', before === 'false' && after === 'true' && back === 'false', `click flips ${before} → ${after} → ${back}`);

const dismiss = page.locator('button[aria-label="Dismiss"]');
check('alert-dismiss-present', await dismiss.count() === 1, 'dismiss button is in the document');
await dismiss.click();
check('alert-dismiss-click', (await dismiss.count()) === 0, 'onDismiss unmounts the alert');

await browser.close();
rmSync(WORK, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n${failures.length} functional pin(s) failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nflowbite-authored-functional-check: ToggleSwitch clicks and Alert dismisses');
