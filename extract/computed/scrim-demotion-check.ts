/**
 * THE FULL-BLEED SCRIM DEMOTION — `npm run scrim-demotion:check`.
 *
 * WHY THIS EXISTS. A portaled overlay root is not the component's visual box.
 * A modal mounts a viewport-covering LAYER; the thing a designer means by "the
 * Modal" is the dialog inside it. Capture the layer and every downstream
 * measurement is of the browser window: task #20 measured a Flowbite Modal
 * shipping `root.width = 900px` — the viewport — where the dialog is 448.
 *
 * TWO LIBRARIES, TWO SHAPES, AND THE FIRST CUT KNEW ONLY ONE.
 *   MUI       the fixed layer draws NOTHING and carries >= 2 children (an
 *             invisible Backdrop, focus sentinels, the paper). Demotion picks
 *             the single boxed child.
 *   Flowbite  the fixed layer PAINTS THE SCRIM ITSELF and nests exactly ONE
 *             child. Both of the original tests (`capturedDrawsBox(n)` and
 *             `kids.length < 2`) refused it, so the captured root stayed the
 *             900x1000 layer.
 *
 * THE DISCRIMINATOR IS THE PAINT, NOT THE CHILD COUNT. A layer whose only
 * paint is a SEMI-TRANSPARENT fill is a scrim; a component's own box is not,
 * because a full-bleed opaque fill — or any fill with a border or a shadow —
 * is a surface. That rule is what this file pins, in both directions.
 *
 * THE FIXTURES ARE MEASURED, NOT INVENTED. The Flowbite shape is the one
 * recorded live in task #20: layer 900x1000 `position: fixed; inset: 0`,
 * background `oklab(0.210081 -0.00294439 -0.0316202 / 0.5)` (Tailwind gray-900
 * at half alpha — every alpha-modified v4 utility compiles to this spelling),
 * single child `div.relative` 448x173 painting nothing, then the panel 416x141
 * in white. The MUI shape is its committed captured-truth.
 *
 * Pure functions over CapturedNode. No browser, no capture data.
 */
import { demoteFullBleedScrim } from './capture.js';
import type { CapturedNode } from './lib.js';

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

const node = (
  tag: string,
  classes: string[],
  style: Record<string, string>,
  kids: CapturedNode[] = [],
): CapturedNode =>
  ({
    tag,
    classes,
    style: { position: 'static', 'background-color': 'rgba(0, 0, 0, 0)', ...style },
    nodes: kids.map((el) => ({ t: 'el', el })),
  }) as unknown as CapturedNode;

const FULL_BLEED = { position: 'fixed', top: '0px', right: '0px', bottom: '0px', left: '0px' };

console.log('\n1. FLOWBITE — the layer paints the scrim itself and nests ONE child');
{
  const panel = node('div', ['bg-white', 'rounded-lg'], { 'background-color': 'rgb(255, 255, 255)', width: '416px', height: '141px' });
  const wrapper = node('div', ['relative', 'h-full', 'w-full', 'p-4'], { width: '448px', height: '173px' }, [panel]);
  const layer = node('div', ['fixed', 'inset-0', 'z-50'], {
    ...FULL_BLEED,
    'background-color': 'oklab(0.210081 -0.00294439 -0.0316202 / 0.5)',
    width: '900px', height: '1000px',
  }, [wrapper]);

  const r = demoteFullBleedScrim(layer);
  if (!r) bad('the flowbite shape was REFUSED — the captured root stays the 900x1000 layer and the Modal ships the browser window as its width (this is task #20 finding 3)');
  else if (r.root !== panel) bad(`demotion picked the wrong node: expected the 416x141 panel, got <${r.root.tag} class="${r.root.classes.join(' ')}">`);
  else ok('scrim-painting layer with one transparent wrapper → demoted to the panel');
}

console.log('\n2. MUI — the original shape still works (no regression)');
{
  const backdrop = node('div', ['MuiBackdrop-root', 'MuiBackdrop-invisible'], { ...FULL_BLEED });
  const sentinel = node('div', [], { width: '0px', height: '0px' });
  const paper = node('div', ['MuiDialog-paper'], { 'background-color': 'rgb(255, 255, 255)', width: '444px', height: '104px' });
  const layer = node('div', ['MuiDialog-root'], { ...FULL_BLEED, width: '900px', height: '1000px' }, [backdrop, sentinel, paper]);

  const r = demoteFullBleedScrim(layer);
  if (!r) bad('the MUI shape was refused — this is a REGRESSION: a layer that draws nothing with >=2 children is the case the demotion was written for');
  else if (r.root !== paper) bad(`MUI demotion picked <${r.root.tag} class="${r.root.classes.join(' ')}"> instead of the paper`);
  else ok('non-painting layer with a separate Backdrop → demoted to the paper');
}

console.log('\n3. NO OVER-APPLICATION — a layer that is not a scrim keeps its root');
{
  // An OPAQUE full-bleed fill is a surface, not a scrim. Demoting it would
  // throw away the component the designer drew.
  const child = node('div', ['card'], { 'background-color': 'rgb(240, 240, 240)', width: '300px', height: '80px' });
  const opaque = node('div', ['page'], { ...FULL_BLEED, 'background-color': 'rgb(255, 255, 255)' }, [child]);
  if (demoteFullBleedScrim(opaque)) bad('an OPAQUE full-bleed layer was demoted — a solid fill covering the viewport is a surface, and its own box is the component');
  else ok('opaque full-bleed fill → not a scrim, root kept');

  // A translucent fill that ALSO carries a border or shadow is a real surface.
  const bordered = node('div', ['sheet'], { ...FULL_BLEED, 'background-color': 'rgba(0, 0, 0, 0.5)', 'border-top-width': '1px' }, [child]);
  if (demoteFullBleedScrim(bordered)) bad('a translucent layer WITH A BORDER was demoted — a border makes it a surface, not a scrim');
  else ok('translucent + border → not a scrim, root kept');

  const shadowed = node('div', ['sheet'], { ...FULL_BLEED, 'background-color': 'rgba(0, 0, 0, 0.5)', 'box-shadow': '0 2px 4px rgba(0,0,0,0.2)' }, [child]);
  if (demoteFullBleedScrim(shadowed)) bad('a translucent layer WITH A SHADOW was demoted');
  else ok('translucent + shadow → not a scrim, root kept');

  // A scrim whose only boxed descendant is ITSELF full-bleed has no dialog to
  // demote to — refusing is right, because picking it would change nothing.
  const fullBleedChild = node('div', ['sheet'], { ...FULL_BLEED, 'background-color': 'rgb(255, 255, 255)' });
  const scrimOverFullBleed = node('div', ['scrim'], { ...FULL_BLEED, 'background-color': 'rgba(0, 0, 0, 0.5)' }, [fullBleedChild]);
  if (demoteFullBleedScrim(scrimOverFullBleed)) bad('demoted to a child that is ITSELF full-bleed — the measurement would still be the window');
  else ok('scrim over a full-bleed child → refused, nothing gained by demoting');

  // Not fixed, not inset-0 → never a candidate (Tooltip's popper).
  const popper = node('div', ['popper'], { position: 'absolute', 'background-color': 'rgba(0, 0, 0, 0.5)' }, [child]);
  if (demoteFullBleedScrim(popper)) bad('an absolutely-positioned popper was demoted — only a fixed, inset-0 layer is a candidate');
  else ok('absolute popper → never a candidate');
}

console.log('\n4. THE ALPHA IS READ, NOT ASSUMED');
{
  const child = node('div', ['d'], { 'background-color': 'rgb(255, 255, 255)', width: '300px', height: '80px' });
  const mk = (bg: string) => node('div', ['l'], { ...FULL_BLEED, 'background-color': bg }, [child]);
  if (!demoteFullBleedScrim(mk('rgba(0, 0, 0, 0.5)'))) bad('rgba with alpha 0.5 was not read as a scrim');
  else ok('rgba(…, 0.5) → scrim');
  if (!demoteFullBleedScrim(mk('oklab(0.21 -0.003 -0.032 / 50%)'))) bad('oklab with a PERCENT alpha was not read as a scrim');
  else ok('oklab(… / 50%) → scrim');
  if (demoteFullBleedScrim(mk('rgba(0, 0, 0, 1)'))) bad('alpha 1 was read as a scrim — that is opaque');
  else ok('alpha 1 → not a scrim');
  if (demoteFullBleedScrim(mk('color(srgb 0 0 0 / 0.5)'))) bad('an UNPARSEABLE colour was read as a scrim — refuse rather than guess');
  else ok('unparseable colour → refused, not guessed');
}

if (failures.length > 0) {
  console.error(`\n✘ scrim demotion: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ scrim demotion: both overlay shapes demote to the dialog, and a layer that is a surface rather than a scrim keeps its root.');
