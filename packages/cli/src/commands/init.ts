/**
 * `ds-contracts init` — writes ds-contracts.config.json in the cwd.
 *
 * The file IS the ExtractConfig shape (extract/types.ts) the whole
 * extraction/diagnose pipeline reads, plus a `generate` section for the
 * code-generation defaults. One config, every verb.
 *
 * `init --detect` (G14): prefill from the repo instead of the template —
 * adapter (cem when a custom-elements manifest is present, react-tsx when
 * react is a dependency), code.root (first existing conventional source
 * dir), tokens (discovered DTCG-looking files), plus styling-method HINTS
 * (Emotion/Tailwind/StyleX/CSS Modules) that route runtime-styled libraries
 * toward `extract --draft-capture-config`. Every prefilled value is marked
 * in a `$detected` block as DETECTED, NOT CONFIRMED — detection turns
 * authoring into confirmation, it never skips the human.
 *
 * PURE CORE + thin shell: detectConfig() is a pure function of gathered
 * facts (unit-pinned in packages/cli/test/init-detect.test.ts); only
 * gatherDetectFacts touches the file system.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CliUsageError, parseFlags } from '../lib.js';

export const CONFIG_FILENAME = 'ds-contracts.config.json';

const TEMPLATE = {
  $comment:
    'ds-contracts configuration. `code`/`design`/`tokens`/`idPrefix`/`out`/`diagnose` are the ExtractConfig shape (extract + diff verbs); `generate` holds code-generation defaults. Every path is relative to this file.',
  code: {
    adapter: 'react-tsx',
    root: 'src/components',
  },
  design: {
    source: 'design-dump.json',
  },
  tokens: ['tokens/tokens.json'],
  idPrefix: 'ds',
  out: 'ds-contracts/out',
  generate: {
    target: 'react',
    out: 'src/generated',
    tokens: ['tokens/tokens.json'],
    icons: 'assets/icons',
    stories: false,
  },
} as const;

// ---------------------------------------------------------------------------
// Detection — pure core
// ---------------------------------------------------------------------------

export interface DetectFacts {
  /** Parsed package.json of the cwd, or null when absent/unreadable. */
  pkg: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    customElements?: string;
  } | null;
  /** Conventional source roots that EXIST, in tested order
   *  (src/components, src, components, lib). */
  existingRoots: string[];
  /** Path to a custom-elements manifest, when one exists. */
  cemManifest: string | null;
  /** Discovered token files (*.tokens.json / tokens.json / *.dtcg.json), sorted. */
  tokenFiles: string[];
  /** Any *.module.css seen under the chosen root (bounded walk). */
  moduleCss: boolean;
}

export interface DetectResult {
  config: Record<string, unknown>;
  /** Per-field provenance lines — every one says detected, NOT confirmed. */
  detected: Record<string, string>;
  /** Styling-method hints (emotion | tailwind | stylex | css-modules). */
  stylingHints: string[];
}

/** PURE: repo facts → prefilled config + provenance. Same facts, same bytes. */
export function detectConfig(facts: DetectFacts): DetectResult {
  const deps: Record<string, string> = {
    ...facts.pkg?.peerDependencies,
    ...facts.pkg?.devDependencies,
    ...facts.pkg?.dependencies,
  };
  const detected: Record<string, string> = {};

  // adapter — a custom-elements manifest wins (it IS the declared API
  // surface); react dependency selects react-tsx; otherwise the template
  // default stands, named as a default rather than a detection.
  let adapter: 'react-tsx' | 'cem' = 'react-tsx';
  if (facts.cemManifest) {
    adapter = 'cem';
    detected['code.adapter'] = `cem — custom-elements manifest at ${facts.cemManifest}`;
    detected['code.manifest'] = `${facts.cemManifest} — from ${facts.pkg?.customElements ? 'package.json "customElements"' : 'a conventional manifest location'}`;
  } else if (deps.react) {
    detected['code.adapter'] = `react-tsx — react ${deps.react} in package.json`;
  } else {
    detected['code.adapter'] = 'react-tsx — DEFAULT, no react dependency and no custom-elements manifest detected; confirm the adapter before extracting';
  }

  const root = facts.existingRoots[0];
  if (adapter !== 'cem') {
    detected['code.root'] = root
      ? `${root} — first existing of src/components, src, components, lib`
      : 'src/components — DEFAULT, no conventional source dir found; point this at your components';
  }

  detected['tokens'] =
    facts.tokenFiles.length > 0
      ? `${facts.tokenFiles.join(', ')} — token-looking JSON found (*.tokens.json / tokens.json / *.dtcg.json)`
      : 'tokens/tokens.json — DEFAULT, no token files found; extraction binds var(--x) against a REAL token tree, so point this at yours';

  const stylingHints: string[] = [];
  if (deps['@emotion/react'] || deps['@emotion/styled'] || deps['@mui/material']) stylingHints.push('emotion');
  if (deps.tailwindcss) stylingHints.push('tailwind');
  if (deps['@stylexjs/stylex']) stylingHints.push('stylex');
  if (facts.moduleCss) stylingHints.push('css-modules');
  if (stylingHints.length > 0) {
    detected['styling'] =
      `${stylingHints.join(', ')} — ` +
      (stylingHints.some((s) => s === 'emotion' || s === 'tailwind' || s === 'stylex')
        ? 'runtime/atomic styling detected: the static pass reads the API surface only; styling truth needs computed capture — start from `ds-contracts extract --draft-capture-config`'
        : 'co-located CSS Modules detected: the static pass extracts anatomy + token bindings directly');
  }

  const code: Record<string, unknown> =
    adapter === 'cem'
      ? { adapter, manifest: facts.cemManifest }
      : { adapter, root: root ?? TEMPLATE.code.root };
  const tokens = facts.tokenFiles.length > 0 ? facts.tokenFiles : [...TEMPLATE.tokens];

  const config: Record<string, unknown> = {
    $comment: TEMPLATE.$comment,
    $detected: {
      $comment:
        'every entry below was DETECTED from this repo, NOT confirmed — verify each named value, then delete this block (it is ignored by every verb)',
      ...detected,
    },
    code,
    design: { ...TEMPLATE.design },
    tokens,
    idPrefix: TEMPLATE.idPrefix,
    out: TEMPLATE.out,
    generate: { ...TEMPLATE.generate, tokens },
  };
  return { config, detected, stylingHints };
}

// ---------------------------------------------------------------------------
// Shell — fact gathering (fs only) + command
// ---------------------------------------------------------------------------

const CANDIDATE_ROOTS = ['src/components', 'src', 'components', 'lib'];
const CEM_CANDIDATES = ['custom-elements.json', 'dist/custom-elements.json'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

function hasModuleCss(dir: string, depth: number): boolean {
  if (depth < 0) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.module.css')) return true;
  }
  for (const e of entries) {
    if (e.isDirectory() && !SKIP_DIR.has(e.name) && hasModuleCss(path.join(dir, e.name), depth - 1)) return true;
  }
  return false;
}

export function gatherDetectFacts(cwd: string): DetectFacts {
  let pkg: DetectFacts['pkg'] = null;
  try {
    pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')) as DetectFacts['pkg'];
  } catch {
    pkg = null;
  }
  const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory();
  const existingRoots = CANDIDATE_ROOTS.filter((r) => isDir(path.join(cwd, r)));

  let cemManifest: string | null = null;
  if (typeof pkg?.customElements === 'string' && existsSync(path.join(cwd, pkg.customElements))) {
    cemManifest = pkg.customElements;
  } else {
    cemManifest = CEM_CANDIDATES.find((c) => existsSync(path.join(cwd, c))) ?? null;
  }

  const tokenFiles: string[] = [];
  const looksLikeTokens = (name: string): boolean =>
    name === 'tokens.json' || name.endsWith('.tokens.json') || name.endsWith('.dtcg.json');
  for (const dir of ['.', 'tokens']) {
    const abs = path.join(cwd, dir);
    if (!isDir(abs)) continue;
    for (const f of readdirSync(abs).sort()) {
      if (looksLikeTokens(f)) tokenFiles.push(dir === '.' ? f : `${dir}/${f}`);
    }
  }

  const root = existingRoots[0];
  return {
    pkg,
    existingRoots,
    cemManifest,
    tokenFiles: tokenFiles.sort(),
    moduleCss: root ? hasModuleCss(path.join(cwd, root), 3) : false,
  };
}

export function initCommand(argv: string[]): number {
  const parsed = parseFlags(argv, { bool: ['force', 'detect'] });
  if (parsed.positionals.length > 0) {
    throw new CliUsageError('init takes no positional arguments (flags: --force, --detect)');
  }
  const target = path.resolve(CONFIG_FILENAME);
  if (existsSync(target) && parsed.flags.get('force') !== true) {
    throw new CliUsageError(`${CONFIG_FILENAME} already exists here — pass --force to overwrite`);
  }
  if (parsed.flags.get('detect') === true) {
    const facts = gatherDetectFacts(process.cwd());
    const { config, detected, stylingHints } = detectConfig(facts);
    writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
    console.log(`✔ Wrote ${CONFIG_FILENAME} (detected — every prefill is named in the "$detected" block, none is confirmed)`);
    for (const [field, why] of Object.entries(detected)) console.log(`  ${field}: ${why}`);
    if (stylingHints.some((s) => s !== 'css-modules')) {
      console.log('  Runtime/atomic styling detected — after `ds-contracts extract`, run `ds-contracts extract --draft-capture-config` to draft the computed-capture config.');
    }
    console.log('  Confirm each detected value, delete the "$detected" block, then: ds-contracts extract');
    return 0;
  }
  writeFileSync(target, JSON.stringify(TEMPLATE, null, 2) + '\n');
  console.log(`✔ Wrote ${CONFIG_FILENAME}`);
  console.log('  Edit code.root / code.adapter (react-tsx | cem) and tokens to match your library,');
  console.log('  then: ds-contracts extract   (or re-run `init --detect --force` to prefill from the repo)');
  return 0;
}
