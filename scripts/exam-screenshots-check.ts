/**
 * CANVAS SCREENSHOT GATE — `npm run exam:screenshots:check`
 *
 *   npm run exam:screenshots:check               every parity/receipts/phase-2/*-EXAM.md
 *   npm run exam:screenshots:check -- --self-test  prove a set without a pair is RED
 *
 * WHY. A held-out exam (Phase 2) is the one place this repo measures itself
 * against a design system it never trained on. Its receipt says "recognisable"
 * or "not recognisable" per cell — a judgement a reader can only audit with the
 * two pictures side by side. The first exam kept its PNGs in a scratch
 * directory "not in the patch"; that is a receipt whose evidence a second
 * person cannot open. From now on an exam receipt that records canvas sets
 * must carry, per set, a screenshot PAIR in the tree, or NAME that it does not.
 *
 * THE GRAMMAR (pinned here; the receipt must conform to it, not the reverse):
 *
 *   1. SETS.  Every markdown table whose header's first cell is `set`
 *      (case-insensitive; bold stripped) lists canvas sets in its first column
 *      — one row per set, `total` rows ignored. The union across those tables
 *      is what the receipt "records". A receipt with no such table is RED: an
 *      exam that lists no sets has nothing to have been examined.
 *
 *   2. SCREENSHOTS.  A section headed `## Screenshots` (any depth ≥ 2) holding
 *      a table with the header columns, in this order:
 *
 *          | set | canvas | reference | note |
 *
 *      – `set`        one of the recorded set names (bold allowed); a set may
 *                     have several rows (one per cell), and every recorded set
 *                     must have at least one.
 *      – `canvas`     the Figma-rendered PNG of the source set/cell — a path
 *                     relative to parity/receipts/phase-2/, `<kit>/<file>.png`,
 *                     bare or as a markdown link/image. Must exist, must be a
 *                     PNG (magic bytes), must live under `<kit>/`.
 *      – `reference`  the other side of the pair: the generated code rendered
 *                     (Figma→code exam: the generated React/Storybook render;
 *                     code→Figma exam: the sandbox render the canvas was drawn
 *                     from). Same rules.
 *      – `note`       free text; REQUIRED in the one named-absence shape below.
 *
 *      A set whose screenshots do not exist in the tree is written as
 *
 *          | Badge | — | — | not captured at exam time (2026-08-22), see docs/23 §B.34 |
 *
 *      both path cells `—` and the note matching exactly
 *      /^not captured at exam time \(\d{4}-\d{2}-\d{2}\), see docs\/23 §B\.\d+/
 *      with that §B.n heading present in docs/23-known-limitations.md. That is
 *      NAMED-UNCAPTURED — printed, counted, never green-by-silence — and it is
 *      the ONLY way a listed set passes without two PNGs.
 *
 *   3. SELF-HEAL LOG.  A section headed `## Self-heal log` with at least one
 *      list item or table row: what the exam re-ran, retracted or corrected
 *      about its own instrument, so a reader knows which numbers moved and why.
 *
 * STATES per set: PAIRED · NAMED-UNCAPTURED · MISSING (no row / no file /
 * not a PNG / wrong shape). The receipt is RED by name on any MISSING set, a
 * missing Screenshots table, a missing Self-heal log, or no set table at all.
 * Exit non-zero on any RED receipt.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownAnchors, splitMarkdownRow } from './v1-definition-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT_DIR = path.join(ROOT, 'parity', 'receipts', 'phase-2');
const DOCS_23 = path.join(ROOT, 'docs', '23-known-limitations.md');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const UNCAPTURED_RE = /^not captured at exam time \((\d{4}-\d{2}-\d{2})\), see docs\/23 §B\.(\d+)\b/;
const SCREENSHOT_HEADER = ['set', 'canvas', 'reference', 'note'];

const stripBold = (s: string) => s.replace(/^\*\*|\*\*$/g, '').trim();
const cellPath = (cell: string): string | null => {
  const c = cell.trim();
  if (c === '—' || c === '-' || c === '') return null;
  const link = c.match(/^!?\[[^\]]*]\(([^)\s]+)\)$/);
  return (link ? link[1] : c).replace(/^`|`$/g, '');
};

interface Table {
  header: string[];
  rows: string[][];
  line: number;
}

/** Every pipe table in the markdown, with the (trimmed, bold-stripped) header. */
export function parseTables(markdown: string): Table[] {
  const lines = markdown.split(/\r?\n/);
  const tables: Table[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!/^\s*\|.*\|\s*$/.test(lines[i]) || !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1])) continue;
    const header = splitMarkdownRow(lines[i].trim()).map((c) => stripBold(c).toLowerCase());
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
      rows.push(splitMarkdownRow(lines[j].trim()));
      j += 1;
    }
    tables.push({ header, rows, line: i + 1 });
    i = j - 1;
  }
  return tables;
}

/** The tables under a `## <heading>` section (until the next heading of depth ≤ that one). */
function sectionBody(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^#{2,6}\\s+${heading}\\s*$`, 'i').test(l));
  if (start === -1) return null;
  const depth = lines[start].match(/^#+/)![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= depth) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

export interface SetState {
  set: string;
  state: 'PAIRED' | 'NAMED-UNCAPTURED' | 'MISSING';
  detail: string;
}
export interface ReceiptVerdict {
  receipt: string;
  red: boolean;
  problems: string[];
  sets: SetState[];
}

export function checkReceipt(receiptPath: string, baseDir: string, docs23: string): ReceiptVerdict {
  const name = path.basename(receiptPath);
  const markdown = readFileSync(receiptPath, 'utf8');
  const problems: string[] = [];
  const tables = parseTables(markdown);

  // 1. the sets the receipt records
  const recorded: string[] = [];
  for (const t of tables) {
    if (t.header[0] !== 'set') continue;
    for (const r of t.rows) {
      const s = stripBold(r[0] ?? '');
      if (!s || /^total$/i.test(s) || recorded.includes(s)) continue;
      recorded.push(s);
    }
  }
  if (!recorded.length) problems.push('no `| set | … |` table — the receipt records no canvas sets (grammar §1)');

  // 2. the Screenshots table
  const shots = sectionBody(markdown, 'Screenshots');
  const shotTable = shots ? parseTables(shots).find((t) => SCREENSHOT_HEADER.every((h, i) => t.header[i] === h)) : undefined;
  if (!shots) problems.push('no `## Screenshots` section (grammar §2)');
  else if (!shotTable) problems.push('the Screenshots section has no table headed `| set | canvas | reference | note |` (grammar §2)');

  const docAnchors = markdownAnchors(docs23);
  const b31Anchor = (n: string) => [...docAnchors].some((a) => a.startsWith(`b${n}-`));
  const rowsBySet = new Map<string, string[][]>();
  for (const r of shotTable?.rows ?? []) {
    const s = stripBold(r[0] ?? '');
    rowsBySet.set(s, [...(rowsBySet.get(s) ?? []), r]);
  }
  for (const s of rowsBySet.keys()) if (!recorded.includes(s)) problems.push(`Screenshots row names "${s}", which no set table records`);

  const sets: SetState[] = [];
  for (const set of recorded) {
    const rows = rowsBySet.get(set);
    if (!rows) {
      sets.push({ set, state: 'MISSING', detail: 'no Screenshots row' });
      continue;
    }
    let paired = 0;
    let named: string | null = null;
    const detail: string[] = [];
    for (const r of rows) {
      const canvas = cellPath(r[1] ?? '');
      const reference = cellPath(r[2] ?? '');
      const note = (r[3] ?? '').trim();
      if (!canvas && !reference) {
        const m = note.match(UNCAPTURED_RE);
        if (!m) {
          detail.push(`row without paths must carry the named-absence note, got "${note}"`);
          continue;
        }
        if (!b31Anchor(m[2])) {
          detail.push(`note cites docs/23 §B.${m[2]}, which has no such heading`);
          continue;
        }
        named = `not captured at exam time (${m[1]}), docs/23 §B.${m[2]}`;
        continue;
      }
      const checkPng = (label: string, rel: string | null): boolean => {
        if (!rel) {
          detail.push(`${label}: empty while the other side has a path`);
          return false;
        }
        const normalized = rel.replace(/\\/g, '/');
        if (!/^[\w.-]+\/[\w./-]+\.png$/.test(normalized) || normalized.includes('..')) {
          detail.push(`${label}: "${rel}" is not <kit>/<file>.png`);
          return false;
        }
        const abs = path.join(baseDir, normalized);
        if (!existsSync(abs) || !statSync(abs).isFile()) {
          detail.push(`${label}: ${rel} does not exist`);
          return false;
        }
        const head = Buffer.alloc(8);
        const fd = readFileSync(abs);
        fd.copy(head, 0, 0, 8);
        if (!head.equals(PNG_MAGIC)) {
          detail.push(`${label}: ${rel} is not a PNG`);
          return false;
        }
        return true;
      };
      const c = checkPng('canvas', canvas);
      const ref = checkPng('reference', reference);
      if (c && ref) paired += 1;
    }
    if (paired) sets.push({ set, state: 'PAIRED', detail: `${paired} pair(s)${detail.length ? `; also: ${detail.join('; ')}` : ''}` });
    else if (named && !detail.length) sets.push({ set, state: 'NAMED-UNCAPTURED', detail: named });
    else sets.push({ set, state: 'MISSING', detail: detail.join('; ') || 'no usable row' });
  }

  // 3. the self-heal log
  const heal = sectionBody(markdown, 'Self-heal log');
  if (heal === null) problems.push('no `## Self-heal log` section (grammar §3)');
  else if (!/^\s*(?:[-*]|\d+\.)\s+\S|^\s*\|.*\|\s*$/m.test(heal)) problems.push('the Self-heal log has no list item or table row (grammar §3)');

  const missing = sets.filter((s) => s.state === 'MISSING');
  for (const m of missing) problems.push(`set "${m.set}": MISSING — ${m.detail}`);
  return { receipt: name, red: problems.length > 0, problems, sets };
}

function report(v: ReceiptVerdict): void {
  const tally = { PAIRED: 0, 'NAMED-UNCAPTURED': 0, MISSING: 0 };
  for (const s of v.sets) tally[s.state] += 1;
  console.log(`${v.red ? '✖' : '✔'} ${v.receipt} — ${v.sets.length} set(s): paired ${tally.PAIRED} · named-uncaptured ${tally['NAMED-UNCAPTURED']} · missing ${tally.MISSING}`);
  for (const s of v.sets) console.log(`    ${s.state === 'PAIRED' ? '✔' : s.state === 'MISSING' ? '✖' : '·'} ${s.set.padEnd(22)} ${s.state.padEnd(17)} ${s.detail}`);
  for (const p of v.problems) console.log(`    ✖ ${p}`);
}

function selfTest(): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'exam-shots-'));
  try {
    const docs23 = readFileSync(DOCS_23, 'utf8');
    mkdirSync(path.join(dir, 'kit'));
    const png = Buffer.concat([PNG_MAGIC, Buffer.from('fake-png-body')]);
    writeFileSync(path.join(dir, 'kit', 'a-canvas.png'), png);
    writeFileSync(path.join(dir, 'kit', 'a-ref.png'), png);
    writeFileSync(path.join(dir, 'kit', 'not-png.png'), Buffer.from('GIF89a nope'));
    const sets = '| set | carried |\n|---|---|\n| A | 1 |\n| B | 2 |\n| **total** | 3 |\n';
    const heal = '\n## Self-heal log\n\n- re-ran the render with the tree\'s own CLI\n';
    const write = (file: string, body: string) => {
      const p = path.join(dir, file);
      writeFileSync(p, body);
      return p;
    };
    const b = [...markdownAnchors(docs23)].find((a) => /^b\d+-/.test(a))!.match(/^b(\d+)-/)![1];
    const cases: Array<[string, string, boolean, string[]]> = [
      ['GOOD-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/a-ref.png | cell a |\n| B | — | — | not captured at exam time (2026-08-22), see docs/23 §B.${b} |\n${heal}`, false, ['PAIRED', 'NAMED-UNCAPTURED']],
      ['NOROW-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/a-ref.png | cell a |\n${heal}`, true, ['PAIRED', 'MISSING']],
      ['NOFILE-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/gone.png | x |\n| B | — | — | not captured at exam time (2026-08-22), see docs/23 §B.${b} |\n${heal}`, true, ['MISSING', 'NAMED-UNCAPTURED']],
      ['NOTPNG-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/not-png.png | kit/a-ref.png | x |\n| B | — | — | not captured at exam time (2026-08-22), see docs/23 §B.${b} |\n${heal}`, true, ['MISSING', 'NAMED-UNCAPTURED']],
      ['BADNOTE-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/a-ref.png | x |\n| B | — | — | screenshots were not taken |\n${heal}`, true, ['PAIRED', 'MISSING']],
      ['BADANCHOR-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/a-ref.png | x |\n| B | — | — | not captured at exam time (2026-08-22), see docs/23 §B.9999 |\n${heal}`, true, ['PAIRED', 'MISSING']],
      ['NOHEAL-EXAM.md', `# t\n\n${sets}\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n| A | kit/a-canvas.png | kit/a-ref.png | x |\n| B | — | — | not captured at exam time (2026-08-22), see docs/23 §B.${b} |\n`, true, ['PAIRED', 'NAMED-UNCAPTURED']],
      ['NOSETS-EXAM.md', `# t\n\nno tables here\n\n## Screenshots\n\n| set | canvas | reference | note |\n|---|---|---|---|\n${heal}`, true, []],
      ['NOSHOTS-EXAM.md', `# t\n\n${sets}${heal}`, true, ['MISSING', 'MISSING']],
    ];
    for (const [file, body, expectRed, expectStates] of cases) {
      const v = checkReceipt(write(file, body), dir, docs23);
      const states = v.sets.map((s) => s.state);
      if (v.red !== expectRed || JSON.stringify(states) !== JSON.stringify(expectStates)) {
        throw new Error(`${file}: expected red=${expectRed} states=${expectStates.join(',')}; got red=${v.red} states=${states.join(',')} — ${v.problems.join('; ')}`);
      }
    }
    console.log(
      '✔ exam:screenshots:check self-test: a paired set passes and a named absence is counted, not green; a set with no row, a missing file, a non-PNG, an unnamed absence, a dead §B anchor, a missing Self-heal log, a receipt with no set table and a receipt with no Screenshots table are each RED by name',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.includes('--self-test')) {
      selfTest();
    } else {
      const docs23 = readFileSync(DOCS_23, 'utf8');
      const receipts = readdirSync(RECEIPT_DIR)
        .filter((f) => /-EXAM\.md$/.test(f))
        .sort();
      if (!receipts.length) throw new Error(`${path.relative(ROOT, RECEIPT_DIR)} holds no *-EXAM.md receipt`);
      let red = 0;
      for (const f of receipts) {
        const v = checkReceipt(path.join(RECEIPT_DIR, f), RECEIPT_DIR, docs23);
        report(v);
        if (v.red) red += 1;
      }
      if (red) {
        console.error(`\n✖ exam:screenshots:check — ${red} of ${receipts.length} exam receipt(s) RED: a listed set without a screenshot pair must be named as uncaptured (grammar in scripts/exam-screenshots-check.ts)`);
        process.exitCode = 1;
      } else {
        console.log(`\n✔ exam:screenshots:check — ${receipts.length} exam receipt(s): every recorded set carries a screenshot pair in the tree or names that it does not`);
      }
    }
  } catch (err) {
    console.error(`✖ exam:screenshots:check — ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
