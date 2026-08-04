/**
 * VIEWPORT-DERIVED GEOMETRY CHECK (task #20, defects A + B) — offline, no
 * browser, no capture.
 *
 *   npm run extract:computed:viewport:check
 *
 * WHAT WENT WRONG. The committed corpus shipped measurements of the CAPTURE
 * WINDOW as library design tokens:
 *
 *   imported.dialog.root.width      = 900px   (MUI)      = browser viewport width
 *   imported.modal.root.width       = 900px   (Carbon)   = browser viewport width
 *   imported.modal.root.height      = 1000px  (Carbon)   = browser viewport height
 *   imported.badge.label-2.bottom   = 799px   (Polaris)  = 800px window − a 1px box
 *   imported.menu.root.bottom       = 852px   (MUI)      = where the popover landed
 *
 * and the receipt that covered the first one named the wrong container: it
 * said "the captured stage width joins fusion" while the stage is 288px wide
 * and sits in a sibling subtree — the portaled root is a child of <body>.
 *
 * WHAT THIS CHECK PINS, over the COMMITTED captured-truth files (the capture
 * IS the truth; re-fusing it is deterministic and needs no Chromium):
 *
 *   1. REFUSED — every part whose box was laid out against the initial
 *      containing block loses the channels the window supplied, and the
 *      receipt quotes the arithmetic that proves it.
 *   2. UNCHANGED — an ordinary in-stage root still admits its width with the
 *      original stage receipt (MUI Card, 288px), and an absolutely-positioned
 *      part inside a POSITIONED ancestor keeps all four insets (the
 *      conformance case-position-absolute-insets fixture).
 *   3. THE FLOWBITE SHAPE — a display:block, position:static root that
 *      measures the window exactly (the @floating-ui `<div
 *      data-floating-ui-portal>` wrapper that flowbite-react mounts between
 *      <body> and the overlay) is refused too, via the block-root door.
 *      Synthesized here BY NAME from the committed MUI Dialog truth, because
 *      no committed library captures that wrapper.
 *
 * FALSIFICATION: revert either half of the fix in extract/computed/fuse.ts
 * (`viewportDerivedRefusals`, or the `!vpRefused` guard on `admit`) and
 * assertions 1 and 3 fail; over-apply it and assertion 2 fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, propSpaceFor, stageFor, type CaptureConfig, type ComponentConfig, type SweepResult } from './capture.js';
import { alignSweep, styledChannels, type FusionEnv } from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import type { CapturedNode } from './lib.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

interface Fused {
  styled: Map<string, Set<string>>;
  receipts: string[];
  env: FusionEnv;
  value: (part: string, channel: string) => string | undefined;
}

function fuse(
  configRel: string,
  outRel: string,
  componentName: string,
  mutate?: (root: CapturedNode) => void,
): Fused {
  const cfg: CaptureConfig = loadConfig(REPO, path.join(REPO, configRel));
  const comp = cfg.components.find((c: ComponentConfig) => c.name === componentName);
  if (!comp) throw new Error(`${configRel}: no component ${componentName}`);
  const truthPath = path.join(REPO, outRel, componentName.toLowerCase(), 'captured-truth.json');
  if (!existsSync(truthPath)) throw new Error(`no committed captured truth at ${truthPath}`);
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
  const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
  if (mutate) for (const c of captures) mutate(c.root);
  const space = propSpaceFor(REPO, cfg, comp);
  const sweep = {
    captures,
    controls: truth.controls,
    allProps: truth._provenance.channels,
    stylesheetSkips: [],
    browserVersion: String(truth._provenance.browser ?? 'committed'),
    fontChecks: {},
    pinnedAnimations: [],
    shadowHostTrails: {},
    textFillFolds: {},
    closedShadowSuspects: {},
  } as unknown as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
  const controlStyles = Object.fromEntries(
    Object.entries(truth.controls as Record<string, { style: Record<string, string> }>).map(([t, n]) => [t, n.style]),
  );
  const receipts: string[] = [];
  const env: FusionEnv = {
    viewport: cfg.browser.viewport,
    stage: stageFor(cfg, comp),
    portaled: comp.portalCapture === true,
  };
  const styled = styledChannels(aligned, space, controlStyles, truth._provenance.channels, receipts, env);
  const value = (part: string, channel: string): string | undefined => {
    const pi = aligned.partNames.indexOf(part);
    return pi < 0 ? undefined : aligned.baseFlat[pi].node.style[channel];
  };
  return { styled, receipts, env, value };
}

let failures = 0;
const ok = (label: string, detail: string): void => console.log(`  ok   ${label} — ${detail}`);
const bad = (label: string, detail: string): void => {
  failures++;
  console.log(`  FAIL ${label} — ${detail}`);
};

/** A channel that must NOT reach fusion, with the value it used to carry. */
function assertRefused(f: Fused, label: string, part: string, channels: string[], tag: string): void {
  const carried = channels.filter((c) => f.styled.get(part)?.has(c));
  const receipt = f.receipts.find((r) => r.startsWith(`${tag}: ${part} `) || r.startsWith(`${tag}: ${part}(`));
  if (carried.length > 0) {
    bad(label, `${part} still carries ${carried.map((c) => `${c}=${f.value(part, c)}`).join(', ')} into fusion`);
    return;
  }
  if (!receipt) {
    bad(label, `${part}: channels are gone but NO \`${tag}\` receipt names why (a silent drop is the defect this replaces)`);
    return;
  }
  const witness = /=\s*[\d.]+px\s*=\s*browser\.viewport\.(width|height)\s*\(\d+px\)/.test(receipt);
  if (!witness) {
    bad(label, `${part}: receipt carries no viewport arithmetic — "${receipt.slice(0, 160)}…"`);
    return;
  }
  ok(label, `${part} refuses ${channels.join('/')} (was ${channels.map((c) => f.value(part, c)).join('/')}) · ${receipt.slice(receipt.indexOf('—') + 2, receipt.indexOf('—') + 150)}…`);
}

function assertCarried(f: Fused, label: string, part: string, channels: string[], expect?: Record<string, string>): void {
  const missing = channels.filter((c) => !f.styled.get(part)?.has(c));
  if (missing.length > 0) {
    bad(label, `${part} LOST ${missing.join(', ')} — an ordinary in-stage measurement must be untouched by the viewport rule`);
    return;
  }
  for (const [c, v] of Object.entries(expect ?? {})) {
    if (f.value(part, c) !== v) {
      bad(label, `${part}.${c} = ${f.value(part, c)}, expected ${v}`);
      return;
    }
  }
  ok(label, `${part} still carries ${channels.map((c) => `${c}=${f.value(part, c)}`).join(', ')}`);
}

console.log('viewport-geometry-check — re-fusing COMMITTED captured truth (no browser)\n');

// --- 1. REFUSED: the two committed overlay roots that shipped the window ----
console.log('1. viewport-derived geometry is refused by name');
const dialog = fuse('extract/computed/configs/mui.json', 'extract/computed/out/mui', 'Dialog');
assertRefused(dialog, 'mui Dialog root (position:fixed; inset:0)', 'root', ['width', 'top', 'right', 'bottom', 'left'], 'viewport-derived-geometry-refused');
{
  const label = 'mui Dialog root block-root receipt';
  const refused = dialog.receipts.find((r) => r.startsWith('block-root-width-refused: root'));
  const admitted = dialog.receipts.find((r) => r.startsWith('block-root-width-admitted: root'));
  if (admitted) bad(label, 'the OLD receipt still fires: "the captured stage width joins fusion" over a 900px window measurement');
  else if (!refused) bad(label, 'neither the admission nor a named refusal fired — the block-root door went silent');
  else if (!refused.includes('NOT the stage content box')) bad(label, `the refusal does not distinguish the stage from the window: "${refused.slice(0, 160)}…"`);
  else ok(label, refused.slice(refused.indexOf('—') + 2, refused.indexOf('—') + 210) + '…');
}
const carbonModal = fuse('extract/computed/configs/carbon.json', 'extract/computed/out/carbon', 'Modal');
assertRefused(carbonModal, 'carbon Modal root (position:fixed; inset:0)', 'root', ['width', 'height', 'top', 'right', 'bottom', 'left'], 'viewport-derived-geometry-refused');
const badge = fuse('extract/computed/configs/polaris.json', 'extract/computed/out', 'Badge');
assertRefused(badge, 'polaris Badge sr-only span (absolute, no positioned ancestor)', 'label-2', ['top', 'right', 'bottom', 'left'], 'viewport-derived-geometry-refused');
const menu = fuse('extract/computed/configs/mui.json', 'extract/computed/out/mui', 'Menu');
assertRefused(menu, 'mui Menu popover placement', 'root', ['top', 'right', 'bottom', 'left'], 'viewport-derived-geometry-refused');
const fixedCase = fuse('conformance/conformance.config.json', 'extract/computed/out/conformance', 'CasePositionFixed');
assertRefused(fixedCase, 'conformance case-position-fixed', 'a', ['top', 'right', 'bottom', 'left'], 'viewport-derived-geometry-refused');

// --- 2. UNCHANGED: the in-stage / properly-contained controls ---------------
console.log('\n2. ordinary measurements are UNCHANGED (the rule does not overreach)');
const card = fuse('extract/computed/configs/mui.json', 'extract/computed/out/mui', 'Card');
assertCarried(card, 'mui Card in-stage block root', 'root', ['width'], { width: '288px' });
{
  const label = 'mui Card keeps the original stage receipt verbatim';
  const r = card.receipts.find((x) => x.startsWith('block-root-width-admitted: root'));
  const expected = 'block-root-width-admitted: root — display:block root fills its container in CSS; the captured stage width joins fusion (stage-dependent, receipted — the canvas card draws at the captured block width instead of hugging its text)';
  if (r !== expected) bad(label, `receipt text moved: "${String(r).slice(0, 160)}…"`);
  else if (card.env.stage.width - 2 * card.env.stage.padding !== 288) bad(label, `stage content box is ${card.env.stage.width - 2 * card.env.stage.padding}px, not the 288px the width matches`);
  else ok(label, 'byte-identical receipt, and the 288px width IS the stage content box (320 − 2×16)');
}
const insetsCase = fuse('conformance/conformance.config.json', 'extract/computed/out/conformance', 'CasePositionAbsoluteInsets');
assertCarried(insetsCase, 'conformance case-position-absolute-insets (contained by a positioned ancestor)', 'a', ['top', 'right', 'bottom', 'left'], { top: '4px', left: '6px', right: '102px', bottom: '32px' });

// --- 3. THE FLOWBITE SHAPE: a static block root that measures the window ----
console.log('\n3. the floating-ui portal wrapper shape (SYNTHETIC — derived from the committed MUI Dialog truth)');
{
  // flowbite-react mounts overlays through @floating-ui/react's FloatingPortal,
  // which inserts `<div data-floating-ui-portal>` between <body> and the
  // overlay: position:static, display:block, ZERO height, 900px wide because a
  // block box in normal flow takes its inline size from its containing block —
  // here the document body, whose content box is the window (`body{margin:0}`
  // on the capture page). The single-root portal policy hands THAT to fusion.
  // No committed library captures it, so the shape is synthesized from real
  // committed truth: the Dialog root, un-fixed and un-inset.
  const flowbiteish = fuse('extract/computed/configs/mui.json', 'extract/computed/out/mui', 'Dialog', (root) => {
    root.style['position'] = 'static';
    for (const p of ['top', 'right', 'bottom', 'left']) root.style[p] = 'auto';
    root.style['height'] = '0px';
    root.style['width'] = '900px';
  });
  const label = 'static block root, width == viewport.width, stage == 288px';
  const refused = flowbiteish.receipts.find((r) => r.startsWith('block-root-width-refused: root'));
  const carries = flowbiteish.styled.get('root')?.has('width');
  if (carries) bad(label, `the wrapper's 900px still reaches fusion — a Modal shipped from this lands on canvas the width of the browser window`);
  else if (!refused) bad(label, 'the width is gone with no named refusal');
  else if (!refused.includes('document body')) bad(label, `the refusal does not name the body/portal chain: "${refused.slice(0, 200)}…"`);
  else ok(label, refused.slice(refused.indexOf('—') + 2, refused.indexOf('—') + 230) + '…');
}

console.log(
  failures === 0
    ? '\nviewport-geometry-check: PASS — window measurements refused by name, library measurements untouched'
    : `\nviewport-geometry-check: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
