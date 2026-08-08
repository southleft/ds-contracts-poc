#!/usr/bin/env node
/**
 * RECON-ONLY: rehydrate api-extractor rollups into source-shaped modules.
 *
 * WHY THIS EXISTS. `@fluentui/react-components@9.74.5` and its 60+ sub-packages
 * publish `lib/*.js` + a single api-extractor **rollup** `dist/index.d.ts` per
 * package. There is not one `.tsx` and not one non-`.d.ts` `.ts` file in the
 * installed tree (measured: 0 and 0). The react-tsx adapter's file walker skips
 * `*.d.ts` by name (`SKIP_FILE` in extract/adapters/react-tsx.ts), so pointing
 * it at the real library yields `No components found` — with NO skip ledger,
 * because no candidate file is ever opened.
 *
 * WHAT THIS DOES. Two purely MECHANICAL rewrites per rollup, no hand edits:
 *   1. `export declare const X: T;`  →  `export const X = React.forwardRef(() => null) as T;`
 *      (this restores the exact idiom Fluent's own source carries —
 *      `) as ForwardRefComponent<XProps>;` — which the gauntlet measured in 29
 *      component files, and which `findComponents` already reads through)
 *   2. `declare ` → `` everywhere else (ambient → concrete declarations)
 * Type declarations — the props types, their members, their JSDoc — are copied
 * BYTE-FOR-BYTE. Nothing about the API surface is invented here.
 *
 * WHAT IT IS NOT. It is not a capture input and not a claim that Fluent
 * extracts today. The numbers it produces are a SIMULATION of what the adapter
 * would read if it could see ambient declarations, in the same spirit as the
 * enterprise gauntlet's "measured what-if" (extract/pilots/ENTERPRISE-GAUNTLET.md
 * §3). The engine-side alternative is named in examples/fluent/RECON.md §5 (H1).
 *
 * Output: <sandbox>/types-src/<Package>.tsx — git-ignored with the sandbox.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const SANDBOX = path.resolve(process.argv[2] ?? 'examples/fluent/.fluent-sandbox');
const OUT = path.join(SANDBOX, 'types-src');

/** The 12 recon components and the sub-package whose rollup declares them. */
const PACKAGES = [
  'react-button',
  'react-badge',
  'react-avatar',
  'react-card',
  'react-message-bar',
  'react-checkbox',
  'react-switch',
  'react-input',
  'react-tabs',
  'react-tooltip',
  'react-dialog',
  'react-spinner',
];

mkdirSync(OUT, { recursive: true });

const rehydrate = (src) =>
  src
    // 1. ambient const with a component-shaped annotation → a real initializer
    //    carrying the SAME type as an `as` cast (Fluent's own source idiom).
    .replace(
      /^export declare const ([A-Za-z0-9_]+): ([^;]+);$/gm,
      (_m, name, type) => `export const ${name} = React.forwardRef(() => null) as ${type};`,
    )
    // 2. the remaining ambient declarations become concrete ones.
    .replace(/^export declare /gm, 'export ')
    .replace(/^declare /gm, '');

let total = 0;
const rows = [];
for (const pkg of PACKAGES) {
  const rollup = path.join(SANDBOX, 'node_modules', '@fluentui', pkg, 'dist', 'index.d.ts');
  if (!existsSync(rollup)) throw new Error(`REFUSED: rollup not found — ${rollup}`);
  const src = readFileSync(rollup, 'utf8');
  const name = pkg.replace(/(^|-)([a-z])/g, (_m, _s, c) => c.toUpperCase());
  const out = path.join(OUT, `${name}.tsx`);
  const body = `import * as React from 'react';\n\n${rehydrate(src)}\n`;
  writeFileSync(out, body);
  rows.push([name, src.split('\n').length, (body.match(/^export const [A-Z]/gm) ?? []).length]);
  total++;
}
console.log(`rehydrated ${total} rollups → ${path.relative(process.cwd(), OUT)}`);
for (const [name, lines, comps] of rows) console.log(`  ${name.padEnd(16)} ${String(lines).padStart(5)} lines  ${comps} PascalCase const exports`);
