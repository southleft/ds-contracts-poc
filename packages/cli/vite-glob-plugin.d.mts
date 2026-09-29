import type { Plugin } from 'esbuild';

/** Files one `<dir>/<prefix>*<suffix>` glob matches from `importer`, in Vite's order, under Vite's keys. */
export function globFiles(importer: string, pattern: string): Array<{ absolute: string; key: string }>;
/** `text` with its import.meta.glob calls replaced by static imports, or null when it has none. */
export function transformGlobs(file: string, text: string): string | null;
/** The esbuild plugin: ?raw imports and import.meta.glob, resolved at build time. */
export function viteGlobPlugin(): Plugin;
