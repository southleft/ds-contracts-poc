/**
 * Token corpus utilities for the design→contract extractor — file-reading
 * SHELL over core/token-corpus.ts (the pure derivation: DTCG flattening,
 * literal resolution through the default brand mode, the derived-text-style
 * table, and the value→token suggestion index). Suggestions are reported,
 * never emitted — an unbound canvas value never silently becomes a token.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tokenCorpusFromJson, type TokenCorpus } from '../../core/token-corpus.js';

export {
  FONT_STYLE_BY_WEIGHT,
  tokenCorpusFromJson,
  type DerivedTextStyle,
  type TokenCorpus,
} from '../../core/token-corpus.js';

export function loadTokenCorpus(root: string): TokenCorpus {
  const read = (p: string) =>
    JSON.parse(readFileSync(path.join(root, p), 'utf8')) as Record<string, unknown>;
  void readdirSync(path.join(root, 'tokens', 'modes')); // fail fast if the layout moved
  return tokenCorpusFromJson({
    primitives: read('tokens/primitives.tokens.json'),
    semantic: read('tokens/semantic.tokens.json'),
    light: read('tokens/modes/semantic.light.tokens.json'),
    brandDefault: read('tokens/modes/brand.default.tokens.json'),
  });
}
