/**
 * #44 — `--tokens` files are ROUTED to EmitterCtx slots, not collapsed.
 *
 * The defect: buildEmitterCtx deep-merged EVERY --tokens file into the
 * `primitives` slot. Two consequences, one loud and one silent:
 *
 *   · loud   — `--target react-inline` refused with `Cannot resolve token
 *              "font.control.family"` because the `brands` slot stayed empty,
 *              so `{brand.*}` aliases had nothing to resolve against. Same
 *              arguments, `--target html`, worked (html reads a flat
 *              inventory), so one of four documented targets was unusable.
 *   · silent — light and dark merged into the same slot, dark last, so
 *              react-inline emitted DARK literals under a header that says
 *              "Resolution mode: light", and figma-script emitted a canvas
 *              with zero derived text styles (they come from the SEMANTIC
 *              slot) and an empty Brand collection.
 *
 * Pins below: the routing rule, the flat-foreign-set default that keeps every
 * published example byte-identical, and the two refusals (unknown slot,
 * same-slot collision) that replace silent overwriting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildEmitterCtx,
  buildTokenRouting,
  classifyTokenFile,
  CliUsageError,
  expandTokenArgs,
  tokenPathsOf,
} from '../src/lib.js';

const dir = mkdtempSync(path.join(tmpdir(), 'ds-token-routing-'));
const write = (rel: string, tree: unknown): string => {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(tree));
  return p;
};

const PRIM = write('tokens/primitives.tokens.json', {
  color: { $type: 'color', white: { $value: '#FFFFFF' }, ink: { $value: '#111111' } },
});
const SEM = write('tokens/semantic.tokens.json', {
  color: { $type: 'color', 'surface-fg': { $value: '{color.ink}' } },
});
const LIGHT = write('tokens/modes/semantic.light.tokens.json', {
  color: { $type: 'color', bg: { $value: '{color.white}' } },
});
const DARK = write('tokens/modes/semantic.dark.tokens.json', {
  color: { $type: 'color', bg: { $value: '{color.ink}' } },
});
const BRAND = write('tokens/modes/brand.default.tokens.json', {
  brand: { $type: 'color', accent: { $value: '{color.ink}' } },
});
const AURORA = write('tokens/modes/brand.aurora.tokens.json', {
  brand: { $type: 'color', accent: { $value: '{color.white}' } },
});
const FLAT_A = write('foreign/acme.dtcg.json', { color: { $type: 'color', a: { $value: '#AAA' } } });
const FLAT_B = write('foreign/acme-minted.dtcg.json', { color: { $type: 'color', b: { $value: '#BBB' } } });

test('the repo layout routes to five distinct slots — nothing collapses', () => {
  const { tokens } = buildEmitterCtx(new Map(), [PRIM, SEM, LIGHT, DARK, BRAND, AURORA]);
  assert.deepEqual(Object.keys(tokens.primitives.color as object).sort(), ['$type', 'ink', 'white']);
  assert.ok('surface-fg' in (tokens.semantic.color as object), 'semantic slot populated');
  assert.equal(((tokens.light.color as any).bg as any).$value, '{color.white}');
  assert.equal(((tokens.dark.color as any).bg as any).$value, '{color.ink}');
  assert.deepEqual(Object.keys(tokens.brands).sort(), ['aurora', 'default']);
  // The whole point: light did NOT overwrite dark (or vice versa).
  assert.notDeepEqual(tokens.light, tokens.dark);
});

test('a flat foreign set still lands in primitives — one slot, deep-merged', () => {
  const { tokens } = buildEmitterCtx(new Map(), [FLAT_A, FLAT_B]);
  assert.deepEqual(Object.keys(tokens.primitives.color as object).sort(), ['$type', 'a', 'b']);
  assert.deepEqual(tokens.semantic, {});
  assert.deepEqual(tokens.light, {});
  assert.deepEqual(tokens.dark, {});
  assert.deepEqual(tokens.brands, { default: {} }); // the shape figma-script asserts
});

test('classification is by declared convention, and says which rule fired', () => {
  assert.deepEqual(classifyTokenFile(PRIM), { slot: 'primitives', why: 'convention' });
  assert.deepEqual(classifyTokenFile(SEM), { slot: 'semantic', why: 'convention' });
  assert.deepEqual(classifyTokenFile(LIGHT), { slot: 'light', why: 'convention' });
  assert.deepEqual(classifyTokenFile(DARK), { slot: 'dark', why: 'convention' });
  assert.deepEqual(classifyTokenFile(BRAND), { slot: 'brand.default', why: 'convention' });
  assert.deepEqual(classifyTokenFile(AURORA), { slot: 'brand.aurora', why: 'convention' });
  // *.dtcg.json is NOT the layered convention — flat set, primitives.
  assert.deepEqual(classifyTokenFile(FLAT_A), { slot: 'primitives', why: 'flat-set default' });
});

test('an explicit slot= prefix overrides the convention and wins', () => {
  const { tokens } = buildEmitterCtx(new Map(), [`semantic=${FLAT_A}`, `brand.night=${FLAT_B}`]);
  assert.ok('a' in (tokens.semantic.color as object));
  assert.deepEqual(tokens.primitives, {});
  assert.ok(tokens.brands.night, 'brand.night slot minted from the prefix');
});

test('an unknown slot REFUSES BY NAME — never a silent demotion to primitives', () => {
  assert.throws(
    () => buildTokenRouting([`midnight=${FLAT_A}`]),
    (e: unknown) => e instanceof CliUsageError && /unknown slot "midnight"/.test((e as Error).message),
  );
});

test('two files fighting over one token INSIDE a slot refuse, naming both files', () => {
  // A user's own light/dark pair under names our convention cannot classify:
  // both fall to primitives, and the merge would silently keep the last one.
  const a = write('foreign/theme-a.dtcg.json', { color: { $type: 'color', bg: { $value: '#FFFFFF' } } });
  const b = write('foreign/theme-b.dtcg.json', { color: { $type: 'color', bg: { $value: '#000000' } } });
  assert.throws(
    () => buildTokenRouting([a, b]),
    (e: unknown) =>
      e instanceof CliUsageError &&
      /color\.bg: theme-a\.dtcg\.json says "#FFFFFF", theme-b\.dtcg\.json says "#000000"/.test((e as Error).message) &&
      /--tokens light=<file>,dark=<file>/.test((e as Error).message),
  );
  // …and naming the slots is the documented way through.
  const ok = buildTokenRouting([`light=${a}`, `dark=${b}`]);
  assert.deepEqual([...ok.bySlot.keys()].sort(), ['dark', 'light']);
});

test('re-declaring the SAME value in one slot is not a collision', () => {
  const a = write('foreign/dup-a.dtcg.json', { color: { $type: 'color', bg: { $value: '#FFFFFF' } } });
  const b = write('foreign/dup-b.dtcg.json', { color: { $type: 'color', bg: { $value: '#FFFFFF' } } });
  assert.doesNotThrow(() => buildTokenRouting([a, b]));
});

test('--tokens accepts a directory: the whole layout in one flag, sorted', () => {
  const entries = expandTokenArgs(path.join(dir, 'tokens'));
  assert.deepEqual(
    entries.map((e) => path.basename(e)),
    [
      'brand.aurora.tokens.json',
      'brand.default.tokens.json',
      'semantic.dark.tokens.json',
      'semantic.light.tokens.json',
      'primitives.tokens.json',
      'semantic.tokens.json',
    ],
  );
  const { tokens } = buildEmitterCtx(new Map(), entries);
  assert.deepEqual(Object.keys(tokens.brands).sort(), ['aurora', 'default']);
  assert.notDeepEqual(tokens.light, tokens.dark);
});

test('a missing token path is named, not an ENOENT stack', () => {
  assert.throws(
    () => expandTokenArgs(path.join(dir, 'nope.dtcg.json')),
    (e: unknown) => e instanceof CliUsageError && /Token path not found/.test((e as Error).message),
  );
});

test('tokenPathsOf strips slots — the react target gets plain paths', () => {
  assert.deepEqual(tokenPathsOf([`light=${LIGHT}`, PRIM]), [LIGHT, PRIM]);
  // A path that merely CONTAINS "=" is a path, not a slot.
  assert.deepEqual(tokenPathsOf(['/tmp/a=b.dtcg.json']), ['/tmp/a=b.dtcg.json']);
});
