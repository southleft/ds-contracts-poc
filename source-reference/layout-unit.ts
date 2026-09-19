/** An authored length and the length the browser reports for it.
 *
 * Chromium lays out in 1/64 px units and truncates, then serializes used
 * lengths to six significant digits: an authored `18.4px` is used, and read
 * back by getComputedStyle, as `18.3906px` (1177/64). That is the same
 * declaration, not a disagreement between source and observation. Anything
 * other than that one quantization still has to match exactly. */
import { normalizeValue } from '../extract/computed/lib.js';

const px = /^(-?\d+(?:\.\d+)?)px$/;
export function authoredLengthIsUsed(authored: string, used: string): boolean {
  const a = normalizeValue(authored), u = normalizeValue(used);
  if (a === u) return true;
  const am = px.exec(a), um = px.exec(u);
  if (!am || !um) return false;
  return Number((Math.trunc(Number(am[1]) * 64) / 64).toPrecision(6)) === Number(um[1]);
}
