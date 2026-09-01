/**
 * FIXTURE READER — the capture→fixture translation adapter (docs/35 Phase 1).
 *
 * Input:  a reviewed fixture token table (recipe/fixtures/library-*.ts) and a
 *         mapping table that names, for EVERY numeric/color/typography leaf,
 *         either (a) the exact ledger read(s) that mechanically produce that
 *         value from the Chromium capture of the real npm package, or (b) a
 *         NAMED receipt for why the ledger cannot express it.
 * Output: a PROPOSED reviewed table + per-leaf provenance (ledger key +
 *         capture state + formula) and a drift verdict per leaf. Never a
 *         silent overwrite — the proposal is an artifact a human reviews.
 *
 * Verdicts:
 *   match   — fixture value equals the ledger value (tolerances are NAMED in
 *             the mapping, never implied).
 *   drift   — fixture value differs from the ledger value. The drift gate
 *             fails closed on any drift row that is not carried BY NAME in
 *             recipe/fixture-reader/reviewed-drift.json.
 *   receipt — the mapping names why this leaf has no ledger read (e.g. the
 *             capture mounts the bare control and never renders the reviewed
 *             label pairing; an SVG viewBox is not a computed style). The
 *             fixture value is CARRIED, and the receipt is quoted in the
 *             proposal.
 */
import { Ledger, LedgerReadError } from "./ledger.js";

export type FactKind = "px" | "number" | "color" | "string";

export interface LedgerMapping {
  path: string;
  kind: FactKind;
  /** Named reads feeding `combine` (single-read mappings use one named "v"). */
  reads: Record<
    string,
    {
      combo: string;
      interaction?: string; // default "default"
      part: string; // Ledger part selector
      pseudo?: string;
      channel: string;
    }
  >;
  /** Human-readable derivation quoted into the provenance line. */
  formula?: string;
  /** Pure combination of the named raw reads. Default: normalize reads.v. */
  combine?: (raw: Record<string, string>) => number | string;
  /** Numeric tolerance; requires toleranceReason. */
  tolerance?: number;
  toleranceReason?: string;
}

export interface ReceiptMapping {
  path: string;
  receipt: string; // WHY the ledger cannot express this leaf
  evidence: string; // what the review DID cite
}

export type FactMapping = LedgerMapping | ReceiptMapping;

export const isReceipt = (m: FactMapping): m is ReceiptMapping => "receipt" in m;

export interface ReaderRow {
  path: string;
  fixtureValue: number | string;
  verdict: "match" | "drift" | "receipt" | "unread";
  capturedValue?: number | string;
  proposedValue: number | string;
  /** `<truth file>#<combo>__<interaction> <part>[<pseudo>].<channel>` per read. */
  ledgerKeys?: string[];
  formula?: string;
  tolerance?: number;
  toleranceReason?: string;
  receipt?: string;
  evidence?: string;
  /** LedgerReadError text when the read itself refused (verdict "unread"). */
  error?: string;
}

/** Walk a fixture token tree to its {variable, fallback} leaves. */
export function tokenLeaves(tokens: unknown): Map<string, number | string> {
  const out = new Map<string, number | string>();
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" || typeof record.fallback === "number")
    ) {
      out.set(path, record.fallback as number | string);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  return out;
}

import { px, num, hex8 } from "./ledger.js";

function normalize(kind: FactKind, raw: string): number | string {
  if (kind === "px") return px(raw);
  if (kind === "number") return num(raw);
  if (kind === "color") return hex8(raw);
  return raw;
}

function equal(
  kind: FactKind,
  fixture: number | string,
  captured: number | string,
  tolerance: number,
): boolean {
  if (typeof fixture === "number" && typeof captured === "number") {
    return Math.abs(fixture - captured) <= tolerance;
  }
  if (kind === "color") {
    return String(fixture).toLowerCase() === String(captured).toLowerCase();
  }
  return fixture === captured;
}

export function runMappings(
  ledger: Ledger,
  leaves: Map<string, number | string>,
  mappings: FactMapping[],
): ReaderRow[] {
  const rows: ReaderRow[] = [];
  for (const m of mappings) {
    if (!leaves.has(m.path)) {
      throw new Error(
        `mapping for "${m.path}" has no fixture leaf — the mapping table drifted from the fixture table`,
      );
    }
    const fixtureValue = leaves.get(m.path)!;
    if (isReceipt(m)) {
      rows.push({
        path: m.path,
        fixtureValue,
        verdict: "receipt",
        proposedValue: fixtureValue,
        receipt: m.receipt,
        evidence: m.evidence,
      });
      continue;
    }
    const ledgerKeys: string[] = [];
    const raw: Record<string, string> = {};
    let error: string | null = null;
    for (const [name, read] of Object.entries(m.reads)) {
      const interaction = read.interaction ?? "default";
      const comboKey = `${read.combo}__${interaction}`;
      ledgerKeys.push(
        `${ledger.file}#${comboKey} ${read.part}${read.pseudo ?? ""}.${read.channel}`,
      );
      try {
        raw[name] = ledger.raw(comboKey, read.part, read.channel, read.pseudo);
      } catch (e) {
        if (!(e instanceof LedgerReadError)) throw e;
        error = e.message;
        break;
      }
    }
    if (error !== null) {
      rows.push({
        path: m.path,
        fixtureValue,
        verdict: "unread",
        proposedValue: fixtureValue,
        ledgerKeys,
        formula: m.formula,
        error,
      });
      continue;
    }
    let capturedValue: number | string;
    try {
      capturedValue = m.combine ? m.combine(raw) : normalize(m.kind, raw.v);
    } catch (e) {
      if (!(e instanceof LedgerReadError)) throw e;
      rows.push({
        path: m.path,
        fixtureValue,
        verdict: "unread",
        proposedValue: fixtureValue,
        ledgerKeys,
        formula: m.formula,
        error: (e as Error).message,
      });
      continue;
    }
    if (typeof capturedValue === "number") {
      capturedValue = Number(capturedValue.toFixed(3));
    }
    const tolerance = m.tolerance ?? 0;
    if (tolerance > 0 && !m.toleranceReason) {
      throw new Error(`mapping "${m.path}" carries a tolerance with no named reason`);
    }
    const verdict = equal(m.kind, fixtureValue, capturedValue, tolerance)
      ? "match"
      : "drift";
    rows.push({
      path: m.path,
      fixtureValue,
      verdict,
      capturedValue,
      // A match proposes the fixture spelling (source-exact rationals like
      // 16/14*5 stay exact); a drift proposes the CAPTURED value.
      proposedValue: verdict === "match" ? fixtureValue : capturedValue,
      ledgerKeys,
      formula: m.formula,
      ...(tolerance > 0 ? { tolerance, toleranceReason: m.toleranceReason } : {}),
    });
  }
  // COVERAGE IS TOTAL: every fixture leaf is mapped or receipted, exactly once.
  const mapped = new Set(mappings.map((m) => m.path));
  if (mapped.size !== mappings.length) {
    const seen = new Set<string>();
    const dup = mappings.map((m) => m.path).find((p) => (seen.has(p) ? true : (seen.add(p), false)));
    throw new Error(`duplicate mapping for "${dup}"`);
  }
  for (const path of leaves.keys()) {
    if (!mapped.has(path)) {
      throw new Error(
        `fixture leaf "${path}" has NO mapping and NO receipt — the reader refuses silent coverage gaps`,
      );
    }
  }
  return rows;
}
