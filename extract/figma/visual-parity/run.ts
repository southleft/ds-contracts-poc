/**
 * VISUAL-PARITY GATE — pixels as receipts.
 *
 *   npm run extract:figma:visual [-- subject-id …] [--refresh]
 *
 * Per subject: render the emit-html preview per variant combo in headless
 * Chromium (2x), fetch Figma's own render of the matching variant COMPONENT
 * node (images API, scale=2, disk-cached by node+file version), perceptually
 * diff (pixelmatch), and write:
 *
 *   out/<subject>/<variant>.triptych.png   ours | figma | diff
 *   out/<subject>/<variant>.ours.png       raw screenshot (debugging)
 *   REPORT.md                              ranked WORST-FIRST
 *   report-assets/                         the worst-10 triptychs (committed)
 *
 * Both scores (unmasked + text-masked) print per variant next to the
 * threshold — no silent tolerance anywhere. Skips, refusals, and API
 * declines are rows, not omissions.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { composeSubject, type RenderablePackage } from './compose.js';
import { fetchNodePngs, fetchSetInfos, type SetInfo } from './figma-api.js';
import { alignPair, diffPair, meanInk, readPng, writeTriptych, type Aligned, type DiffResult } from './img.js';
import { planVariant, variantSlug } from './match.js';
import { launchBrowser, renderVariant } from './render.js';
import { PARITY_SUBJECTS, type ParitySubject } from './subjects.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const OUT = path.join(HERE, 'out');
const CACHE = path.join(OUT, '_cache');
const ASSETS = path.join(HERE, 'report-assets');

/** Provisional gate line — printed next to every score, never applied silently. */
const THRESHOLD_PCT = 2.0;

interface Row {
  subject: string;
  variant: string;
  status: 'diffed' | 'skipped' | 'refused' | 'figma-declined';
  unmaskedPct?: number;
  maskedPct?: number | null;
  maskCoveragePct?: number;
  sizeOurs?: string;
  sizeFigma?: string;
  interaction?: string;
  diagnosis: string;
  triptych?: string;
  notes: string[];
}

const pct = (v: number | null | undefined): string => (v === undefined || v === null ? '—' : `${v.toFixed(2)}%`);

function diagnose(aligned: Aligned, diff: DiffResult): string {
  const parts: string[] = [];
  const dw = aligned.aContent.width - aligned.bContent.width;
  const dh = aligned.aContent.height - aligned.bContent.height;
  if (Math.abs(dw) > 4 || Math.abs(dh) > 4) {
    parts.push(
      `size ours ${aligned.aContent.width}×${aligned.aContent.height} vs figma ${aligned.bContent.width}×${aligned.bContent.height} (Δ${dw}, Δ${dh} device px)`,
    );
  }
  if (
    diff.maskedPct !== null &&
    diff.unmaskedPct - diff.maskedPct > Math.max(1.5, diff.maskedPct)
  ) {
    parts.push('text raster/family delta dominates');
  }
  const inkA = meanInk(aligned.a);
  const inkB = meanInk(aligned.b);
  const inkDelta = (Math.abs(inkA.r - inkB.r) + Math.abs(inkA.g - inkB.g) + Math.abs(inkA.b - inkB.b)) / 3;
  if (inkDelta > 24) {
    const hex = (c: { r: number; g: number; b: number }) =>
      '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    parts.push(`overall ink differs (ours ${hex(inkA)} vs figma ${hex(inkB)})`);
  }
  if (diff.diffBox && diff.unmaskedPct > 0.05) {
    const b = diff.diffBox;
    const cx = (b.x + b.width / 2) / aligned.width;
    const cy = (b.y + b.height / 2) / aligned.height;
    const area = (b.width * b.height) / (aligned.width * aligned.height);
    if (area < 0.2) {
      const h = cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : 'center';
      const v = cy < 0.33 ? 'top' : cy > 0.67 ? 'bottom' : 'middle';
      parts.push(`diff localized ${v}-${h} (${b.width}×${b.height}px)`);
    }
  }
  if (parts.length === 0) {
    parts.push(diff.unmaskedPct < 0.5 ? 'near-identical' : 'diffuse delta — see triptych');
  }
  return parts.join('; ');
}

function receiptsLine(pkg: RenderablePackage): string {
  const r = pkg.receipts;
  const bits: string[] = [];
  if (r.sessionContracts.length > 0) bits.push(`session scope: ${r.sessionContracts.join(', ')}`);
  if (r.capturedCount > 0) bits.push(`${r.capturedCount} captured variables`);
  if (r.capturedShadowed.length > 0) bits.push(`${r.capturedShadowed.length} shadowed by repo tokens`);
  if (r.mintedCount > 0) bits.push(`${r.mintedCount} minted imported.*`);
  if (r.childStubs.length > 0) bits.push(`child stubs: ${r.childStubs.join(', ')}`);
  if (r.proposalNotes > 0) bits.push(`${r.proposalNotes} proposal notes`);
  return bits.join('; ') || 'repo tokens only';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const only = args.filter((a) => !a.startsWith('--'));
  const subjects = PARITY_SUBJECTS.filter((s) => only.length === 0 || only.includes(s.id));
  if (subjects.length === 0) throw new Error(`no subjects match: ${only.join(', ')}`);

  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });

  // One nodes call per fileKey (batched set ids), cached.
  const byFile = new Map<string, ParitySubject[]>();
  for (const s of subjects) byFile.set(s.fileKey, [...(byFile.get(s.fileKey) ?? []), s]);
  const setInfos = new Map<string, SetInfo>(); // `${fileKey}:${setId}`
  for (const [fileKey, subs] of byFile) {
    const infos = await fetchSetInfos(CACHE, fileKey, subs.map((s) => s.setNodeId), refresh);
    for (const [setId, info] of infos) setInfos.set(`${fileKey}:${setId}`, info);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });

  const rows: Row[] = [];
  const subjectMeta: Array<{ subject: ParitySubject; composition: string; fonts: string; version: string }> = [];
  const fontAvailability = new Map<string, boolean>();

  for (const subject of subjects) {
    console.log(`\n── ${subject.label} (${subject.id}) ──`);
    const info = setInfos.get(`${subject.fileKey}:${subject.setNodeId}`);
    if (!info) throw new Error(`${subject.id}: no set info for ${subject.setNodeId}`);

    let pkg: RenderablePackage;
    try {
      pkg = composeSubject(subject);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      console.log(`  compose/propose REFUSED — ${msg}`);
      rows.push({ subject: subject.id, variant: '(all)', status: 'refused', diagnosis: `proposal refused: ${msg}`, notes: [] });
      subjectMeta.push({ subject, composition: 'REFUSED', fonts: info.fontFamilies.join(', ') || '(none)', version: info.version });
      continue;
    }
    console.log(`  contract ${pkg.contract.id}; ${receiptsLine(pkg)}`);
    console.log(`  figma set "${info.setName}" v${info.version}: ${info.variants.length} variant(s); fonts: ${info.fontFamilies.join(', ') || '(none)'}`);
    subjectMeta.push({ subject, composition: receiptsLine(pkg), fonts: info.fontFamilies.join(', ') || '(none)', version: info.version });

    const pngs = await fetchNodePngs(
      CACHE, subject.fileKey, subject.setNodeId, info.version,
      info.variants.map((v) => v.nodeId),
    );
    const subjectOut = path.join(OUT, subject.id);
    mkdirSync(subjectOut, { recursive: true });

    for (const variant of info.variants) {
      const slug = variantSlug(variant.name);
      const plan = planVariant(pkg.contract, variant.name);
      if (!plan.ok) {
        console.log(`  ✗ ${variant.name}: SKIPPED — ${plan.reason}`);
        rows.push({ subject: subject.id, variant: variant.name, status: 'skipped', diagnosis: plan.reason, notes: [] });
        continue;
      }
      const figmaPngPath = pngs.get(variant.nodeId);
      if (!figmaPngPath) {
        console.log(`  ✗ ${variant.name}: images API declined to render the node`);
        rows.push({ subject: subject.id, variant: variant.name, status: 'figma-declined', diagnosis: 'images API returned null for the node', notes: plan.notes });
        continue;
      }
      let rendered: Awaited<ReturnType<typeof renderVariant>>;
      try {
        rendered = await renderVariant(page, pkg, plan.subst, plan.bools, plan.interaction, info.fontFamilies);
      } catch (e) {
        rendered = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (!rendered.ok) {
        const headline = rendered.error.split('\n').slice(0, 2).join(' ').trim();
        console.log(`  ✗ ${variant.name}: render refused — ${headline}`);
        rows.push({ subject: subject.id, variant: variant.name, status: 'refused', diagnosis: `render refused: ${headline}`, notes: plan.notes });
        continue;
      }
      for (const [f, ok] of Object.entries(rendered.fontChecks)) fontAvailability.set(f, ok);

      writeFileSync(path.join(subjectOut, `${slug}.ours.png`), rendered.png);
      const aligned = alignPair(readPng(rendered.png), readPng(figmaPngPath));
      const diff = diffPair(aligned, rendered.textRects);
      const triptychPath = path.join(subjectOut, `${slug}.triptych.png`);
      writeTriptych(triptychPath, aligned, diff.diff);

      const row: Row = {
        subject: subject.id,
        variant: variant.name,
        status: 'diffed',
        unmaskedPct: diff.unmaskedPct,
        maskedPct: diff.maskedPct,
        maskCoveragePct: diff.maskCoveragePct,
        sizeOurs: `${aligned.aContent.width}×${aligned.aContent.height}`,
        sizeFigma: `${aligned.bContent.width}×${aligned.bContent.height}`,
        interaction: plan.interaction === 'none' ? '' : plan.interaction,
        diagnosis: diagnose(aligned, diff),
        triptych: path.relative(HERE, triptychPath),
        notes: plan.notes,
      };
      rows.push(row);
      const verdict = (diff.maskedPct ?? diff.unmaskedPct) <= THRESHOLD_PCT ? 'within' : 'OVER';
      console.log(
        `  ${verdict === 'within' ? '·' : '✗'} ${variant.name}: unmasked ${pct(diff.unmaskedPct)} | masked ${pct(diff.maskedPct)} (threshold ${THRESHOLD_PCT}% — ${verdict})${plan.interaction !== 'none' ? ` [${plan.interaction}]` : ''} — ${row.diagnosis}`,
      );
    }
  }

  await browser.close();
  writeReport(rows, subjectMeta, fontAvailability);
  console.log(`\nREPORT: ${path.join(HERE, 'REPORT.md')}`);
}

function writeReport(
  rows: Row[],
  subjectMeta: Array<{ subject: ParitySubject; composition: string; fonts: string; version: string }>,
  fontAvailability: Map<string, boolean>,
): void {
  const diffed = rows.filter((r) => r.status === 'diffed');
  const problem = rows.filter((r) => r.status !== 'diffed');
  const score = (r: Row) => r.maskedPct ?? r.unmaskedPct ?? 0;
  const ranked = [...diffed].sort((x, y) => score(y) - score(x));

  // Worst-10 triptychs → committed report-assets/.
  mkdirSync(ASSETS, { recursive: true });
  const worst = ranked.slice(0, 10);
  for (const r of worst) {
    if (!r.triptych) continue;
    const dest = path.join(ASSETS, `${r.subject}--${variantSlug(r.variant)}.triptych.png`);
    copyFileSync(path.join(HERE, r.triptych), dest);
    r.triptych = path.relative(HERE, dest);
  }

  const buckets = [
    ['≤ 1%', diffed.filter((r) => score(r) <= 1).length],
    ['1–3%', diffed.filter((r) => score(r) > 1 && score(r) <= 3).length],
    ['3–10%', diffed.filter((r) => score(r) > 3 && score(r) <= 10).length],
    ['> 10%', diffed.filter((r) => score(r) > 10).length],
  ] as const;

  const fontLines =
    [...fontAvailability.entries()].map(([f, ok]) => `  - "${f}": ${ok ? 'available locally (same face used in the preview)' : 'NOT available locally — text regions masked for the second score'}`).join('\n') || '  - (no font families named by the Figma sets)';

  const tableRow = (r: Row): string =>
    `| ${r.subject} | ${r.variant}${r.interaction ? ` [${r.interaction}]` : ''} | ${pct(r.maskedPct)} | ${pct(r.unmaskedPct)} | ${r.sizeOurs} vs ${r.sizeFigma} | ${r.diagnosis}${r.notes.length > 0 ? ` (${r.notes.join('; ')})` : ''} | ${r.triptych ?? '—'} |`;

  const md = `# Visual-parity baseline — pixels as receipts

Generated by \`npm run extract:figma:visual\` (extract/figma/visual-parity/run.ts).
Ranked WORST-FIRST by the masked score. Provisional gate line: **${THRESHOLD_PCT}%** —
printed per row, applied nowhere silently.

## Known cross-renderer deltas (named, not tolerated away)

- **Font rasterization**: Chromium (CoreText on macOS) and Figma's renderer hint and
  rasterize glyphs differently even for the SAME face — sub-pixel widths shift.
  Handled by the masked score (text-node DOM rects excluded from numerator and
  denominator), never by a fatter threshold.
- **Font availability** (checked in-page via \`document.fonts.check\`):
${fontLines}
- **Antialiasing**: edge pixels differ per renderer. pixelmatch's antialiasing
  detector is ON (its default) — a per-pixel classifier, not a tolerance knob.
- **Subpixel positioning**: Figma positions nodes on fractional pixels; CSS layout
  rounds differently at 2x. Expect ±1 device-px edge noise on every row.
- **Shadow/blur interpolation**: Figma and Skia blur with different kernels — dialog
  shadows will never be pixel-identical; the score isolates how far apart.
- **Color management**: both sides export/render sRGB; no profile conversion applied.
- **Alignment sensitivity**: the pair is content-cropped and CENTER-padded, never
  resampled — when the two content boxes differ in size, everything downstream of
  the size delta shifts and the mismatch compounds (and the text mask, computed
  from OUR DOM, may miss Figma's shifted text). A large size delta therefore
  dominates its row's score by design: fix the size first, re-run, then read the
  styling delta.
- **Interaction states**: hover/active/focus rows are REAL browser states (mouse
  hover, mouse down, keyboard focus) screenshotted live — not simulated classes.

## Worst-first (all diffed variants)

| subject | variant | masked | unmasked | size ours vs figma | diagnosis | triptych |
|---|---|---|---|---|---|---|
${ranked.map(tableRow).join('\n')}

## Not diffed (named, never dropped)

${(() => {
    if (problem.length === 0) return '_none_';
    // Collapse identical (subject, status, reason) rows — 36 variants refusing
    // for the same 8 violations is ONE fact with a count, not 36 lines.
    const grouped = new Map<string, { subject: string; status: string; reason: string; variants: string[] }>();
    for (const r of problem) {
      const key = `${r.subject} ${r.status} ${r.diagnosis}`;
      const g = grouped.get(key) ?? { subject: r.subject, status: r.status, reason: r.diagnosis, variants: [] };
      g.variants.push(r.variant);
      grouped.set(key, g);
    }
    return `| subject | variants | status | reason |\n|---|---|---|---|\n${[...grouped.values()]
      .map((g) => `| ${g.subject} | ${g.variants.length <= 2 ? g.variants.join(', ') : `${g.variants[0]} (+${g.variants.length - 1} more)`} | ${g.status} | ${g.reason} |`)
      .join('\n')}`;
  })()}

## Distribution (masked score)

${buckets.map(([label, n]) => `- ${label}: ${n} variant(s)`).join('\n')}

- diffed: ${diffed.length} · skipped/refused/declined: ${problem.length}

## Subjects

| subject | figma set version | composition | fonts in set |
|---|---|---|---|
${subjectMeta.map((m) => `| ${m.subject.id} (${m.subject.kind}) | v${m.version} | ${m.composition} | ${m.fonts} |`).join('\n')}

## Reading a triptych

Left: our emit-html preview render (2x). Middle: Figma's own render of the same
variant node (images API, scale=2). Right: pixelmatch diff (red = mismatch,
yellow = antialiasing-classified). Both sides content-box-cropped and
center-padded onto a shared canvas — size deltas are real mismatches, reported
in device px, never resampled away.
`;
  writeFileSync(path.join(HERE, 'REPORT.md'), md);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
