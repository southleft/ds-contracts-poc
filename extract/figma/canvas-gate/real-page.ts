/**
 * REAL SIDE — the actual @shopify/polaris@13.9.5 npm package, mounted in the
 * pinned Chromium via the extract/computed mount recipe (AppProvider + en
 * locale + styles.css, esbuild file:// bundle — see extract/computed/
 * capture.ts buildHarnessPage and configs/polaris.json). Differences from
 * the capture harness, both in service of pixel comparison:
 *   · stages are TRANSPARENT and hug their content (width: max-content) so
 *     the screenshot's content-box crop matches the canvas side's;
 *   · transitions are disabled and infinite animations are pinned at t=0
 *     (the visual-parity render.ts / capture.ts pinInfiniteAnimations
 *     discipline) so hover/active/focus paints are captured settled.
 *
 * One mount per gate cell: axis props from the cell's subst map, contract
 * prop defaults, and the per-component mount table in run.ts (children text
 * mirroring the canvas's drawn characters; Checkbox/RadioButton labelHidden
 * because the contract anatomy carries no label part — named in README).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface MountSpec {
  /** `${component}#${cellIndex}` — the [data-cell] key. */
  key: string;
  /** Polaris named export. */
  component: string;
  props: Record<string, unknown>;
  /** Function props stubbed to () => {} in-page. */
  callbacks: string[];
  /** children text ('' = self-closing mount). */
  children: string;
  /** Page chunk (?chunk=N) — a chunk's mounts must render below Chromium's
   *  16384px screenshot-capture ceiling. */
  chunk: number;
}

const MOUNT_IMPORTS = [
  "import { AppProvider } from '@shopify/polaris';",
  "import en from '@shopify/polaris/locales/en.json';",
  "import '@shopify/polaris/build/esm/styles.css';",
];

export function buildRealPage(harness: string, mounts: MountSpec[]): string {
  const importNames = [...new Set(mounts.map((m) => m.component))].sort();
  const specs = mounts.map((m) => ({
    key: m.key,
    component: m.component,
    props: m.props,
    callbacks: m.callbacks,
    text: m.children,
    chunk: m.chunk,
  }));
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${importNames.join(', ')} } from '@shopify/polaris';
${MOUNT_IMPORTS.slice(1).join('\n')}
import { AppProvider } from '@shopify/polaris';

const COMPONENTS = { ${importNames.join(', ')} };
const ALL_SPECS = ${JSON.stringify(specs)};
const CHUNK = Number(new URLSearchParams(window.location.search).get('chunk') || '0');
const SPECS = ALL_SPECS.filter((s) => s.chunk === CHUNK);
const stage = { display: 'flex', alignItems: 'flex-start', width: 'max-content', background: 'transparent', margin: 12, padding: 8 };

function App() {
  return (
    <AppProvider i18n={en}>
      {SPECS.map((s) => {
        const C = COMPONENTS[s.component];
        const props = { ...s.props };
        for (const cb of s.callbacks) props[cb] = () => {};
        return (
          <React.Fragment key={s.key}>
            <button data-sentinel={s.key} style={{ width: 8, height: 8, padding: 0, border: 0, margin: 2, background: '#eee' }} aria-label="sentinel" />
            <div data-cell={s.key} style={stage}>{s.text === '' ? <C {...props} /> : <C {...props}>{s.text}</C>}</div>
          </React.Fragment>
        );
      })}
    </AppProvider>
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
  const pageDir = path.join(harness, 'canvas-gate-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(harness, 'node_modules', '.bin', 'esbuild'),
    [
      'canvas-gate-page/entry.jsx',
      '--bundle',
      '--outfile=canvas-gate-page/bundle.js',
      '--jsx=automatic',
      '--loader:.json=json',
      '--loader:.svg=dataurl',
      '--loader:.png=dataurl',
      '--log-level=error',
    ],
    { cwd: harness },
  );
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
<style>
  html { color-scheme: light; }
  body { margin: 0; background: #ffffff !important; }
  *, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
</style>
</head><body><div id="root"></div><script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}
