/**
 * THE REACT TO FIGMA CHECK (docs/GOAL.md "How numbers are counted").
 * Part 1, the set rule. React to Figma counts only a real component set. A Figma set written
 * from a library's component is held against the Storybook reader's references for
 * that component:
 *   - it is a COMPONENT_SET and every variant is a COMPONENT;
 *   - its variant properties are the story matrix exactly (matchesMatrix, capped at
 *     64 by the reader), rebuilt from each reference's value on each axis;
 *   - it uses auto layout outside drawings: none of the grammar classifier's own
 *     layout reasons (classifyDump), so a drawing is exempt exactly as there;
 *   - every text a reference draws is TEXT characters in its paired variant,
 *     normalized as the Figma to React check's missingTexts normalizes it.
 * A set that fails counts every expected variant as failed; it never leaves the
 * denominator. A reference the rule cannot read (no render, no content) leaves its
 * own variant unverified, also a failure, and the rule holds on every other one.
 * The share of visible solid paints bound to a variable, text fills included, is
 * reported and never gates.
 * Part 2, each variant of a set that counts, by GOAL.md's checks with the Figma to
 * React check's own code and its one image limit, the reference in the rendered
 * side's role: images within the limit on white and on black (alignRecordedFrames on
 * the reference's paint-extent frame and the plugin capture's), size within 2 px
 * (consumerSizeCheck), every graphic the reference draws present (matchParts), and
 * every text in its color and font (compareTextStyles). A face Figma lacks makes the
 * variant font-blocked (storyFontPreflight); a measurement not made is unverified.
 * Deterministic, no model call; frozen with the checker on 2026-11-20 (AGENTS.md rule 6).
 *
 * Run: npx tsx scripts/react-to-figma-check.ts --stories <stories.json> --component <title>
 *        --dump <the written set's plugin dump> --set <set name> --capture <its plugin capture> --out <dir>
 *      (FIGMA_TOKEN reads the written variants' content; references default to stories.json's folder)
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyDump } from '../extract/figma/grammar.js';
import type { DumpFile, DumpNode, DumpSet } from '../extract/figma/types.js';
import { matchesMatrix, type VariantMatrix } from '../extract/figma/variant-matrix.js';
import { alignPair, diffPair, readPng } from '../extract/figma/visual-parity/img.js';
import { figmaImagesFromCapture, type PluginCapture } from './design-consumer-capture.js';
import { consumerSizeCheck, IMAGE_LIMIT_PERCENT } from './design-consumer-check.js';
import { compareTextStyles, fetchFigmaContent, matchParts, missingTexts, type FigmaContentResult } from './design-consumer-content.js';
import { alignRecordedFrames } from './design-consumer-framing-v2.js';
import { UNMEASURED } from './design-consumer-verdict.js';
import { storyFontPreflight } from './font-preflight.js';
import type { StoryComponent, VariantReference } from './storybook-reader.js';

/** The grammar classifier's reasons that concern layout: a box with children and no auto layout that is not a
 *  drawing, a grid, a wrapping row, an absolutely placed child. */
export const LAYOUT_REASONS = ['absolute-child', 'free-form-frame', 'grid-layout', 'layout-wrap'];

export interface SetVariant { key: string; variant: Record<string, string>; verdict: 'pending' | 'pass' | 'fail' | 'unverified' | 'font-blocked'; reasons: string[];
  image?: { white: number; black: number } }
export interface SetRule { counts: boolean; problems: string[]; boundColors: { solid: number; bound: number }; variants: SetVariant[] }

const keyOf = (v: Record<string, string>, axes: readonly string[]) => axes.map((a) => `${a}=${v[a] ?? ''}`).join(', ');
const shown = (n: DumpNode) => n.hidden !== true && n.opacity !== 0;

/** The matrix the reader held the component's stories against, rebuilt from its references (in its order). */
export function storyMatrix(component: StoryComponent): VariantMatrix | undefined {
  if (component.matrix.status !== 'ok') return undefined;
  const axes = component.matrix.axes.map((name) => ({ name, options: [...new Set(component.references.map((r) => r.variant[name]!))] }));
  return { axes, variants: component.references.map((r) => r.variant) };
}

/** Every TEXT's characters the variant draws. */
function characters(n: DumpNode): string[] {
  if (!shown(n)) return [];
  return [...(n.type === 'TEXT' && n.text ? [n.text.characters] : []), ...(n.children ?? []).flatMap(characters)];
}

/** Visible SOLID fills and strokes on drawn nodes, text fills included, and how many are bound to a variable. */
export function boundColors(set: DumpSet): { solid: number; bound: number } {
  let solid = 0, bound = 0;
  const visit = (n: DumpNode) => {
    if (!shown(n)) return;
    for (const stack of [n.sourceFillStack, n.sourceStrokeStack]) for (const { paint } of stack?.paints ?? []) {
      const p = paint as { type?: unknown; visible?: unknown; boundVariables?: { color?: unknown } } | null;
      if (p?.type !== 'SOLID' || p.visible === false) continue;
      solid++;
      if (p.boundVariables?.color) bound++;
    }
    for (const c of n.children ?? []) visit(c);
  };
  for (const v of set.variants) visit(v);
  return { solid, bound };
}

/** Text drawn by the reference (opacity above zero), or why it cannot be read. */
function drawnTexts(r: VariantReference): string[] | string {
  if (r.problem) return r.problem;
  if (!r.content) return r.contentProblem ?? 'reference-content-missing';
  return (r.content.runs ?? []).filter((run) => run.opacity > 0).map((run) => run.text);
}

export function setRule(component: StoryComponent, file: DumpFile, setName: string): SetRule {
  const entry = Object.entries(file).find(([, v]) => (v as DumpSet | undefined)?.setName === setName && Array.isArray((v as DumpSet).variants));
  const set = entry?.[1] as DumpSet | undefined;
  const matrix = storyMatrix(component);
  const axes = component.matrix.status === 'ok' ? component.matrix.axes : [];
  const variants: SetVariant[] = component.references.map((r) => ({ key: keyOf(r.variant, axes), variant: r.variant, verdict: 'pending', reasons: [] }));
  if (!matrix) return { counts: false, problems: [`story-matrix-refused:${(component.matrix as { reason: string }).reason}`], boundColors: { solid: 0, bound: 0 }, variants };
  const problems: string[] = [];
  if (!set) problems.push(`set-missing:${setName}`);
  else {
    if (set.type !== 'COMPONENT_SET' || set.variants.some((v) => v.type !== 'COMPONENT')) problems.push('not-a-component-set');
    problems.push(...matchesMatrix(set, matrix));
    const reasons = classifyDump({ [entry![0]]: set } as DumpFile)[entry![0]]?.reasons ?? [];
    problems.push(...reasons.filter((r) => LAYOUT_REASONS.includes(r)).map((r) => `layout:${r}`));
    const written = new Map(set.variants.map((v) => [keyOf(v.variantProperties ?? {}, axes), v]));
    component.references.forEach((r, i) => {
      const texts = drawnTexts(r), node = written.get(variants[i]!.key);
      if (typeof texts === 'string') { variants[i]!.verdict = 'unverified'; variants[i]!.reasons.push(`text-unverified:${texts}`); return; }
      if (!node) return; // named once by matchesMatrix
      for (const t of missingTexts(texts, characters(node).join('\n'))) problems.push(`text-not-editable:${variants[i]!.key}:${JSON.stringify(t)}`);
    });
  }
  const counts = problems.length === 0;
  if (!counts) for (const v of variants) if (v.verdict === 'pending') { v.verdict = 'fail'; v.reasons.push('not-a-real-component-set'); }
  return { counts, problems: problems.sort(), boundColors: set ? boundColors(set) : { solid: 0, bound: 0 }, variants };
}

/** Part 2 (see the header): judge every variant still pending after the set rule. */
export function judgeVariants(component: StoryComponent, rule: SetRule, set: DumpSet, references: string,
  capture: PluginCapture & { figmaFonts?: Array<{ family: string; style: string }> }, content: FigmaContentResult, out: string): SetVariant[] {
  const axes = component.matrix.status === 'ok' ? component.matrix.axes : [];
  const written = new Map(set.variants.map((v) => [keyOf(v.variantProperties ?? {}, axes), v.nodeId!]));
  const blocked = new Set(storyFontPreflight([component], capture.figmaFonts ?? []).missing.flatMap((f) => f.variants)
    .filter((label) => label.startsWith(`${component.title} / `)).map((label) => Number(label.slice(component.title.length + 3))));
  const ids = rule.variants.map((v) => written.get(v.key)).filter((id): id is string => !!id);
  const images = figmaImagesFromCapture(capture, { setNodeId: set.nodeId }, ids, out);
  return rule.variants.map((v, i) => {
    if (v.verdict !== 'pending') return v;
    if (blocked.has(i)) return { ...v, verdict: 'font-blocked' as const, reasons: [`font-unavailable-in-figma:${v.key}`] };
    const r: VariantReference = component.references[i]!, id = written.get(v.key)!, key = v.key, problems: string[] = [];
    let image: SetVariant['image'];
    const file = images.files[id], frame = images.frames[id];
    if (!r.png || !r.frame) problems.push(`image-score-unavailable:${key}:${r.captureRefused ?? r.problem ?? 'no-reference-image'}`);
    else if (images.status !== 'figma-images-collected' || !file) problems.push(`figma-images-unavailable: ${images.reason ?? `figma-image-missing:${key}`}`);
    else {
      const refPath = path.join(references, r.png), refBytes = readFileSync(refPath), figmaBytes = readFileSync(file);
      const onWhite = alignRecordedFrames(refBytes, figmaBytes, r.frame, frame, 255), onBlack = alignRecordedFrames(refBytes, figmaBytes, r.frame, frame, 0);
      const refused = images.framingRefusal || ('refused' in onWhite ? onWhite.refused : 'refused' in onBlack ? onBlack.refused : null);
      if (refused || 'refused' in onWhite || 'refused' in onBlack) problems.push(`image-framing-unqualified:${key}:${refused}`);
      else {
        image = { white: diffPair(onWhite.aligned, []).unmaskedPct, black: diffPair(onBlack.aligned, []).unmaskedPct };
        if (image.white > IMAGE_LIMIT_PERCENT) problems.push(`layout-image-difference-above-limit:${key}:${image.white.toFixed(2)}%`);
        if (image.black > IMAGE_LIMIT_PERCENT) problems.push(`layout-image-difference-on-black-above-limit:${key}:${image.black.toFixed(2)}%`);
      }
      const aligned = alignPair(readPng(refPath), readPng(figmaBytes));
      problems.push(...consumerSizeCheck(key, !!image, { consumer: aligned.aContent, figma: aligned.bContent },
        { consumerBytes: refBytes, figmaBytes, consumer: r.frame, figma: frame, refusal: images.framingRefusal ?? undefined }).problems);
    }
    if (content.status !== 'collected') problems.push(`content-check-unavailable:${content.reason}`);
    else if (!r.content || !content.byNodeId[id]) problems.push(`content-unmeasured:${key}:${r.contentProblem ?? 'no-content'}`);
    else {
      const figma = content.byNodeId[id]!;
      for (const g of matchParts(r.content.graphics, figma.parts).missing) problems.push(`content-missing:${key}:part:${g.tag}@${Math.round(g.box.x)},${Math.round(g.box.y)}`);
      problems.push(...compareTextStyles(key, figma, r.content).problems);
    }
    const verdict = !problems.length ? 'pass' as const : problems.every((p) => UNMEASURED.test(p)) ? 'unverified' as const : 'fail' as const;
    return { ...v, verdict, reasons: problems, ...(image ? { image } : {}) };
  });
}

if (process.argv[1]?.endsWith('react-to-figma-check.ts')) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const [storiesPath, title, dumpPath, setName, capturePath, out] = ['--stories', '--component', '--dump', '--set', '--capture', '--out'].map(flag);
  if (!storiesPath || !title || !dumpPath || !setName || !capturePath || !out) {
    console.error('usage: npx tsx scripts/react-to-figma-check.ts --stories <stories.json> --component <title> --dump <dump.json> --set <name> --capture <capture.json> --out <dir>');
    process.exit(2);
  }
  const [storiesBytes, dumpBytes, captureBytes] = [readFileSync(storiesPath), readFileSync(dumpPath), readFileSync(capturePath)];
  const component = (JSON.parse(storiesBytes.toString()) as { components: StoryComponent[] }).components.find((c) => c.title === title);
  if (!component) { console.error(`✖ no component titled ${JSON.stringify(title)} in ${storiesPath}`); process.exit(2); }
  const file = JSON.parse(dumpBytes.toString()) as DumpFile, rule = setRule(component, file, setName);
  const set = Object.values(file).find((v) => (v as DumpSet | undefined)?.setName === setName) as DumpSet | undefined;
  const capture = JSON.parse(captureBytes.toString()) as PluginCapture;
  mkdirSync(out, { recursive: true });
  if (rule.counts && set) {
    const ids = set.variants.map((v) => v.nodeId!).filter(Boolean);
    const content = capture.fileKey ? await fetchFigmaContent(capture.fileKey, ids, process.env.FIGMA_TOKEN, out) : { status: 'unavailable' as const, reason: 'no fileKey in capture' };
    rule.variants = judgeVariants(component, rule, set, flag('--references') ?? path.join(path.dirname(storiesPath), 'references'), capture, content, out);
  }
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const counts = Object.fromEntries(['pass', 'fail', 'unverified', 'font-blocked'].map((k) => [k, rule.variants.filter((v) => v.verdict === k).length]));
  writeFileSync(path.join(out, 'react-to-figma.json'), JSON.stringify({ version: 1, component: title, set: setName,
    inputs: { stories: sha(storiesBytes), dump: sha(dumpBytes), capture: sha(captureBytes) }, verdicts: counts, ...rule }, null, 2) + '\n');
  const { solid, bound } = rule.boundColors;
  console.log(`${title} → ${setName}: ${rule.counts ? 'a real component set' : `not counted (${rule.problems.length} problem(s))`}; ` +
    `${rule.variants.length} expected variant(s), ${JSON.stringify(counts)}; colors bound to variables ${bound} of ${solid}`);
  for (const p of rule.problems) console.log(`  ${p}`);
  for (const v of rule.variants) if (v.verdict !== 'pass') console.log(`  ${v.key}: ${v.verdict}${v.reasons.length ? ' — ' + v.reasons.join('; ') : ''}`);
  process.exit(rule.variants.every((v) => v.verdict === 'pass') ? 0 : 1);
}
