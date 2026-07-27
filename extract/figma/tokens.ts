/**
 * Token corpus utilities for the design→contract extractor — file-reading
 * SHELL over core/token-corpus.ts (the pure derivation: DTCG flattening,
 * literal resolution through the default brand mode, the derived-text-style
 * table, and the value→token suggestion index). Suggestions are reported,
 * never emitted — an unbound canvas value never silently becomes a token.
 *
 * BROWNFIELD (2026-07-26): this loader used to be hardcoded to THIS repo's
 * four-file tokens/ layout — it even ran `readdirSync(tokens/modes)` to fail
 * fast "if the layout moved". That made the headless design→contract path
 * unrunnable in a stranger's repo: the layout has not moved, it was never
 * theirs. The layout is now an INPUT (`ExtractConfig.tokens`, a `--tokens`
 * flag, or an explicit `files` list); the repo layout is the fallback only
 * when it actually exists; and a repo with neither gets a NAMED refusal
 * instead of an ENOENT stack. Supplied trees follow the playground's adapter
 * shape — one merged modeless tree in the semantic slot, so nearest-token
 * suggestions stay semantic-first.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tokenCorpusFromJson, type TokenCorpus } from '../../core/token-corpus.js';

export {
  FONT_STYLE_BY_WEIGHT,
  tokenCorpusFromJson,
  type DerivedTextStyle,
  type TokenCorpus,
} from '../../core/token-corpus.js';

/** This repo's own layout — the fallback, and the living example. */
const REPO_LAYOUT = {
  primitives: 'tokens/primitives.tokens.json',
  semantic: 'tokens/semantic.tokens.json',
  light: 'tokens/modes/semantic.light.tokens.json',
  brandDefault: 'tokens/modes/brand.default.tokens.json',
};

/** Recursive merge of DTCG documents, later documents winning — the same
 *  rule the playground applies to a pasted multi-document token tree. */
export function mergeTokenTrees(docs: Array<Record<string, unknown>>): Record<string, unknown> {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(b)) {
      if (
        v && typeof v === 'object' && !Array.isArray(v) &&
        a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])
      ) {
        merge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        a[k] = v;
      }
    }
    return a;
  };
  const out: Record<string, unknown> = {};
  for (const doc of docs) merge(out, doc);
  return out;
}

export interface TokenCorpusSource {
  /** DTCG token files, relative to `root` or absolute. This is
   *  `ExtractConfig.tokens` — the field brownfield orgs already point at
   *  THEIR token set. When supplied it IS the corpus; the repo layout is not
   *  consulted. */
  files?: string[];
  /** How the refusal should tell this caller to supply tokens (a config key,
   *  a CLI flag). Defaults to the extract.config.json wording. */
  supplyHint?: string;
}

/** No corpus, no guessing. The refusal names the missing input and the ways
 *  to supply it — never a silent empty corpus, which would report every
 *  bound value as unbound with no candidates. */
export class NoTokenCorpusError extends Error {}

export function loadTokenCorpus(root: string, source: TokenCorpusSource = {}): TokenCorpus {
  const resolve = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p));
  const readJson = (p: string) =>
    JSON.parse(readFileSync(resolve(p), 'utf8')) as Record<string, unknown>;

  if (source.files && source.files.length > 0) {
    const missing = source.files.filter((f) => !existsSync(resolve(f)));
    if (missing.length > 0) {
      throw new NoTokenCorpusError(
        `Token corpus: these token files do not exist — ${missing.join(', ')}. ` +
          `Fix the paths (relative ones resolve against ${root}) or drop them; nothing is guessed.`,
      );
    }
    const merged = mergeTokenTrees(source.files.map(readJson));
    const empty: Record<string, unknown> = {};
    try {
      return tokenCorpusFromJson({
        primitives: empty,
        semantic: merged,
        light: empty,
        brandDefault: empty,
      });
    } catch (e) {
      // A SLICE of a token tree (aliases whose targets live in a file that
      // was not passed) fails deep inside the resolver. Name it here instead
      // of surfacing "Cannot resolve token …" with no idea which input.
      throw new NoTokenCorpusError(
        `Token corpus: the supplied token files do not resolve on their own — ${e instanceof Error ? e.message : String(e)}. ` +
          `Every alias must find its target inside the same set of files (${source.files.join(', ')}) — ` +
          'pass the whole tree, not a slice.',
      );
    }
  }

  const layoutPresent = Object.values(REPO_LAYOUT).every((p) => existsSync(path.join(root, p)));
  if (!layoutPresent) {
    const hint =
      source.supplyHint ??
      'set "tokens": ["<your>.tokens.json", …] in extract.config.json, or pass --tokens <files>';
    throw new NoTokenCorpusError(
      `Token corpus: no token files were supplied and ${root} does not carry the reference layout ` +
        `(${Object.values(REPO_LAYOUT).join(', ')}). ${hint}. ` +
        'Bindings must resolve against a real token tree — an empty corpus would report every bound ' +
        'value as unbound, which is worse than a refusal.',
    );
  }
  return tokenCorpusFromJson({
    primitives: readJson(REPO_LAYOUT.primitives),
    semantic: readJson(REPO_LAYOUT.semantic),
    light: readJson(REPO_LAYOUT.light),
    brandDefault: readJson(REPO_LAYOUT.brandDefault),
  });
}
