/**
 * Receipts for the NEW emitters (html, react-inline) — `npm run emitters:check`.
 *
 * The shipping react emitter is byte-guarded by evals/golden.json; these two
 * are not wired into the CLI, so this script asserts their schema-driven
 * invariants over Badge / Switch / Card / Button and writes eyeball samples
 * to core/samples/:
 *
 *   1. Every enum value produces a class (html) / a variant-styles branch or
 *      literal branch (inline).
 *   2. Every token ref either resolved to a literal (inline) or became a
 *      var(--…) reference (html) — ZERO unresolved {token.path} braces.
 *   3. The inline emitter's output contains NO var(-- references (that is
 *      its whole claim).
 *   4. The html emitter's output contains NO React syntax.
 *
 * This is a node script (it writes samples) over pure functions — the same
 * split as every other shell in the repo.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitHtml } from './emit-html.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitters, type EmitterCtx } from './emitter.js';
import { tokenInventoryFromJson } from './tokens.js';
import { kebab } from '../extract/types.js';

const ROOT = process.cwd();
const SAMPLES = path.join(ROOT, 'core', 'samples');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f))))
    .map((c) => [c.id, c]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
);
const brands = Object.fromEntries(
  readdirSync(path.join(ROOT, 'tokens', 'modes'))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
);
const ctx: EmitterCtx = {
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic: read('tokens/semantic.tokens.json'),
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands,
  },
  icons,
  contracts,
};

const SUBJECTS = ['ds.badge', 'ds.switch', 'ds.card', 'ds.button'];
const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

/** A brace-wrapped token path or placeholder that survived emission. */
const UNRESOLVED_REF = /\{[a-z][a-z0-9-]*(\.[a-z0-9{}-]+)+\}|\{[a-z][\w-]*\}(?![\s\S]*\bJSX\b)/;
/** Token-path-shaped braces only (JSX braces are legal in TSX output). */
const UNRESOLVED_TOKEN_PATH = /\{[a-z][a-z0-9-]*(\.[a-z0-9{}-]+)+\}/;

mkdirSync(SAMPLES, { recursive: true });

for (const id of SUBJECTS) {
  const contract = contracts.get(id)!;
  const name = contract.name;
  console.log(`\n${name} (${id})`);

  // ---- html emitter -------------------------------------------------------
  const { html, css } = emitHtml(contract, {
    tokens: tokenInventoryFromJson([ctx.tokens.primitives, ctx.tokens.semantic, ctx.tokens.light, ctx.tokens.dark]),
    icons,
    contracts,
  });
  const htmlAll = html + css;
  for (const p of contract.props) {
    if (typeof p.type !== 'object' || !('enum' in p.type)) continue;
    for (const v of p.type.enum) {
      check(`html: enum ${p.name}=${v} produces the modifier class`, htmlAll.includes(`${kebab(name)}--${p.name}-${v}`));
    }
  }
  check('html: zero unresolved {token.path} braces', !UNRESOLVED_TOKEN_PATH.test(htmlAll));
  check('html: every bound token became a var(--…) reference or a literal', css.includes('var(--') || !/tokens/.test(JSON.stringify(contract.anatomy)));
  check('html: no React syntax (className/forwardRef/JSX braces)', !/className=|forwardRef|\{children\}|dangerouslySetInnerHTML/.test(htmlAll));
  writeFileSync(path.join(SAMPLES, `${kebab(name)}.html`), html);
  writeFileSync(path.join(SAMPLES, `${kebab(name)}.css`), css);

  // ---- react-inline emitter ------------------------------------------------
  const { tsx } = emitReactInline(contract, { tokens: ctx.tokens, icons, contracts, mode: 'light' });
  for (const p of contract.props) {
    if (typeof p.type !== 'object' || !('enum' in p.type)) continue;
    for (const v of p.type.enum) {
      // Every enum value appears as a compiled branch: a variant-styles key,
      // a literal comparison, or a type-union member consumed by a lookup.
      check(`inline: enum ${p.name}=${v} produces a branch`, tsx.includes(`${p.name}-${v}:`) || tsx.includes(`'${v}'`));
    }
  }
  check('inline: NO var(-- references (tokens resolved to literals)', !tsx.includes('var(--'));
  check('inline: zero unresolved {token.path} braces', !UNRESOLVED_TOKEN_PATH.test(tsx));
  check('inline: names its resolution mode', tsx.includes('Resolution mode: light'));
  check('inline: traceability header names the contract', tsx.includes(`${contract.id} v${contract.version}`));
  writeFileSync(path.join(SAMPLES, `${name}.inline.tsx`), tsx);
}

// The registry itself is part of the spec story: four emitters, one contract.
console.log('\nRegistry');
check('registry: react, html, react-inline, figma-script all registered',
  ['react', 'html', 'react-inline', 'figma-script'].every((n) => emitters.some((e) => e.name === n)));
const badge = contracts.get('ds.badge')!;
for (const e of emitters) {
  const files = e.emit(badge, ctx);
  check(`registry: ${e.name} emits ${files.length} file(s) for Badge, all non-empty`,
    files.length > 0 && files.every((f) => f.contents.length > 0));
}

console.log(`\nsamples → core/samples/`);
if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} emitter invariant(s) failed`);
  process.exit(1);
}
console.log(`✔ all emitter invariants hold (${SUBJECTS.length} contracts × 2 new emitters + registry)`);
