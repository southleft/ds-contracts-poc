/**
 * Receipts for the OWNER TOOLTIP field case — `npm run extract:figma:tooltip:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-tooltip.rest-dump.json — the LIVE REST
 * dump of the owner's CBDS "Tooltip" set (file WofZT8xaxXuc2Q6Je9S4XE, node
 * 695-313; axes pointer=true|false × pointer-position, 9 variants). The
 * original import proposed a clean contract but the render "looked
 * unstyled": the DROP_SHADOW never reached the canvas preview and the
 * Pointer (a 12×12 REGULAR_POLYGON, rotated per placement, absolutely
 * positioned) rendered as nothing; the Semi Bold title rendered un-bold and
 * the 16px line height was a named receipt. This receipt pins every fix,
 * asserting EXACT values end-to-end against the dump (byte/numeric
 * equality — a plausible-but-wrong constant is the worst outcome):
 *
 *   1. SHADOW      box-shadow mints byte-equal to the dump's DROP_SHADOW
 *                  (0px 2px 4px #00000029), the emitted CSS carries it, and
 *                  the compiled canvas spec projects it as a native effect
 *   2. POINTER     a REAL shape part: triangle (3 sides), 12×12, fill
 *                  #fcfeff, rotation per placement, and DIFFERENT absolute
 *                  placement for top-right vs bottom-left vs left-center —
 *                  offsets equal to the captured boxes
 *   3. NO ARROW    pointer=false renders no arrow (visibleWhen boolean on
 *                  every surface); pointer-position=none suppresses it even
 *                  against defaults (display: none / compiled suppression)
 *   4. TEXT        Main text font-weight 600 (weight-name table: "Semi
 *                  Bold") + line-height 16px EXACT; Supporting text 400 +
 *                  16px — minted, bound, and resolvable on the CSS surface
 *
 * Node script over pure functions (core/*) — the same shell/core split as
 * extract/figma/cbds-check.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { proposeFromDump } from './propose.js';
import { emitReact } from '../../core/emit-react.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitFigmaScript, createFigmaEngine, type NodeSpec } from '../../core/emit-figma-script.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

type J = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const corpus = loadTokenCorpus(ROOT);

console.log('CBDS Tooltip (cbds-tooltip.rest-dump.json) — shadow, pointer geometry, text channels');
const dump = read(path.join('extract', 'figma', 'fixtures', 'cbds-tooltip.rest-dump.json'));
const setRaw = dump['Tooltip'] as unknown as DumpSet;
const real = proposeFromDump(clone(setRaw), {
  corpus,
  contractIdByName: new Map<string, string>(),
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
const c = real.contract as J;
const contract: Contract = ContractSchema.parse(c);

// Minted leaf values, for EXACT-resolution assertions.
const minted = new Map<string, string>();
for (const [p, entry] of flattenTokens((real.mintedTokens?.tree ?? {}) as Record<string, unknown>)) {
  minted.set(p, String(entry.value));
}
const resolve = (ref: string | undefined): string | undefined =>
  typeof ref === 'string' ? minted.get(ref.slice(1, -1)) : undefined;

// ---------------------------------------------------------------------------
// Ground truth FROM THE DUMP (never hardcoded ahead of the fixture)
// ---------------------------------------------------------------------------
const v0 = setRaw.variants[0]; // pointer=true, pointer-position=top-right
const dumpEffect = v0.effects![0];
const alphaByte = Math.round((dumpEffect.color!.alpha ?? 1) * 255).toString(16).padStart(2, '0');
const dumpShadowCss = `${dumpEffect.offset!.x}px ${dumpEffect.offset!.y}px ${dumpEffect.radius}px #${dumpEffect.color!.hex}${alphaByte}`;
const dumpFill = `#${v0.fill!.hex}`;
const dumpRadius = `${v0.cornerRadius}px`;
const dumpPadding = `${v0.layout!.padding[0]}px`;
const nodeOf = (variant: DumpNode, name: string) => (variant.children ?? []).find((ch) => ch.name === name)!;
const mainText = nodeOf(v0, 'Main text');
const supportText = nodeOf(v0, 'Supporting text');
const pointer0 = nodeOf(v0, 'Pointer');

// ---------------------------------------------------------------------------
// 1. Shadow mints byte-equal and renders on the CSS surface
// ---------------------------------------------------------------------------
const rootTokens = (c.anatomy as J).root.tokens ?? {};
check(
  `box-shadow MINTED byte-equal to the dump's DROP_SHADOW (${dumpShadowCss})`,
  resolve(rootTokens['box-shadow']) === dumpShadowCss && dumpShadowCss === '0px 2px 4px #00000029',
);
check(`root background-color resolves to the dump fill ${dumpFill} (#fcfeff)`, resolve(rootTokens['background-color']) === dumpFill && dumpFill === '#fcfeff');
check(`root border-radius resolves to ${dumpRadius} (4px)`, resolve(rootTokens['border-radius']) === dumpRadius && dumpRadius === '4px');
check(
  `root padding resolves to ${dumpPadding}/${dumpPadding} (8px, both axes)`,
  resolve(rootTokens['padding-inline']) === dumpPadding && resolve(rootTokens['padding-block']) === dumpPadding && dumpPadding === '8px',
);

const inventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
  (real.mintedTokens?.tree ?? {}) as Record<string, unknown>,
]);
const icons = new Map<string, string>();
const contracts = new Map<string, Contract>([[contract.id, contract]]);
let tsx = '';
let css = '';
try {
  ({ tsx, css } = emitReact(contract, { tokens: inventory, icons, contracts }));
} catch (e) {
  check(`emitReact green — ${String(e).split('\n')[0]}`, false);
}
check('emitReact CSS: box-shadow declaration on the root', css.includes('box-shadow: var(--imported-tooltip-root-box-shadow)'));

// ---------------------------------------------------------------------------
// 2. Pointer geometry — triangle, fill, rotation, per-placement offsets
// ---------------------------------------------------------------------------
const pointerPart = (c.anatomy as J).root.parts?.Pointer as J | undefined;
check(
  'Pointer is a REAL shape part: polygon, 3 sides, 12×12 (dump intrinsic size)',
  pointerPart?.shape?.kind === 'polygon' &&
    pointerPart?.shape?.sides === 3 &&
    pointerPart?.shape?.width === pointer0.shape!.width &&
    pointerPart?.shape?.height === pointer0.shape!.height &&
    pointer0.shape!.width === 12,
);
check(`Pointer fill resolves to the dump's ${dumpFill}`, resolve(pointerPart?.tokens?.['background-color']) === dumpFill);
check('emitReact CSS: triangle clip-path on .Pointer', css.includes('clip-path: polygon(50% 0%, 93.3013% 75%, 6.6987% 75%)'));

const placementOf = (value: string): Record<string, string> | undefined =>
  (pointerPart?.stylesWhen as J[] | undefined)?.find((sw) => sw.equals === value)?.styles;
const topRight = placementOf('topRight');
const bottomLeft = placementOf('bottomLeft');
const leftCenter = placementOf('leftCenter');
check(
  'top-right placement EXACT from the captured box (right: 12px, top: -8px, rotation 0)',
  topRight?.position === 'absolute' && topRight?.right === '12px' && topRight?.top === '-8px' && topRight?.transform === undefined,
);
check(
  'bottom-left placement EXACT (left: 12px, bottom: -8px, rotate(180deg))',
  bottomLeft?.left === '12px' && bottomLeft?.bottom === '-8px' && bottomLeft?.transform === 'rotate(180deg)',
);
check(
  'left-center placement EXACT (left: -8px, vertically centered, rotate(-90deg))',
  leftCenter?.left === '-8px' && leftCenter?.top === '50%' && leftCenter?.transform === 'translateY(-50%) rotate(-90deg)',
);
check(
  'the three placements genuinely DIFFER',
  JSON.stringify(topRight) !== JSON.stringify(bottomLeft) && JSON.stringify(bottomLeft) !== JSON.stringify(leftCenter),
);
check(
  'emitReact CSS: per-placement rules under the enum class (.pointerPosition-topRight .Pointer …)',
  ['topRight', 'bottomLeft', 'leftCenter'].every((v) => css.includes(`.pointerPosition-${v} .Pointer`)),
);
check('the placement carry is NOTED with exact-offset provenance', real.notes.some((n) => n.includes('offsets EXACT from the captured boxes')));
check('the assumed triangle side count is NOTED (REST has no pointCount)', real.notes.some((n) => n.includes('sides: 3 (the Figma default')));

// ---------------------------------------------------------------------------
// 3. pointer=false → no arrow, everywhere
// ---------------------------------------------------------------------------
check(
  'visibleWhen { prop: pointer } inverted from the hidden pattern (boolean axis)',
  pointerPart?.visibleWhen?.prop === 'pointer' && pointerPart?.visibleWhen?.equals === undefined,
);
check('emitReact TSX: the arrow renders conditionally ({pointer ? …})', tsx.includes('{pointer ? ('));
check(
  'pointer-position=none suppresses the arrow even against defaults (display: none stylesWhen)',
  placementOf('none')?.display === 'none' && css.includes('.pointerPosition-none .Pointer {\n  display: none;\n}'),
);

// ---------------------------------------------------------------------------
// 4. Text channels — weight-name table + PIXEL line-height, EXACT
// ---------------------------------------------------------------------------
const mainPart = (c.anatomy as J).root.parts?.mainText as J | undefined;
const supportPart = (c.anatomy as J).root.parts?.supportingText as J | undefined;
check(
  `Main text ("${mainText.text!.fontStyle}") font-weight resolves to 600 EXACTLY (weight-name table)`,
  resolve(mainPart?.tokens?.['font-weight']) === '600' && mainText.text!.fontStyle === 'Semi Bold',
);
check(
  `Main text line-height resolves to ${mainText.text!.lineHeight}px EXACTLY (dump v1.3 PIXELS)`,
  resolve(mainPart?.tokens?.['line-height']) === `${mainText.text!.lineHeight}px` && mainText.text!.lineHeight === 16,
);
check(
  `Supporting text ("${supportText.text!.fontStyle}") font-weight resolves to 400 + line-height ${supportText.text!.lineHeight}px`,
  resolve(supportPart?.tokens?.['font-weight']) === '400' &&
    resolve(supportPart?.tokens?.['line-height']) === `${supportText.text!.lineHeight}px`,
);
check(
  'emitReact CSS: font-weight + line-height declarations on both text parts',
  ['main-text-font-weight', 'main-text-line-height', 'supporting-text-font-weight', 'supporting-text-line-height'].every((t) =>
    css.includes(`var(--imported-tooltip-${t})`),
  ),
);

// ---------------------------------------------------------------------------
// 5. Canvas surfaces — compiled specs + sync script
// ---------------------------------------------------------------------------
const tokenTree: TokenTreeInput = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: { ...read('tokens/semantic.tokens.json'), ...((real.mintedTokens?.tree ?? {}) as Record<string, unknown>) },
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
  brands: {
    default: read('tokens/modes/brand.default.tokens.json'),
    aurora: read('tokens/modes/brand.aurora.tokens.json'),
  },
};
const engine = createFigmaEngine({ tokens: tokenTree, icons });
const data = engine.compileComponentData(contract, contracts);
const shapeOf = (variantName: string): NodeSpec | undefined =>
  (data.variants.find((v) => v.name.includes(variantName))?.spec.children ?? []).find((ch) => ch.type === 'shape');
const cTR = shapeOf('top-right');
const cBL = shapeOf('bottom-left');
const cLC = shapeOf('left-center');
check(
  'canvas spec: root carries the native DROP_SHADOW (0/2/4 #00000029 — numeric equality with the dump)',
  data.variants.every((v) => {
    const sh = v.spec.dropShadow;
    return sh !== undefined && sh.x === dumpEffect.offset!.x && sh.y === dumpEffect.offset!.y && sh.radius === dumpEffect.radius && sh.color === `#${dumpEffect.color!.hex}${alphaByte}`;
  }),
);
check(
  'canvas spec: pointer compiles to a shape node with per-variant constraints + rotation (top-right MAX/MIN rot0 · bottom-left MIN/MAX rot180 · left-center MIN/CENTER rot-90)',
  cTR?.absolute?.h === 'MAX' && cTR?.absolute?.right === 12 && cTR?.absolute?.top === -8 && (cTR?.shape?.rotation ?? 0) === 0 &&
    cBL?.absolute?.h === 'MIN' && cBL?.absolute?.left === 12 && cBL?.absolute?.bottom === -8 && cBL?.shape?.rotation === 180 &&
    cLC?.absolute?.v === 'CENTER' && cLC?.absolute?.left === -8 && cLC?.shape?.rotation === -90,
);
check(
  'canvas spec: the pointer-position=none variant compiles WITHOUT the shape node (suppressed)',
  shapeOf('pointer-position=none') === undefined,
);
check(
  'canvas spec: text nodes carry Semi Bold + lineHeight 16 (weight table + dump v1.3)',
  (() => {
    const t = (data.variants[0].spec.children ?? []).find((ch) => ch.type === 'text');
    return t?.fontStyle === 'Semi Bold' && t?.lineHeight === 16;
  })(),
);

let script = '';
try {
  script = emitFigmaScript(contract, { tokens: tokenTree, icons, contracts, mintedTokens: real.mintedTokens?.tree });
} catch (e) {
  check(`emitFigmaScript green — ${String(e).split('\n')[0]}`, false);
}
check(
  'sync script constructs a REAL polygon with native rotation + ABSOLUTE placement + DROP_SHADOW effect + PIXELS line height',
  ['figma.createPolygon()', 'node.rotation = -spec.shape.rotation', 'applyShapeAbsolute', "type: 'DROP_SHADOW'", "node.lineHeight = { unit: 'PIXELS', value: spec.lineHeight }"].every((m) => script.includes(m)),
);

// ---------------------------------------------------------------------------
// 6. Static HTML surface + receipts-not-silence
// ---------------------------------------------------------------------------
let htmlCss = '';
try {
  ({ css: htmlCss } = emitHtml(contract, { tokens: inventory, icons, contracts }));
} catch (e) {
  check(`emitHtml green — ${String(e).split('\n')[0]}`, false);
}
check(
  'emitHtml CSS: triangle + placements + none-suppression mirror the module CSS',
  htmlCss.includes('clip-path: polygon(50% 0%, 93.3013% 75%, 6.6987% 75%)') &&
    htmlCss.includes('.tooltip--pointerPosition-bottomLeft .tooltip__Pointer') &&
    htmlCss.includes('.tooltip--pointerPosition-none .tooltip__Pointer'),
);
check('zero UNBOUND leftovers (every raw literal minted or refused by name)', real.unbound.length === 0);
check(
  'the shadow note states the canvas surfaces PROJECT it (the v1 "no box-shadow projection" limit is retired)',
  real.notes.some((n) => n.includes('the canvas preview and the Figma sync script project it as a native DROP_SHADOW effect')),
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} Tooltip invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ all Tooltip owner-case invariants hold (shadow, pointer geometry, no-arrow, text channels, canvas)');
