// Bounded shared surface. No inference of application behavior and no model calls.
import { createHash } from 'node:crypto';

export const canonical = (value) =>
  JSON.stringify(
    value,
    (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b, 'en')))
        : v,
    2,
  ) + '\n';
export const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : canonical(value))
    .digest('hex');
export const resolve = (style, axes) =>
  style?.when?.find((w) => Object.entries(w.axes).every(([k, v]) => axes[k] === v)) ?? style?.base;
export const values = (part, axes) =>
  Object.fromEntries(Object.entries(part.styles).map(([k, s]) => [k, resolve(s, axes)]));
