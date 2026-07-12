/**
 * VISUAL-PARITY GATE — pixels as receipts.
 *
 *   npm run extract:figma:visual [-- subject-id …] [--refresh]
 *                                [--summary] [--write-baseline]
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
 * declines are rows, not omissions. Every diffed row over the 3% masked
 * line must match a NAMED cause in triage.ts (committed, classed) or the
 * report prints it UNTRIAGED — loud, never a silent residue.
 *
 * STANDING-GATE MODES:
 *   --summary         no artifacts; every row's masked score compares to the
 *                     committed baseline.json — a regression beyond
 *                     EPSILON_PP percentage points, a vanished row, or a row
 *                     the baseline has never seen FAILS the run (exit 1),
 *                     each with a named line. Reuses the disk PNG cache;
 *                     with a warm cache the run is render-only (no images
 *                     API calls). Without the cache it refetches — offline
 *                     WITHOUT a cache fails loudly on the first fetch, never
 *                     silently passes.
 *   --write-baseline  after a reviewed full run: writes baseline.json
 *                     (per-row scores + per-subject pinned render boxes for
 *                     the offline eval pin). Explicit by design — an
 *                     ordinary re-run can never move the gate.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { composeSubject, type RenderablePackage } from './compose.js';
import { fetchNodePngs, fetchSetInfos, type SetInfo } from './figma-api.js';
import { alignPair, diffPair, meanInk, readPng, writeTriptych, type Aligned, type DiffResult } from './img.js';
import { planVariant, variantSlug } from './match.js';
import { launchBrowser, renderVariant } from './render.js';
import { PARITY_SUBJECTS, type ParitySubject } from './subjects.js';
import { triageFor, type TriageRule } from './triage.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const OUT = path.join(HERE, 'out');
const CACHE = path.join(OUT, '_cache');
const ASSETS = path.join(HERE, 'report-assets');
const BASELINE = path.join(HERE, 'baseline.json');

/** Provisional gate line — printed next to every score, never applied silently. */
const THRESHOLD_PCT = 2.0;
/** Over this masked score a row must carry a triage.ts named cause. */
const TRIAGE_LINE_PCT = 3.0;
/** Summary mode: allowed per-row masked-score drift vs baseline.json, in
 *  percentage points. Absorbs antialiasing jitter only — same machine,
 *  same Chromium, scores reproduce byte-identically; this is NOT a fidelity
 *  tolerance (the scores themselves stay untouched). */
const EPSILON_PP = 0.1;

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
  /** Matched triage.ts rule — the row's committed named cause. */
  cause: TriageRule | null;
}

/** Committed per-row score baseline (written by --write-baseline, read by
 *  --summary and the offline eval render pin). */
interface Baseline {
  generatedAt: string;
  headCommit: string | null;
  epsilonPp: number;
  subjects: Record<
    string,
    {
      version: string;
      fontFamilies: string[];
      /** The subject's default (no-interaction) row — the offline render
       *  pin re-renders exactly this and compares the content box. */
      pinned: { variant: string; sizeOurs: string } | null;
    }
  >;
  rows: Record<
    string,
    {
      status: Row['status'];
      masked: number | null;
      unmasked: number | null;
      sizeOurs: string | null;
      causeClass: TriageRule['class'] | null;
    }
  >;
}

const rowKey = (r: { subject: string; variant: string }) => `${r.subject} :: ${r.variant}`;

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
  const summary = args.includes('--summary');
  const writeBaselineFlag = args.includes('--write-baseline');
  const only = args.filter((a) => !a.startsWith('--'));
  const subjects = PARITY_SUBJECTS.filter((s) => only.length === 0 || only.includes(s.id));
  if (subjects.length === 0) throw new Error(`no subjects match: ${only.join(', ')}`);
  if (summary && only.length > 0) {
    throw new Error('--summary compares the FULL baseline — subject filters would hide regressions');
  }

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
      rows.push({ subject: subject.id, variant: '(all)', status: 'refused', diagnosis: `proposal refused: ${msg}`, notes: [], cause: null });
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
        rows.push({ subject: subject.id, variant: variant.name, status: 'skipped', diagnosis: plan.reason, notes: [], cause: null });
        continue;
      }
      const figmaPngPath = pngs.get(variant.nodeId);
      if (!figmaPngPath) {
        console.log(`  ✗ ${variant.name}: images API declined to render the node`);
        rows.push({ subject: subject.id, variant: variant.name, status: 'figma-declined', diagnosis: 'images API returned null for the node', notes: plan.notes, cause: null });
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
        rows.push({ subject: subject.id, variant: variant.name, status: 'refused', diagnosis: `render refused: ${headline}`, notes: plan.notes, cause: null });
        continue;
      }
      for (const [f, ok] of Object.entries(rendered.fontChecks)) fontAvailability.set(f, ok);

      const aligned = alignPair(readPng(rendered.png), readPng(figmaPngPath));
      const diff = diffPair(aligned, rendered.textRects);
      const triptychPath = path.join(subjectOut, `${slug}.triptych.png`);
      if (!summary) {
        // Summary mode is score-only: no artifact churn, the committed
        // triptychs/REPORT stay the reviewed full-run truth.
        writeFileSync(path.join(subjectOut, `${slug}.ours.png`), rendered.png);
        writeTriptych(triptychPath, aligned, diff.diff);
      }

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
        cause: triageFor(subject.id, variant.name),
      };
      rows.push(row);
      const verdict = (diff.maskedPct ?? diff.unmaskedPct) <= THRESHOLD_PCT ? 'within' : 'OVER';
      const causeTag =
        (diff.maskedPct ?? diff.unmaskedPct) > TRIAGE_LINE_PCT
          ? row.cause
            ? ` [cause: ${row.cause.class}]`
            : ' [UNTRIAGED]'
          : '';
      console.log(
        `  ${verdict === 'within' ? '·' : '✗'} ${variant.name}: unmasked ${pct(diff.unmaskedPct)} | masked ${pct(diff.maskedPct)} (threshold ${THRESHOLD_PCT}% — ${verdict})${plan.interaction !== 'none' ? ` [${plan.interaction}]` : ''} — ${row.diagnosis}${causeTag}`,
      );
    }
  }

  await browser.close();
  if (summary) {
    const failures = compareToBaseline(rows);
    if (failures > 0) {
      console.error(`\nSUMMARY GATE: ${failures} named failure(s) vs baseline.json — see lines above`);
      process.exitCode = 1;
    } else {
      console.log(`\nSUMMARY GATE: all rows within ±${EPSILON_PP}pp of baseline.json (${new Date().toISOString()})`);
    }
    return;
  }
  writeReport(rows, subjectMeta, fontAvailability);
  if (writeBaselineFlag) writeBaseline(rows, subjectMeta);
  console.log(`\nREPORT: ${path.join(HERE, 'REPORT.md')}`);
}

// ---------------------------------------------------------------------------
// Baseline — the standing no-regression gate
// ---------------------------------------------------------------------------

function writeBaseline(
  rows: Row[],
  subjectMeta: Array<{ subject: ParitySubject; composition: string; fonts: string; version: string }>,
): void {
  let headCommit: string | null = null;
  try {
    headCommit = execSync('git rev-parse HEAD', { cwd: HERE, encoding: 'utf8' }).trim();
  } catch {
    headCommit = null; // named in the file itself: null = git unavailable at write time
  }
  const baseline: Baseline = {
    generatedAt: new Date().toISOString(),
    headCommit,
    epsilonPp: EPSILON_PP,
    subjects: {},
    rows: {},
  };
  for (const m of subjectMeta) {
    const pinnedRow = rows.find(
      (r) => r.subject === m.subject.id && r.status === 'diffed' && (r.interaction ?? '') === '',
    );
    baseline.subjects[m.subject.id] = {
      version: m.version,
      fontFamilies: m.fonts === '(none)' ? [] : m.fonts.split(', '),
      pinned: pinnedRow ? { variant: pinnedRow.variant, sizeOurs: pinnedRow.sizeOurs! } : null,
    };
  }
  for (const r of rows) {
    baseline.rows[rowKey(r)] = {
      status: r.status,
      masked: r.maskedPct ?? null,
      unmasked: r.unmaskedPct ?? null,
      sizeOurs: r.sizeOurs ?? null,
      causeClass: r.cause?.class ?? null,
    };
  }
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 1) + '\n');
  console.log(`baseline → ${path.relative(process.cwd(), BASELINE)} (${Object.keys(baseline.rows).length} rows)`);
}

/** Compare a fresh run against the committed baseline. Every failure prints
 *  a named line; the count is returned (0 = gate passes). Regressions beyond
 *  EPSILON_PP fail; improvements beyond it are NAMED (re-baseline to lock
 *  them in) but do not fail. */
function compareToBaseline(rows: Row[]): number {
  if (!existsSync(BASELINE)) {
    console.error(`✗ no baseline.json at ${BASELINE} — run a full pass with --write-baseline first`);
    return 1;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  const eps = baseline.epsilonPp ?? EPSILON_PP;
  const current = new Map(rows.map((r) => [rowKey(r), r]));
  let failures = 0;
  console.log(`\n── summary vs baseline ${baseline.generatedAt} (${baseline.headCommit?.slice(0, 7) ?? 'no commit recorded'}), ε ${eps}pp ──`);
  for (const [key, base] of Object.entries(baseline.rows)) {
    const cur = current.get(key);
    if (!cur) {
      console.error(`✗ ${key}: in baseline, MISSING from this run (variant vanished / set edited?)`);
      failures++;
      continue;
    }
    if (cur.status !== base.status) {
      console.error(`✗ ${key}: status ${base.status} → ${cur.status}`);
      failures++;
      continue;
    }
    if (base.status !== 'diffed') continue;
    const baseScore = base.masked ?? base.unmasked ?? 0;
    const curScore = cur.maskedPct ?? cur.unmaskedPct ?? 0;
    const delta = curScore - baseScore;
    if (delta > eps) {
      console.error(`✗ ${key}: masked ${baseScore.toFixed(2)}% → ${curScore.toFixed(2)}% (+${delta.toFixed(2)}pp > ε ${eps})`);
      failures++;
    } else if (delta < -eps) {
      console.log(`· ${key}: IMPROVED ${baseScore.toFixed(2)}% → ${curScore.toFixed(2)}% — re-baseline (--write-baseline) to lock it in`);
    }
  }
  for (const r of rows) {
    if (!baseline.rows[rowKey(r)]) {
      console.error(`✗ ${rowKey(r)}: NEW row not in baseline — review the full report, then --write-baseline`);
      failures++;
    }
  }
  return failures;
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

  const causeCell = (r: Row): string => {
    if (r.cause) return `${r.cause.class}: ${r.cause.cause}`;
    return score(r) > TRIAGE_LINE_PCT ? '**UNTRIAGED**' : '—';
  };
  const tableRow = (r: Row): string =>
    `| ${r.subject} | ${r.variant}${r.interaction ? ` [${r.interaction}]` : ''} | ${pct(r.maskedPct)} | ${pct(r.unmaskedPct)} | ${r.sizeOurs} vs ${r.sizeFigma} | ${r.diagnosis}${r.notes.length > 0 ? ` (${r.notes.join('; ')})` : ''} | ${causeCell(r)} | ${r.triptych ?? '—'} |`;

  // Gate read: distribution by triage class + the standing invariants.
  const over = (lo: number, hi: number) => diffed.filter((r) => score(r) > lo && score(r) <= hi);
  const untriaged = diffed.filter((r) => score(r) > TRIAGE_LINE_PCT && !r.cause);
  const classCounts = (rs: Row[]): string => {
    const m = new Map<string, number>();
    for (const r of rs) m.set(r.cause?.class ?? 'UNTRIAGED', (m.get(r.cause?.class ?? 'UNTRIAGED') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ×${n}`).join(', ') || '(empty)';
  };

  const md = `# Visual-parity baseline — pixels as receipts

Generated by \`npm run extract:figma:visual\` (extract/figma/visual-parity/run.ts).
Ranked WORST-FIRST by the masked score. Provisional gate line: **${THRESHOLD_PCT}%** —
printed per row, applied nowhere silently. Every row over **${TRIAGE_LINE_PCT}%**
masked carries a NAMED cause from the committed triage table (triage.ts,
classed engine / capture-gap / renderer / harness / design) or prints
**UNTRIAGED**. Standing gate: \`-- --summary\` re-scores every row against the
committed baseline.json and FAILS on any regression beyond ±${EPSILON_PP}pp
(cached Figma PNGs — render-only when the cache is warm); \`-- --write-baseline\`
moves the gate, explicitly, after review.

## Known cross-renderer deltas (named, not tolerated away)

- **Font rasterization**: Chromium (CoreText on macOS) and Figma's renderer hint and
  rasterize glyphs differently even for the SAME face — sub-pixel widths shift.
  Handled by the masked score (text-node DOM rects excluded from numerator and
  denominator), never by a fatter threshold.
- **Text-hug metrics**: the SAME text also SIZES differently — Figma hugs an
  Inter 16px line at lineHeightPx 19.36 where the CSS line box is 20px, and
  glyph advance widths differ per rasterizer, so a hug-sized component's box
  lands ±1–2 CSS px off (receipt: Button node 83×35 vs ours 82×36). The size
  delta is REAL and stays in the score; rows whose residual is only this are
  triaged \`renderer\`.
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
  styling delta. On TRANSPARENT-INK rows (washed fills near the alpha-trim
  threshold) the two sides can trim to very different boxes and the compounding
  is extreme — triaged \`harness\` by name. Anchoring both crops to one shared
  box was considered and rejected honestly: the two images have no shared
  coordinate frame (our screenshot clips a DOM union box + margin; Figma's PNG
  is the node render), and correlation-based registration would optimize the
  alignment against the very signal being measured.
- **Interaction states**: hover/active/focus rows are REAL browser states (mouse
  hover, mouse down, keyboard focus) screenshotted live — not simulated classes.

## Worst-first (all diffed variants)

| subject | variant | masked | unmasked | size ours vs figma | diagnosis | named cause (triage.ts) | triptych |
|---|---|---|---|---|---|---|---|
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

## Gate read (triage classes)

- **UNTRIAGED over ${TRIAGE_LINE_PCT}%: ${untriaged.length}**${untriaged.length > 0 ? ` — ${untriaged.map((r) => rowKey(r)).join('; ')}` : ' — the queue is empty'}
- > 10% by class: ${classCounts(over(10, Infinity))}
- 3–10% by class: ${classCounts(over(TRIAGE_LINE_PCT, 10))}
- open \`engine\`-class causes: ${diffed.filter((r) => r.cause?.class === 'engine').length} (an engine row is a tracked defect, not an accepted delta)

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
