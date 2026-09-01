/**
 * Evidence publication for the per-version live-proof build scripts.
 *
 * Two modes, one contract:
 *
 *   prepare  — write writer.js, the per-library writer-*.js, plan.json and
 *              receipt.json. The receipt's BUILDER-OWNED fields are rewritten;
 *              everything else already in the file (liveFigma, pageId, url,
 *              humanGrade, live…) is preserved. A re-run of prepare can never
 *              downgrade a recorded mint again.
 *
 *   --check  — read what is committed and COMPARE. Byte-exact for every
 *              program and the plan; owned-field-exact for the receipt. Names
 *              each drift and throws. Writes nothing. Until 2026-09-01 every
 *              build script wrote unconditionally at module level and
 *              `--check` only appended assertions, so the "check" silently
 *              rewrote evidence — including receipt.liveFigma true → false —
 *              while exiting 0 (parity/receipts/v1 audit, AUD "mutating
 *              generated:check").
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const RECEIPT_DEFAULTS = {
  liveFigma: false,
  humanGrade: "queued-for-TJ",
  overallSuccess: false,
  productV1: "INCOMPLETE",
} as const;

export class EvidenceDrift extends Error {}

export function publishEvidence(
  evidenceDir: string,
  files: Record<string, string>,
  receiptOwned: Record<string, unknown>,
  opts: { check: boolean },
): { mode: "prepare" | "check"; files: string[] } {
  const receiptPath = path.join(evidenceDir, "receipt.json");
  if (opts.check) {
    const drifts: string[] = [];
    for (const [name, expected] of Object.entries(files)) {
      const p = path.join(evidenceDir, name);
      if (!existsSync(p)) {
        drifts.push(`${name}: missing (run prepare)`);
        continue;
      }
      const actual = readFileSync(p, "utf8");
      if (actual !== expected) {
        const at = firstDifference(actual, expected);
        drifts.push(`${name}: committed bytes differ from a fresh build (first difference at offset ${at}; committed ${actual.length} B, fresh ${expected.length} B)`);
      }
    }
    if (!existsSync(receiptPath)) drifts.push("receipt.json: missing (run prepare)");
    else {
      const committed = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>;
      for (const [key, value] of Object.entries(receiptOwned)) {
        if (JSON.stringify(committed[key]) !== JSON.stringify(value)) {
          drifts.push(`receipt.json ${key}: committed ${JSON.stringify(committed[key])} ≠ fresh ${JSON.stringify(value)}`);
        }
      }
    }
    if (drifts.length > 0) {
      throw new EvidenceDrift(
        `${evidenceDir}: generated evidence drift (${drifts.length}):\n  - ${drifts.join("\n  - ")}\n  A --check never writes; run the :prepare script to re-record deliberately.`,
      );
    }
    return { mode: "check", files: Object.keys(files) };
  }
  mkdirSync(evidenceDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(evidenceDir, name), content);
  const previous = existsSync(receiptPath)
    ? (JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>)
    : {};
  const merged: Record<string, unknown> = { ...RECEIPT_DEFAULTS, ...previous, ...receiptOwned };
  writeFileSync(receiptPath, `${JSON.stringify(merged, null, 2)}\n`);
  return { mode: "prepare", files: [...Object.keys(files), "receipt.json"] };
}

const firstDifference = (a: string, b: string): number => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
};
