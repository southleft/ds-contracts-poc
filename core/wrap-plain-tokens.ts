/**
 * Plain token map → DTCG, mechanically — the BYO-token on-ramp.
 *
 * None of the big published token sets are DTCG (`$value` leaves): Carbon and
 * Fluent publish JS-module themes (flat name→value maps once serialized),
 * Polaris publishes Style-Dictionary-style `{ value: … }` maps, Spectrum a
 * `sets`/`value` shape. All of them are one MECHANICAL wrap away from
 * loading — and the wrap is exactly that, mechanical:
 *
 *   · a string/number leaf becomes `{ $value, $type? }`, value VERBATIM
 *   · an object with a scalar `value` key (the pre-DTCG Style Dictionary
 *     convention) becomes one token: `value` → `$value`, a string `type`
 *     → `$type`; other keys are metadata and are dropped
 *   · nested objects stay groups
 *   · `$type` is inferred from the VALUE SHAPE only (#hex/rgb()/hsl() →
 *     color; px/rem/em → dimension; ms/s → duration; number → number) —
 *     when the shape says nothing, no $type is invented
 *   · everything else (arrays, booleans, null, empty groups) is SKIPPED BY
 *     NAME with a reason — never silently dropped, never guessed
 *
 * Browser-pure (no node:* imports) — part of the core barrel. The playground
 * Tokens tab offers this wrap when a paste fails the DTCG parse but matches
 * the plain shape; the CLI-side reader can call the same function.
 */

export interface PlainWrapSkip {
  /** Dot-path of the entry that was not wrapped. */
  path: string;
  reason: string;
}

export interface PlainWrapResult {
  /** DTCG tree — every leaf is `{ $value, $type? }`. */
  tree: Record<string, unknown>;
  /** Number of tokens wrapped. */
  count: number;
  /** Every entry seen but NOT wrapped, by name. */
  skipped: PlainWrapSkip[];
}

/** $type inferred from the value's SHAPE alone — omitted when ambiguous. */
export function inferDtcgType(value: string | number): string | undefined {
  if (typeof value === 'number') return 'number';
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v) && [3, 4, 6, 8].includes(v.length - 1)) return 'color';
  if (/^(rgb|rgba|hsl|hsla|color)\(/.test(v)) return 'color';
  if (/^-?\d*\.?\d+(px|rem|em)$/.test(v)) return 'dimension';
  if (/^-?\d*\.?\d+m?s$/.test(v)) return 'duration';
  if (/^-?\d*\.?\d+$/.test(v)) return 'number';
  return undefined;
}

const isScalar = (v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number';

const wrapLeaf = (value: string | number, explicitType?: unknown): Record<string, unknown> => {
  const type = typeof explicitType === 'string' ? explicitType : inferDtcgType(value);
  return { $value: value, ...(type ? { $type: type } : {}) };
};

/**
 * Wrap a parsed plain token document into a DTCG tree. Returns null when the
 * document is not plain-shaped at all: not an object, or it ALREADY carries
 * `$value` leaves (then it is DTCG — nothing to wrap).
 */
export function wrapPlainTokensAsDtcg(doc: unknown): PlainWrapResult | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  let sawDollarValue = false;
  const probe = (node: unknown): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if ('$value' in (node as object)) sawDollarValue = true;
    else for (const v of Object.values(node)) probe(v);
  };
  probe(doc);
  if (sawDollarValue) return null;

  const skipped: PlainWrapSkip[] = [];
  let count = 0;

  const walk = (node: Record<string, unknown>, prefix: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      const p = [...prefix, key].join('.');
      if (isScalar(value)) {
        out[key] = wrapLeaf(value);
        count++;
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const rec = value as Record<string, unknown>;
        // Style Dictionary convention: `{ value: <scalar>, type?, ... }` is
        // ONE token, mechanically renamed value→$value / type→$type.
        if (isScalar(rec.value)) {
          out[key] = wrapLeaf(rec.value, rec.type);
          count++;
          continue;
        }
        const child = walk(rec, [...prefix, key]);
        if (Object.keys(child).length > 0) out[key] = child;
        else skipped.push({ path: p, reason: 'group has no wrappable entries' });
        continue;
      }
      skipped.push({
        path: p,
        reason: Array.isArray(value)
          ? 'array value — not a plain scalar token; wrap refuses to guess a representation'
          : `${value === null ? 'null' : typeof value} value — not a plain scalar token`,
      });
    }
    return out;
  };

  const tree = walk(doc as Record<string, unknown>, []);
  if (count === 0) return null; // nothing plain-shaped in here either
  return { tree, count, skipped };
}
