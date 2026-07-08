/**
 * CSS-Module anatomy adapter — file-reading SHIM. The parser/inverter is the
 * pure core module (core/extract-css-module.ts); this file keeps the adapter
 * import path and owns the only fs concern: reading token files from disk.
 */
import { readFileSync, existsSync } from 'node:fs';
import { tokenIndexFromJson, type TokenIndex } from '../../core/extract-css-module.js';

export {
  extractAnatomy,
  tokenIndexFromJson,
  type AnatomyInput,
  type TokenIndex,
} from '../../core/extract-css-module.js';

const DEFAULT_TOKEN_FILES = [
  'tokens/primitives.tokens.json',
  'tokens/semantic.tokens.json',
  'tokens/modes/semantic.light.tokens.json',
  'tokens/modes/semantic.dark.tokens.json',
];

export function loadTokenIndex(files?: string[]): TokenIndex {
  const sources = (files ?? DEFAULT_TOKEN_FILES).filter((f) => existsSync(f));
  return tokenIndexFromJson(sources.map((file) => JSON.parse(readFileSync(file, 'utf8'))));
}
