/**
 * slot-wrapper-floor eval body — live-gauntlet class ⑤
 * (linked-icon-wrapper-collapses): the CBDS Icon set is an INSTANCE_SWAP
 * wrapper — a SLOT-ONLY root whose drawn FIXED width the fluid root
 * convention demoted to max-width, floored by min-width: fit-content. With
 * the slot empty (or its default a geometry-less stub) fit-content is 0, so
 * a LINKED ds.icon rendered ZERO-SIZE — worse than a stub, which carries
 * the observed bbox (Icon Button collapsed to a 16×48 pill, 54.7–63.4%
 * masked, 180 rows).
 *
 * Pins (the stub discipline's observed-geometry floor):
 *   · a slot-only root carrying BOTH height and max-width mirrors EVERY
 *     max-width declaration (base + per-value) onto min-width in emit-html
 *     AND emit-react generateCss — the drawn box is the empty slot's floor
 *   · a fluid slot container (max-width, NO height — List/Toast/Toolbar
 *     shape) keeps the fit-content floor — repo output untouched
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { ContractSchema } from '../../scripts/contract-schema.js';
import { emitHtml } from '../../core/emit-html.js';
import { generateCss } from '../../core/emit-react.js';

const fail = (msg: string): never => {
  console.error(`✘ slot-wrapper-floor: ${msg}`);
  process.exit(1);
};

const wrapper = (withHeight: boolean) =>
  ContractSchema.parse({
    id: 'ds.eval-icon-wrap',
    name: 'EvalIconWrap',
    version: '0.1.0',
    status: 'draft',
    description: 'slot wrapper',
    semantics: { element: 'div' },
    props: [
      {
        name: 'size',
        type: { enum: ['small', 'large'] },
        default: 'small',
        bindings: { figma: { kind: 'VARIANT', property: 'size' }, code: { prop: 'size' } },
      },
    ],
    states: [],
    events: [],
    anatomy: {
      root: {
        tokens: {
          'max-width': '{icon-size.small}',
          ...(withHeight ? { height: '{icon-size.{size}}' } : {}),
        },
        tokensByProp: { prop: 'size', map: { large: { 'max-width': '{icon-size.large}' } } },
        parts: { holder: { slot: { name: 'children' } } },
      },
    },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: 'src/components/EvalIconWrap', export: 'EvalIconWrap' },
    },
  });

const ctx = { tokens: {} as never, icons: new Map<string, string>(), contracts: new Map() };
const inventory = new Set(['icon-size.small', 'icon-size.large']);

// 1) fixed wrapper (height + max-width, slot-only) → min-width mirrors.
{
  const html = emitHtml(wrapper(true), ctx as never);
  const base = html.css.match(/\.eval-icon-wrap \{[^}]*\}/)?.[0] ?? '';
  if (!base.includes('max-width: var(--icon-size-small)') || !base.includes('min-width: var(--icon-size-small)')) {
    fail(`emit-html base rule lacks the min-width floor:\n${base}`);
  }
  if (base.includes('fit-content')) fail('emit-html fixed wrapper still floors at fit-content (0 for an empty slot)');
  const largeRules = html.css.match(/\.eval-icon-wrap--size-large \{[^}]*\}/g) ?? [];
  if (!largeRules.some((r) => r.includes('min-width: var(--icon-size-large)'))) {
    fail(`emit-html per-value max-width did not mirror onto min-width:\n${largeRules.join('\n')}`);
  }
  const errors: string[] = [];
  const css = generateCss(wrapper(true), inventory, errors);
  if (errors.length > 0) fail(`generateCss violations: ${errors.join(' | ')}`);
  const rBase = css.match(/\.root \{[^}]*\}/)?.[0] ?? '';
  if (!rBase.includes('min-width: var(--icon-size-small)') || rBase.includes('fit-content')) {
    fail(`generateCss base rule lacks the floor (or keeps fit-content):\n${rBase}`);
  }
  const rLargeRules = css.match(/\.size-large \{[^}]*\}/g) ?? [];
  if (!rLargeRules.some((r) => r.includes('min-width: var(--icon-size-large)'))) {
    fail(`generateCss per-value floor missing:\n${rLargeRules.join('\n')}`);
  }
}

// 2) fluid container (no height) → fit-content stays; no floor mirror.
{
  const html = emitHtml(wrapper(false), ctx as never);
  const base = html.css.match(/\.eval-icon-wrap \{[^}]*\}/)?.[0] ?? '';
  if (!base.includes('min-width: fit-content')) fail('fluid slot container lost its fit-content floor — over-fired');
  if (base.includes('min-width: var(--icon-size-small)')) fail('fluid slot container gained a fixed floor — over-fired');
  const errors: string[] = [];
  const css = generateCss(wrapper(false), inventory, errors);
  const rBase = css.match(/\.root \{[^}]*\}/)?.[0] ?? '';
  if (!rBase.includes('min-width: fit-content')) fail('generateCss fluid container lost fit-content — over-fired');
}

console.log('slot-wrapper-floor ok: fixed slot wrappers floor at the drawn box (base + per-value, emit-html + generateCss); fluid slot containers keep fit-content');
