/**
 * The success-side data source.
 *
 * `docs/24-what-works.md` is GENERATED (`npm run capability:report`) from the
 * committed artifacts and its freshness is gated by `npm run capability:fresh`,
 * which is one of the evals. So the site reads THAT file rather than
 * re-deriving the same means from `extract/computed/out/**` a second time: two
 * independent computations of "89.7%" can disagree, and the flattering one
 * would win by accident. One number, one derivation, one source.
 *
 * Nothing here is transcribed. Every value the /what-works/ page prints is a
 * cell parsed out of that report, and a section or table that stops existing
 * REFUSES THE BUILD by name rather than rendering a blank.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_URL } from "./html.js";

/** The generated report this page is a rendering of. */
export const REPORT_REL = "docs/24-what-works.md";
/** Its companion — never linked one without the other. */
export const LIMITS_REL = "docs/23-known-limitations.md";

export const docUrl = (rel: string): string => `${REPO_URL}/blob/main/${rel}`;

const LINES = readFileSync(path.join(process.cwd(), REPORT_REL), "utf8").split(
  "\n",
);

export interface MdTable {
  head: string[];
  rows: string[][];
}

/** Lines between a numbered heading and the next heading of any level. */
function sectionBody(id: string): string[] {
  const re = new RegExp(`^#{2,4}\\s+${id.replace(/\./g, "\\.")}\\.?\\s`);
  const start = LINES.findIndex((l) => re.test(l));
  if (start === -1) {
    throw new Error(
      `${REPORT_REL}: no section heading "${id}" — the what-works page reads that section; ` +
        "fix the parser in site/src/what-works.ts, do not render a blank",
    );
  }
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,6}\s/.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function tablesIn(body: string[]): MdTable[] {
  const out: MdTable[] = [];
  let block: string[] = [];
  const flush = (): void => {
    if (block.length >= 3) {
      const cells = (l: string): string[] =>
        l
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((c) => c.trim());
      out.push({ head: cells(block[0]), rows: block.slice(2).map(cells) });
    }
    block = [];
  };
  for (const line of body) {
    if (line.trimStart().startsWith("|")) block.push(line);
    else flush();
  }
  flush();
  return out;
}

/** The `which`-th markdown table inside section `id`. Refuses by name. */
export function table(id: string, which = 0): MdTable {
  const found = tablesIn(sectionBody(id));
  const t = found[which];
  if (!t) {
    throw new Error(
      `${REPORT_REL}: section ${id} has ${found.length} table(s), the page asked for #${which + 1} — ` +
        "the report changed shape; update site/src/what-works.ts",
    );
  }
  return t;
}

/** A regex capture out of a section's prose. Refuses by name when it stops matching. */
export function fromProse(
  id: string,
  re: RegExp,
  what: string,
): RegExpMatchArray {
  const m = sectionBody(id).join("\n").match(re);
  if (!m) {
    throw new Error(
      `${REPORT_REL}: section ${id} no longer states ${what} (pattern ${re}) — ` +
        "the what-works page quotes it; fix site/src/what-works.ts rather than dropping the fact",
    );
  }
  return m;
}

/** Strip inline markdown — for reading a number out of a cell. */
export const plain = (cell: string): string =>
  cell
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

/** Rewrite a docs-relative link target to its repository URL. */
function link(href: string): string {
  if (/^(https?:|#|mailto:)/.test(href)) return href;
  const [target, hash] = href.split("#");
  const abs = path.posix.normalize(path.posix.join("docs", target));
  return docUrl(abs) + (hash ? `#${hash}` : "");
}

/** Render one table cell's inline markdown as HTML. */
export function md(cell: string): string {
  let s = cell
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, t: string, h: string) => `<a href="${link(h)}">${t}</a>`,
  );
  return s;
}

/** A parsed table as an HTML table, columns optionally dropped by header name. */
export function renderTable(
  t: MdTable,
  opts: { drop?: string[]; className?: string } = {},
): string {
  const drop = new Set(opts.drop ?? []);
  const keep = t.head
    .map((h, i) => (drop.has(h) ? -1 : i))
    .filter((i) => i >= 0);
  const head = keep.map((i) => `<th>${md(t.head[i])}</th>`).join("");
  const rows = t.rows
    .map(
      (r) =>
        `<tr>${keep.map((i) => `<td>${md(r[i] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table class="${opts.className ?? ""}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** The value in column `col` of the row whose first cell reads `label`. */
export function cell(t: MdTable, label: string, col: number): string {
  const row = t.rows.find(
    (r) => plain(r[0]).toLowerCase() === label.toLowerCase(),
  );
  if (!row) {
    throw new Error(
      `${REPORT_REL}: no row "${label}" in the table the what-works page reads (rows: ${t.rows
        .map((r) => plain(r[0]))
        .join(", ")})`,
    );
  }
  const v = plain(row[col] ?? "");
  if (!v)
    throw new Error(
      `${REPORT_REL}: row "${label}" has no value in column ${col}`,
    );
  return v;
}

/** Every number the page states in prose, read from the report's own tables. */
export interface WhatWorksData {
  /** §2 — the denominator, printed before any mean. */
  denominator: MdTable;
  /** §2 — the corpora that are not third-party captures. */
  otherCorpora: MdTable;
  /** §3 — computed-style equality per library. */
  perLibrary: MdTable;
  /** §3.1 — every measured component, worst first. No omissions. */
  worstFirst: MdTable;
  /** §3.2 — the synthetic fixture, held OUT of every mean above. */
  frontier: MdTable;
  /** §4 — canvas → code, on a real community kit. */
  canvas: MdTable;
  /** §4 — why a row is unscored. */
  unscored: MdTable;
  /** §4.1 — per component set. */
  perSet: MdTable;
  /** §5 — the pins that make the numbers re-derivable. */
  pins: MdTable;
  /** §5.1 — the claim suite by what it claims. */
  claimClasses: MdTable;
  /** §6.1 — dropped-fact receipts, counted as a feature. */
  receipts: MdTable;
  /** §6.2 — the two independent construct vocabularies. */
  vocabularies: MdTable;
  /** §6.3 — round-trip fact accounting. */
  buckets: MdTable;
  /** §6.3 — the same facts, by reason tag, including the untagged remainder. */
  bucketTags: MdTable;
  /** Scalars quoted in prose. */
  n: {
    libraries: number;
    measured: string;
    contracts: string;
    librarySize: string;
    coverage: string;
    meanEqual: string;
    cellWeighted: string;
    cells: string;
    over90: string;
    over80: string;
    canvasMean: string;
    canvasScored: string;
    canvasRows: string;
    canvasSets: string;
    matched: string;
    matchedShare: string;
    executedToFactDiff: string;
    verifiedExact: string;
    evals: string;
    golden: string;
    doubleSweep: string;
    receiptTotal: string;
    /** §6.3's largest divergence class — a comparison artifact, not a loss. */
    inertReclassified: string;
    inertOfTotal: string;
    /** §3.2 — the synthetic fixture deliberately excluded from every mean. */
    frontierCases: string;
    frontierMean: string;
  };
}

export function whatWorksData(): WhatWorksData {
  const denominator = table("2", 0);
  const perLibrary = table("3", 0);
  const canvas = table("4", 0);
  const pins = table("5", 0);
  const buckets = table("6.3", 0);
  const receipts = table("6.1", 0);
  const frontier = table("3.2", 0);
  const inert = fromProse(
    "6.3",
    /(\d[\d,]*) of the (\d[\d,]*) `layout\.mode` divergences/,
    "how many layout.mode divergences are the auto-layout-inert comparison artifact",
  );

  return {
    denominator,
    otherCorpora: table("2", 1),
    perLibrary,
    worstFirst: table("3.1", 0),
    frontier,
    canvas,
    unscored: table("4", 1),
    perSet: table("4.1", 0),
    pins,
    claimClasses: table("5.1", 0),
    receipts,
    vocabularies: table("6.2", 0),
    buckets,
    bucketTags: table("6.3", 1),
    n: {
      // Libraries = the denominator table's rows, minus its total row.
      libraries: denominator.rows.filter((r) => !/total/i.test(plain(r[0])))
        .length,
      measured: cell(denominator, "total", 2),
      contracts: cell(denominator, "total", 1),
      librarySize: cell(denominator, "total", 3),
      coverage: cell(denominator, "total", 4),
      meanEqual: cell(perLibrary, "all six", 2),
      cellWeighted: cell(perLibrary, "all six", 7),
      cells: cell(perLibrary, "all six", 6),
      over90: cell(perLibrary, "all six", 4),
      over80: cell(perLibrary, "all six", 5),
      canvasMean: cell(canvas, "mean fidelity over those", 1),
      canvasScored: cell(canvas, "statically scorable", 1),
      canvasRows: cell(canvas, "rows in the scored table", 1),
      canvasSets: cell(canvas, "component sets", 1),
      matched: cell(buckets, "matched", 1),
      matchedShare: cell(buckets, "matched", 2),
      executedToFactDiff: cell(buckets, "components executed to fact diff", 1),
      verifiedExact: cell(buckets, "verified exact projections", 1),
      evals: cell(pins, "executable claims", 1),
      golden: cell(pins, "generated source, byte-identical", 1),
      doubleSweep: cell(pins, "capture double-sweep identity", 1),
      receiptTotal: cell(receipts, "total", 1),
      inertReclassified: inert[1],
      inertOfTotal: inert[2],
      frontierCases: cell(frontier, "synthetic CSS/DOM constructs", 1),
      frontierMean: cell(frontier, "synthetic CSS/DOM constructs", 2),
    },
  };
}
