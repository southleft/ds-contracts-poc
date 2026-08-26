/**
 * THE CONTROL BASELINE, AND WHAT A REFUSAL MAY CLAIM — `npm run ua-baseline:check`.
 *
 * WHY THIS EXISTS. The styled-channel door admits a channel when it DIFFERS
 * FROM THE CONTROL for that part's tag: the harness renders a bare element per
 * tag inside the same page, with the library's own CSS loaded, so the control
 * subtracts both the user agent's defaults AND the library's global reset. That
 * is the right instrument — but the harness renders controls for FOUR tags
 * (capture.ts CONTROL_TAGS: button/span/a/div) and every other tag falls back
 * to the <span> control.
 *
 * MEASURED over the committed corpus: 147 of 403 captured parts (36.5%), across
 * 21 tags, fall back. For those the difference from the control may be the USER
 * AGENT's rather than the library's — a <td> measured against a <span> reports
 * `unicode-bidi: isolate`, `border-collapse: collapse` and
 * `vertical-align: middle`, which are the UA's own table defaults and which no
 * design system authored. 138 of the 351 "no schema channel today" refusals sit
 * on such a part. The refusal is unchanged (nothing is carried either way), but
 * the receipt now says the baseline was unreliable, so nobody reads it as
 * evidence the library declared something the browser did.
 *
 * SEPARATELY: 14 of those 351 are CSS CUSTOM PROPERTIES, and the old receipt was
 * factually WRONG about them. It blamed "value shape outside mintable kinds
 * (color/px/number/shadow/gradient)" — but `--cds-border-subtle` is `#c6c6c6`
 * (a colour) and `--tw-shadow` is `0 4px 6px -1px rgb(0 0 0 / 0.1), …` (a
 * shadow), and both kinds are mintable. They are the library's own token
 * plumbing observed on the element (Carbon's `--cds-*` ARE Carbon's tokens,
 * already in its token system), not styled facts of the component. They now say
 * so.
 *
 * NOT FIXED HERE, and named rather than implied: widening CONTROL_TAGS is the
 * real repair and it is a CAPTURE change — the control must be rendered inside
 * the harness with the library's CSS, and hosted tags (<td> needs a <table>,
 * <li> a <ul>, <path> an <svg>) need a host context plus an inner-element
 * selector, because captureJs picks the container's first rendering child. It
 * cannot be priced offline: regate replays committed truth, which has no new
 * control. Queued in docs/HANDOFF.md.
 *
 * Re-fuses every committed captured-truth through the live engine. No browser.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL_TAGS, HARNESS_STAGE_STYLE_JS, controlStageCss, uaBaselinePageHtml, loadConfig, propSpaceFor, stageFor, type CaptureConfig, type ComponentConfig, type SweepResult } from './capture.js';
import { CONTROL_TAGS_MIRROR, resetSuppliedBorderStyle, alignSweep, styledChannels, detectFolds, enrichLayout, prepareMint, uaStyles } from './fuse.js';
import { promoteAnatomy } from './anatomy.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { kebab } from '../types.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG_DIR = path.join(REPO, 'extract/computed/configs');
const OUT_FOR: Record<string, string> = {
  'polaris.json': 'extract/computed/out', 'polaris-depth.json': 'extract/computed/out',
  'mui.json': 'extract/computed/out/mui', 'carbon.json': 'extract/computed/out/carbon',
  'altitude.json': 'extract/computed/out/altitude', 'astryx.json': 'extract/computed/out/astryx',
  'tailwind.json': 'extract/computed/out/tailwind',
  'fluent.json': 'extract/computed/out/fluent', 'shadcn.json': 'extract/computed/out/shadcn',
  'antd.json': 'extract/computed/out/antd',
};

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

console.log('\n1. the mirrored tag list matches capture.ts — one rule, two files');
{
  // fuse.ts cannot import capture.ts (playwright + node:fs; fusion runs offline
  // in regate, the eval lane and every check here), so CONTROL_TAGS is restated
  // there. An undetected divergence would silently change which refusals get
  // the unreliable-baseline qualifier, so the duplication is gated rather than
  // trusted.
  const real = [...CONTROL_TAGS].sort();
  const mirror = [...CONTROL_TAGS_MIRROR].sort();
  if (JSON.stringify(real) !== JSON.stringify(mirror)) {
    bad(`fuse.ts CONTROL_TAGS_MIRROR ${JSON.stringify(mirror)} != capture.ts CONTROL_TAGS ${JSON.stringify(real)} — the qualifier would fire on the wrong parts, in whichever direction the lists drifted.`);
  } else ok(`CONTROL_TAGS_MIRROR == CONTROL_TAGS (${real.join(', ')})`);
}

console.log('\n1b. the UA baseline page renders the control in the SAME box the harness does');
{
  // THE BASELINE IS ONLY A BASELINE IF IT SHARES THE HARNESS'S STAGE.
  // `fuse.control-element-delta` subtracts the UA control from the component,
  // so any difference between the two boxes lands in the contract as a fact of
  // the component. The harness writes the box as a JS object literal inside its
  // bundled page (`HARNESS_STAGE_STYLE_JS`); the UA baseline page writes it as
  // CSS text (`controlStageCss`). Two spellings of one box is the shape of
  // defect the portal page's LOCKSTEP comment is about, so they are held
  // together here — parsed, not restated a third time.
  const st = { width: 320, height: 96, padding: 16 };
  const css = new Map(
    controlStageCss(st).split(';').map((d) => {
      const i = d.indexOf(':');
      return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const;
    }),
  );
  const kebab = (k: string): string => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const px = new Set(['width', 'height', 'padding']);
  // the NON-block branch of stageStyle: display flex + alignItems flex-start.
  const js = new Map<string, string>([['display', 'flex'], ['align-items', 'flex-start']]);
  for (const m of HARNESS_STAGE_STYLE_JS.matchAll(/(\w+):\s*(?:st\.(\w+)|'([^']*)')/g)) {
    const key = kebab(m[1]);
    if (key === 'display') continue; // the ternary, pinned above
    if (m[2]) { js.set(key, px.has(m[2]) ? `${st[m[2] as 'width' | 'height' | 'padding']}px` : String(st[m[2] as 'width']));
    } else if (m[3] !== undefined && m[3] !== 'block') js.set(key, m[3]);
  }
  const diffs: string[] = [];
  for (const [k, v] of js) if (css.get(k) !== v) diffs.push(`${k}: harness ${JSON.stringify(v)} vs UA baseline page ${JSON.stringify(css.get(k) ?? null)}`);
  for (const k of css.keys()) if (!js.has(k)) diffs.push(`${k}: present on the UA baseline page and ABSENT from the harness stage`);
  if (diffs.length > 0) {
    bad(`the UA baseline page's control box differs from the harness stage — every difference is subtracted from the component as if it were a user-agent default:\n      ${diffs.join('\n      ')}`);
  } else ok(`controlStageCss == HARNESS_STAGE_STYLE_JS on all ${js.size} declarations (${[...js.keys()].sort().join(', ')})`);
  // And the page itself must carry nothing else: no library sheet, no font
  // face, no provider. The whole point is the absence.
  const page = uaBaselinePageHtml({ stage: st, colorScheme: 'light' });
  const strayTags = [...page.matchAll(/<(script|link|style)\b/g)].map((m) => m[1]);
  if (strayTags.filter((t) => t !== 'style').length > 0 || strayTags.filter((t) => t === 'style').length !== 1) {
    bad(`the UA baseline page carries ${strayTags.join('/')} — it must carry exactly one <style> (color-scheme + body margin) and nothing else, or it is not a user-agent baseline`);
  } else ok('the UA baseline page carries exactly one <style> (color-scheme + body margin) and no script/link — no library CSS can reach the control');
}

console.log('\n2. the committed corpus re-fuses, and the split is what it is');
let custom = 0, fellBack = 0, plain = 0, comps = 0;
const skipped: string[] = [];
const tagsSeen = new Set<string>();
const uncontrolledParts = new Set<string>();
let allParts = 0;
const wrongClaim: string[] = [];
{
  for (const cfgFile of readdirSync(CFG_DIR).sort()) {
    if (!cfgFile.endsWith('.json')) continue;
    const cfg: CaptureConfig = loadConfig(REPO, path.join(CFG_DIR, cfgFile));
    // A config with no OUT_FOR entry gets its NAMESPACED dir, never the
    // un-namespaced root. The old `?? 'extract/computed/out'` fallback was a
    // silent misattribution: the root also holds the FIRST-PARTY component
    // dirs (button/, badge/, avatar/, checkbox/, textfield/, spinner/), so a
    // brand-new config whose component names collide with those re-fused
    // another library's captured truth and failed with "base capture missing".
    // Every committed config is mapped explicitly above, so their resolution
    // is unchanged; an uncaptured config now simply has no truth file and is
    // skipped by the existsSync below.
    const outRoot = path.join(REPO, OUT_FOR[cfgFile] ?? `extract/computed/out/${cfgFile.replace(/\.json$/, '')}`);
    for (const comp of cfg.components as ComponentConfig[]) {
      const dir = path.join(outRoot, comp.name.toLowerCase());
      const truthPath = path.join(dir, 'captured-truth.json');
      if (!existsSync(truthPath)) continue;
      try {
        const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
        const space = propSpaceFor(REPO, cfg, comp);
        const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
        const sweep = {
          captures, controls: truth.controls, allProps: truth._provenance.channels,
          stylesheetSkips: [], browserVersion: String(truth._provenance.browser ?? 'committed'),
          fontChecks: {}, pinnedAnimations: [], shadowHostTrails: {}, textFillFolds: {}, closedShadowSuspects: {},
        } as unknown as SweepResult;
        const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
        const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
        const svgConsumed = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
        const controlStyles = Object.fromEntries(Object.entries(truth.controls).map(([t, n]) => [t, (n as { style: Record<string, string> }).style]));
        const uaControlStyles = uaStyles(truth);
        const styled = styledChannels(aligned, space, controlStyles, sweep.allProps, [], {
          viewport: cfg.browser.viewport, stage: stageFor(cfg, comp), portaled: comp.portalCapture === true,
        }, uaControlStyles);
        const folds = detectFolds(aligned, styled);
        const layout = enrichLayout(aligned, space, styled, promotion.contract);
        const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumed, new Set(promotion.partIndex.keys()));
        comps++;
        const tagOf = new Map<string, string>();
        for (const a of (truth as unknown as { anatomy: Array<{ part: string; tag?: string }> }).anatomy ?? []) {
          if (!a.tag) continue;
          tagOf.set(a.part, a.tag);
          allParts++;
          tagsSeen.add(a.tag);
          if (!CONTROL_TAGS_MIRROR.has(a.tag)) uncontrolledParts.add(`${comp.name}:${a.part}`);
        }
        for (const c of (prep.codeOnly ?? []) as Array<{ reason: string; channel: string; part: string }>) {
          const r = String(c.reason);
          if (r.includes('CSS custom property, not a styled channel')) {
            custom++;
            if (!c.channel.startsWith('--')) bad(`the custom-property receipt fired on \`${c.channel}\`, which is not a custom property`);
            continue;
          }
          if (!r.includes('no schema channel today')) continue;
          const tag = tagOf.get(c.part);
          const qualified = r.includes('UNRELIABLE BASELINE');
          if (qualified) fellBack++; else plain++;
          // The qualifier must track the TAG, not a guess.
          if (tag && !CONTROL_TAGS_MIRROR.has(tag) && !qualified) wrongClaim.push(`${comp.name}:${c.part}.${c.channel} is a <${tag}> (no control) but the refusal does NOT say the baseline was unreliable`);
          if (tag && CONTROL_TAGS_MIRROR.has(tag) && qualified) wrongClaim.push(`${comp.name}:${c.part}.${c.channel} is a <${tag}> (HAS a control) but the refusal claims the baseline was unreliable`);
        }
      } catch (e) { skipped.push(`${cfgFile}/${comp.name}: ${(e as Error).message.slice(0, 110)}`); }
    }
  }
  if (skipped.length > 0) {
    bad(`${skipped.length} component(s) failed to re-fuse — the counts below are NOT a denominator:\n      ${skipped.join('\n      ')}`);
  } else ok(`all ${comps} committed components re-fused offline, 0 skipped`);
  if (comps < 50) bad(`only ${comps} components re-fused — a check that passes because it compared almost nothing is the defect this repo keeps finding`);
  const total = custom + fellBack + plain;
  if (total === 0) bad('the "no schema channel today" family is EMPTY — either the corpus moved or the classifier broke');
  else ok(`family total ${total} = ${custom} custom-property + ${fellBack} unreliable-baseline + ${plain} trustworthy-baseline`);
}

console.log('\n3. every refusal claims only what the baseline supports');
{
  if (wrongClaim.length > 0) bad(`${wrongClaim.length} refusal(s) mis-state their baseline:\n      ${wrongClaim.slice(0, 6).join('\n      ')}`);
  else ok('the unreliable-baseline qualifier appears on exactly the parts whose tag has no control');
  if (custom === 0) bad('ZERO custom-property refusals — the corpus carries 14; the classifier is not firing');
  else ok(`${custom} CSS custom properties no longer claim "value shape outside mintable kinds" (that reason is false for a #hex and a shadow)`);
  if (fellBack === 0) bad('ZERO unreliable-baseline qualifiers — the corpus has 138; the classifier is not firing');
  else ok(`${fellBack} refusals name the <span>-control fallback instead of implying the library authored the value`);
}

console.log('\n4. the fallback is real and worth naming — the census that motivates it');
{
  const unc = [...tagsSeen].filter((t) => !CONTROL_TAGS_MIRROR.has(t)).sort();
  if (unc.length === 0) bad('no uncontrolled tags found in the corpus — either every tag now has a control (then delete this gate) or the tag census broke');
  else ok(`${uncontrolledParts.size} of ${allParts} captured parts sit on ${unc.length} tag(s) with no control: ${unc.map((t) => `<${t}>`).join(' ')}`);
  if (uncontrolledParts.size > 0 && fellBack === 0) bad('parts fall back to the <span> control but no refusal says so');
}

console.log('\n5. the reset-supplied border style — a fact the control correctly subtracts and the emitter cannot reproduce');
{
  // The control is rendered with the library's OWN stylesheet loaded, so it
  // subtracts the library's reset as well as the UA's. That is right for
  // deciding what the COMPONENT authored — and wrong for emission, because the
  // emitted CSS reproduces the component's rules and not the reset. A border
  // whose `style` comes from Tailwind preflight's `* { border-style: solid }`
  // therefore ships its width and colour and paints NOTHING.
  //
  // Exactly two roots in the corpus are in this shape, and they are the two an
  // earlier cruder fix improved before it was reverted for regressing two
  // others. Pin the discriminator, not the outcome.
  const style = { 'border-top-style': 'solid', 'border-top-width': '1px' };
  const ctrlSolid = { 'border-top-style': 'solid', 'border-top-width': '0px' };
  if (!resetSuppliedBorderStyle('border-top-style', style, ctrlSolid)) {
    bad('a 1px border whose style EQUALS the control (reset-supplied) was NOT admitted — tailwind/card and astryx/card would ship a border that paints nothing');
  } else ok('reset-supplied border-style on a real border → admitted');

  // altitude Chip/Button: style DIFFERS from the control, so the ordinary door
  // already carries it. Admitting again here would double-handle it.
  if (resetSuppliedBorderStyle('border-top-style', { 'border-top-style': 'none', 'border-top-width': '0px' }, { 'border-top-style': 'outset', 'border-top-width': '2px' })) {
    bad('a style that DIFFERS from the control was admitted by the reset door — that is the ordinary door\'s job, and altitude Chip/Button live here');
  } else ok('style differing from the control → left to the ordinary door');

  // Every clause is load-bearing.
  if (resetSuppliedBorderStyle('border-top-style', { 'border-top-style': 'solid', 'border-top-width': '0px' }, ctrlSolid)) {
    bad('a ZERO-width border was admitted — there is no border to paint, so the style is not load-bearing');
  } else ok('zero width → not admitted');
  if (resetSuppliedBorderStyle('border-top-style', { 'border-top-style': 'none', 'border-top-width': '1px' }, { 'border-top-style': 'none' })) {
    bad('style `none` was admitted — nothing paints either way');
  } else ok('style none → not admitted');
  if (resetSuppliedBorderStyle('border-top-color', { 'border-top-color': 'red', 'border-top-width': '1px' }, { 'border-top-color': 'red' })) {
    bad('a non-style channel was admitted by the border-style door');
  } else ok('only border-*-style passes this door');
}

if (failures.length > 0) {
  console.error(`\n✘ control-baseline honesty: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✔ control baseline: the mirrored tag list matches capture.ts, ${comps} components re-fuse offline, and every "no schema channel today" refusal states whether its baseline was the right tag's control or the <span> fallback.`);
