/** A source rule, separate from the evaluated native frame height. This covers
 * zero-minimum fractional tracks with nonspanning items on an indefinite block
 * axis. It does not authorize a contract or a native write: the caller must
 * establish placement, content contributions, and absence of size constraints.
 * CSS Grid 1, 11.7: https://www.w3.org/TR/css-grid-1/#algo-flex-tracks */
export interface IntrinsicGridRows {
  factors: readonly number[];
  gap: number;
}
export interface IntrinsicGridContribution {
  row: number;
  span: 1;
  /** Intrinsic outer block contribution at the resolved column width, BEFORE
   * stretching the item to its cell. A previously stretched height is invalid. */
  size: number;
}
export interface EvaluatedIntrinsicGridRows {
  fraction: number;
  rows: number[];
  height: number;
}

/** Stateless so content removal/shrink cannot inherit a previous sample's size.
 * Empty explicit tracks retain their fractions. For factors below one, the
 * flexible-track algorithm floors the divisor at one, not the track factor. */
export function evaluateIntrinsicGridRows(rule: IntrinsicGridRows,
  contributions: readonly IntrinsicGridContribution[]): EvaluatedIntrinsicGridRows {
  if (!rule || !Array.isArray(rule.factors) || !rule.factors.length ||
      rule.factors.some(f => !Number.isFinite(f) || f <= 0) ||
      !Number.isFinite(rule.gap) || rule.gap < 0 || !Array.isArray(contributions))
    throw Error('grid-intrinsic-rows-invalid-rule');
  let fraction = 0;
  for (const item of contributions) {
    if (!item || item.span !== 1 || !Number.isInteger(item.row) || item.row < 0 ||
        item.row >= rule.factors.length || !Number.isFinite(item.size) || item.size < 0)
      throw Error('grid-intrinsic-rows-invalid-contribution');
    fraction = Math.max(fraction, item.size / Math.max(1, rule.factors[item.row]));
  }
  const totalFactor = rule.factors.reduce((a, b) => a + b, 0);
  const intrinsicTrackSize = fraction * totalFactor;
  const height = intrinsicTrackSize + rule.gap * (rule.factors.length - 1);
  // CSS first establishes the intrinsic container size, then lays out tracks
  // within that size. Factors totaling less than one request only that share
  // of the available track space; the remaining space stays unoccupied.
  fraction = intrinsicTrackSize / Math.max(1, totalFactor);
  const rows = rule.factors.map(f => f * fraction);
  if (!Number.isFinite(height) || rows.some(row => !Number.isFinite(row)))
    throw Error('grid-intrinsic-rows-overflow');
  return { fraction, rows, height };
}
