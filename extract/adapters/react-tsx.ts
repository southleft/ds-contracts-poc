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

/** Why a `.ts`/`.tsx` file the walker SAW was never opened. The rule name is
 *  the receipt: "N files skipped" with no rule is the silence this ledger
 *  exists to end. */
const SKIP_RULE: Record<string, string> = {
  d: 'ambient declaration file (*.d.ts) — an api-extractor/tsc rollup, not component source',
  stories: 'Storybook story file',
  story: 'Storybook story file',
  test: 'test file',
  spec: 'test file',
  demo: 'demo file',
  demos: 'demo file',
};

interface WalkLedger {
  /** Files handed to the extractor. */
  files: string[];
  /** `.ts`/`.tsx` files matched by SKIP_FILE, with the rule that dropped them. */
  skipped: { file: string; rule: string }[];
  /** Directories not descended into (node_modules, dist, …). */
  skippedDirs: string[];
  /** Every directory entry seen, of any extension — distinguishes "an empty
   *  tree" from "a tree full of files none of which are TypeScript". */
  entriesSeen: number;
}

function walkTree(dir: string, ledger: WalkLedger): WalkLedger {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    ledger.entriesSeen++;
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) ledger.skippedDirs.push(full);
      else walkTree(full, ledger);
    } else if (/\.tsx?$/.test(entry.name)) {
      const m = SKIP_FILE.exec(entry.name);
      if (m) ledger.skipped.push({ file: full, rule: SKIP_RULE[m[1]] ?? `matched skip rule ".${m[1]}."` });
      else ledger.files.push(full);
    }
  }
  return ledger;
}

/** THE ZERO-CANDIDATE REFUSAL (Fluent 2 recon §2.6 / H10).
 *
 * `@fluentui/react-*` publishes 0 `.tsx` and 0 non-`.d.ts` `.ts` files across
 * all 65 packages: `lib/*.js` plus one api-extractor rollup `dist/index.d.ts`
 * each. The walker skipped every rollup BY NAME (SKIP_FILE's `d` branch) and
 * therefore opened nothing, so the run died on the generic
 * "No components found — check code.root …" — a refusal that names NOTHING,
 * blames the config for a fact about the package, and is byte-identical to
 * what an EMPTY DIRECTORY produces. That is the exact silent-loss shape this
 * repo exists to eliminate: a skip with no ledger.
 *
 * The refusal now names what was skipped, under which rule, and what to do
 * next. It is general — every enterprise system that ships api-extractor
 * rollups instead of source lands here, and so does a root pointed one
 * directory too high. */
function zeroCandidateRefusal(root: string, ledger: WalkLedger): string {
  const head = `react-tsx adapter REFUSED — ZERO CANDIDATE SOURCE FILES under ${root}.`;
  if (ledger.skipped.length === 0) {
    return (
      `${head} The walk saw ${ledger.entriesSeen} directory entr${ledger.entriesSeen === 1 ? 'y' : 'ies'} and ` +
      `0 .ts/.tsx files of ANY kind` +
      (ledger.skippedDirs.length > 0
        ? ` (${ledger.skippedDirs.length} director${ledger.skippedDirs.length === 1 ? 'y' : 'ies'} not descended into by rule: ${ledger.skippedDirs.slice(0, 5).map((d) => path.basename(d)).join(', ')})`
        : '') +
      `. This is an EMPTY-OF-SOURCE tree, not a package whose props are invisible — point code.root at the directory that holds the component sources.`
    );
  }
  const byRule = new Map<string, string[]>();
  for (const s of ledger.skipped) {
    if (!byRule.has(s.rule)) byRule.set(s.rule, []);
    byRule.get(s.rule)!.push(s.file);
  }
  const breakdown = [...byRule]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([rule, files]) => {
      const named = files.slice(0, 5).map((f) => path.relative(root, f) || path.basename(f));
      return `  · ${files.length} × ${rule}\n      ${named.join(', ')}${files.length > named.length ? `, +${files.length - named.length} more` : ''}`;
    })
    .join('\n');
  const rollupOnly = ledger.skipped.every((s) => s.rule.startsWith('ambient declaration file'));
  return (
    `${head} ${ledger.skipped.length} .ts/.tsx file(s) WERE found and every one was skipped by name:\n` +
    `${breakdown}\n` +
    (rollupOnly
      ? `  ROLLUP-ONLY PACKAGE: this tree publishes ambient declarations only. The API surface is declared ` +
        `(\`export declare const X: ForwardRefComponent<XProps>\`) but no file carries an implementation the ` +
        `single-file extractor can read, so nothing was ever opened — 0 components here is a fact about the ` +
        `PACKAGE, not about code.root.\n` +
        `  Next step: point code.root at the library's SOURCE checkout, or rewrite each rollup into a readable ` +
        `.tsx (\`export declare const X: T\` → \`export const X = (() => null) as T\`) and point code.root at that.`
      : `  Next step: these are the walker's skip rules (stories/test/spec/demo/*.d.ts). If the component sources ` +
        `live behind one of them, rename or relocate them; otherwise point code.root at the directory that holds ` +
        `the implementation files.`)
  );
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
  const ledger = walkTree(root, { files: [], skipped: [], skippedDirs: [], entriesSeen: 0 });
  // A refusal that names nothing is the one outcome this repo forbids. If the
  // walk opened NO file, say which files it saw and which rule dropped each —
  // never let a rollup-only package look like an empty directory.
  if (ledger.files.length === 0) throw new Error(zeroCandidateRefusal(root, ledger));
  for (const file of ledger.files) {
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
