import { FIDELITY_BAR } from "./fidelity-score.js";

export interface F1ScoreRow {
  label: string;
  status: "pass" | "fail" | "fringe";
  pctAAMasked: number;
  glyphMasked?: number | null;
}

/** F1 permits only measured font residuals, never a generic known failure. */
export function assertF1Score(row: F1ScoreRow, known?: { class: string }): void {
  if (row.status === "pass") return;
  if (!known) throw new Error(`F1 radix: ${row.label} ${row.status.toUpperCase()} ${row.pctAAMasked}% and not named in KNOWN-FAILURES.json`);
  if (known.class !== "font-substrate" && known.class !== "font-metrics") throw new Error(`F1 radix: ${row.label} fails with a non-font cause (${known.class}) — an F1 row may only carry a measured font residual`);
  if (!(typeof row.glyphMasked === "number" && row.glyphMasked <= FIDELITY_BAR.pctAAMaskedMax)) throw new Error(`F1 radix: ${row.label} is named ${known.class} but its glyph-masked pass is not green (${String(row.glyphMasked)})`);
}
