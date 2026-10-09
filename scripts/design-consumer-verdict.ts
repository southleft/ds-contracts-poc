/**
 * One verdict per Figma variant, read from a design:consumer:check receipt, so
 * a loss is shown beside the variant it belongs to instead of among hundreds
 * of proposal notes. figma:to-react prints this table after it packages.
 *
 *   pass        the image is within the unchanged 5% limit on white AND black,
 *               the content check found every text and icon, each text drawn
 *               in its Figma color and font, and no problem names the variant
 *   fail        at least one problem names the variant (a missing text or
 *               icon, a text in another color or font, an image over the
 *               limit, a zero-size render, an inert or unreachable state, an
 *               unavailable font…)
 *   unverified  nothing failed, but something could not be measured (no Figma
 *               token, an image Figma did not export, framing refused). Never
 *               shown as a pass.
 *
 * A problem that names no variant (a discarded prop, an unmapped axis, a
 * runtime error, duplicate case keys) is a set problem: it fails the set.
 */

export const CONTENT_RULE = 'Every TEXT the Figma variant draws must appear in the rendered text (case and whitespace ignored, counted), and every icon or vector it draws must have a rendered graphic of about the same size (max(3 px, 35%) per side, matched one to one). The Figma side is the REST node tree at full depth; see scripts/design-consumer-content.ts.';
/** The text-style half of the content check (scripts/design-consumer-content.ts, "style"). */
export const TEXT_STYLE_RULE = 'Every drawn TEXT, located in the rendered text runs, must be drawn character by character in its Figma fill color (SOLID paints composited, times paint and layer opacity) within one 8-bit step (1/255) per channel and alpha of the rendered DECLARED computed color (text-fill color or SVG fill, times CSS opacity; never pixels), and in its Figma font family and numeric weight as REQUESTED by the first family of the computed font-family stack, exactly (an unavailable family is font-unavailable-in-consumer, not this). A non-solid Figma paint or a non-sRGB rendered color is text-style-unmeasured, never a pass.';

/** A problem that says a measurement could not be made: never a pass, never a product failure. */
export const UNMEASURED = /^(figma-images-unavailable|figma-image-missing:|image-framing-unqualified:|image-score-unavailable:|content-size-unmeasured:|content-check-unavailable:|content-unmeasured:|text-style-unmeasured:)/;

/** The problem an aborted check records. Figma answering 429 or 5xx after the
 *  retries (bounds read, image download) is an unmade measurement, reported
 *  as unavailable images; anything else is a failed check. */
export function checkFailureProblem(message: string): string {
  return /^figma-(bounds-unavailable:[a-z]+|image-download-failed:[0-9;:-]+):HTTP (429|5\d\d)$/.test(message)
    ? 'figma-images-unavailable: ' + message : 'check-failed: ' + message;
}

export type Verdict = 'pass' | 'fail' | 'unverified';
export interface VariantVerdict {
  key: string; figmaName: string; verdict: Verdict;
  image: { white: number; black: number; withinLimit: boolean } | null;
  content: { texts: number; textsMissing: number; textStyleMismatches: number; parts: number; partsMissing: number } | null;
  reasons: string[];
}
export interface Verdicts { verdict: Verdict; variants: VariantVerdict[]; setProblems: string[]; counts: Record<Verdict, number> }

/** The case a problem names: `kind:<key>` or `kind:<key>:detail`, the earliest
 *  occurrence winning (a text payload may contain a colon), the longer key on a tie. */
export function problemCase(problem: string, keys: readonly string[]): string | null {
  let best: { key: string; at: number } | null = null;
  for (const key of keys) {
    let at = problem.indexOf(':' + key + ':');
    if (at < 0 && problem.endsWith(':' + key)) at = problem.length - key.length - 1;
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && key.length > best.key.length)) best = { key, at };
  }
  return best?.key ?? null;
}

export function variantVerdicts(receipt: any, cases: ReadonlyArray<{ key: string; figmaName: string }>): Verdicts {
  const keys = cases.map(c => c.key);
  const problems: string[] = (receipt.problems ?? []).map(String);
  const byCase = new Map<string, string[]>(keys.map(k => [k, []]));
  const setProblems: string[] = [];
  for (const p of problems) {
    const key = problemCase(p, keys);
    if (key) byCase.get(key)!.push(p); else setProblems.push(p);
  }
  const images = new Map<string, any>((receipt.images?.cases ?? []).map((c: any) => [c.key, c]));
  const contents = new Map<string, any>((receipt.content?.cases ?? []).map((c: any) => [c.key, c]));
  const variants: VariantVerdict[] = cases.map(c => {
    const reasons = byCase.get(c.key)!;
    const row = images.get(c.key), content = contents.get(c.key);
    const image = row?.layoutAligned?.status === 'measured'
      ? { white: row.layoutAligned.whiteMismatchPercent, black: row.layoutAligned.blackMismatchPercent, withinLimit: row.layoutAligned.withinLimit === true } : null;
    const failing = reasons.filter(r => !UNMEASURED.test(r));
    const verdict: Verdict = failing.length || (image && !image.withinLimit) ? 'fail'
      : !image || !content || reasons.length ? 'unverified' : 'pass';
    return { key: c.key, figmaName: c.figmaName, verdict, image,
      content: content ? { texts: content.texts.figma, textsMissing: content.texts.missing.length,
        textStyleMismatches: (content.texts.styles ?? []).filter((s: any) => s.color === 'mismatch' || s.font === 'mismatch').length,
        parts: content.parts.figma, partsMissing: content.parts.missing.length } : null,
      reasons };
  });
  const setFailing = setProblems.filter(p => !UNMEASURED.test(p));
  const counts = { pass: 0, fail: 0, unverified: 0 } as Record<Verdict, number>;
  for (const v of variants) counts[v.verdict]++;
  const verdict: Verdict = counts.fail || setFailing.length ? 'fail'
    : counts.unverified || setProblems.length || variants.length === 0 ? 'unverified' : 'pass';
  return { verdict, variants, setProblems, counts };
}

/** The per-variant table, one line per variant plus its reasons. */
export function formatVerdictTable(v: Verdicts): string[] {
  const label: Record<Verdict, string> = { pass: 'PASS', fail: 'FAIL', unverified: 'UNVERIFIED' };
  const width = Math.min(48, Math.max(8, ...v.variants.map(r => r.figmaName.length)));
  const lines = [`  ${'variant'.padEnd(width)}  result      image white/black   content (missing or wrong / drawn)`];
  for (const r of v.variants) {
    const image = r.image ? `${r.image.white.toFixed(2)}% / ${r.image.black.toFixed(2)}%` : 'not measured';
    const content = r.content ? `${r.content.textsMissing}/${r.content.texts} text, ${r.content.textStyleMismatches}/${r.content.texts} text style, ${r.content.partsMissing}/${r.content.parts} icons` : 'not measured';
    const name = r.figmaName.length > width ? r.figmaName.slice(0, width - 1) + '…' : r.figmaName;
    lines.push(`  ${name.padEnd(width)}  ${label[r.verdict].padEnd(10)}  ${image.padEnd(18)}  ${content}`);
    for (const reason of r.reasons) lines.push(`  ${''.padEnd(width)}    - ${reason}`);
  }
  if (v.setProblems.length) {
    lines.push('  set problems (every variant):');
    for (const p of v.setProblems) lines.push(`    - ${p}`);
  }
  return lines;
}
