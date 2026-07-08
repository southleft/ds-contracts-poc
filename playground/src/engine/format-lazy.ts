/**
 * Formatting, LAZY by design: formatTsx/formatCss ride prettier/standalone
 * (~1.4 MB). Only reached via `await import('./format-lazy.js')` behind the
 * "Format" toggle, so prettier lands in its own chunk. The formatting pass
 * itself is the SAME one the CLI ships (core/format.ts).
 */
export { formatCss, formatTsx } from '../../../core/index.js';
