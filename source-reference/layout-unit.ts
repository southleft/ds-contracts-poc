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

/** A used px length as a whole number of those 1/64 px units; undefined when
 * the string is not the six-digit serialization of one. Box arithmetic done
 * in units is integer arithmetic: no tolerance is involved. */
export function usedLayoutUnits(used: string): number | undefined {
  const m = px.exec(normalizeValue(used));
  if (!m) return undefined;
  const value = Number(m[1]), units = Math.round(value * 64);
  return Number((units / 64).toPrecision(6)) === value ? units : undefined;
}

/** Recover a used length only when exactly one 1/64 px value serializes to
 * that CSSOM string. At large magnitudes six digits can describe several
 * layout units; those strings do not establish an exact size. */
export function exactUsedLayoutLength(used: string): string | undefined {
  const units = usedLayoutUnits(used);
  if (units === undefined || !Number.isSafeInteger(units)) return undefined;
  const value = Number(px.exec(normalizeValue(used))![1]);
  if ([units - 1, units + 1].some(n => Number((n / 64).toPrecision(6)) === value)) return undefined;
  return `${units / 64}px`;
}
