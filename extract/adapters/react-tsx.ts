/**
 * React/TypeScript adapter — reads REAL component source, not contracts.
 *
 * Generalized from parity/extract-code.ts, which assumed this repo's
 * conventions (src/components/<Name>/<Name>.tsx + <Name>Props). This
 * adapter drops those assumptions:
 *   · scans a root directory recursively for .tsx/.ts files
 *   · finds PascalCase exported components (function decls, arrow consts,
 *     forwardRef wrappers)
 *   · resolves the props type from: explicit <Name>Props naming, the
 *     component's first-parameter type reference, or an inline literal —
 *     with one-hop local type-alias resolution ('sm' | 'md' behind
 *     `type Size = …`), marked confidence:'inferred'
 *   · classifies members: string-literal unions → enum; boolean; string;
 *     number; ReactNode → node; on* function types → event
 *   · defaults from destructuring initializers and Component.defaultProps
 *
 * Deliberately single-file syntactic (no ts.Program / type checker): fast,
 * zero-config, and every place a heuristic fills a gap is marked 'inferred'
 * so humans review it — extraction proposes, never decides (docs/11).
 *
 * When a component has a co-located *.module.css, the css-module adapter
 * additionally proposes ANATOMY (part tree, token bindings, layout, states)
 * — see adapters/css-module.ts. Components without one keep the exact
 * behavior above: API surface only, anatomy stays a stub.
 *
 *
 * This file is the file-system SHELL: it walks the root directory, reads
 * source + co-located CSS Module text, and hands each file to the PURE
 * extractor (core/extract-react-tsx.ts) — the same code a browser
 * playground imports directly with source text.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadTokenIndex, type TokenIndex } from './css-module.js';
import { extractFromSource, type SkippedComponent } from '../../core/extract-react-tsx.js';
import type { ExtractedComponent } from '../types.js';

export { extractFromSource, type SkippedComponent, type SourceFileInput } from '../../core/extract-react-tsx.js';

const SKIP_FILE = /\.(stories|story|test|spec|demos?|d)\.tsx?$/;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '__tests__', '__mocks__']);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) yield* walkFiles(full);
    } else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield full;
    }
  }
}

export interface ReactTsxOptions {
  /** DTCG token files that referee var(--x) → {a.b.c} bindings during
   *  anatomy extraction. Default: this repo's tokens/ layout, where present. */
  tokenFiles?: string[];
}

export function extractReactTsx(
  root: string,
  skipped?: SkippedComponent[],
  options?: ReactTsxOptions,
): ExtractedComponent[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`react-tsx adapter: root directory not found: ${root}`);
  }
  let tokenIndex: TokenIndex | null = null;
  const tokens = () => (tokenIndex ??= loadTokenIndex(options?.tokenFiles));
  const out: ExtractedComponent[] = [];
  const seen = new Set<string>();
  for (const file of walkFiles(root)) {
    const src = readFileSync(file, 'utf8');
    const cssPath = file.replace(/\.tsx?$/, '.module.css');
    const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : undefined;
    // SIBLING-TYPE-FILE RULE: `<X>.tsx` + co-located `<X>.types.ts(x)` are one
    // declared module surface (the `import type { XProps } from './X.types'`
    // convention — Fluent-style but general). The sibling's type declarations
    // join the type table; component discovery stays in the component file.
    const typesPath = [file.replace(/\.tsx?$/, '.types.ts'), file.replace(/\.tsx?$/, '.types.tsx')].find(
      (p) => p !== file && existsSync(p),
    );
    const types = typesPath
      ? [{ sourcePath: path.relative(process.cwd(), typesPath), source: readFileSync(typesPath, 'utf8') }]
      : undefined;
    // Phase B: co-located same-directory sources join as render-helper
    // context (`import {renderDropdownItems} from './renderDropdownItems'`)
    // — anatomy can resolve helper calls one directory deep, nothing more.
    const dir = path.dirname(file);
    const helpers = readdirSync(dir)
      .filter((n) => /\.tsx?$/.test(n) && !SKIP_FILE.test(n) && path.join(dir, n) !== file && path.join(dir, n) !== typesPath)
      .map((n) => ({
        sourcePath: path.relative(process.cwd(), path.join(dir, n)),
        source: readFileSync(path.join(dir, n), 'utf8'),
      }));
    out.push(
      ...extractFromSource(
        {
          sourcePath: path.relative(process.cwd(), file),
          source: src,
          css,
          ...(types ? { types } : {}),
          ...(helpers.length > 0 ? { helpers } : {}),
        },
        tokens,
        seen,
        skipped,
      ),
    );
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
