/**
 * StyleX token reader — `stylex.defineVars({...})` + CSS `light-dark()` →
 * DTCG (the BYO-token adapter layer, Astryx round; gauntlet change #6).
 *
 * StyleX-era systems publish their tokens as TypeScript source: exported
 * object literals fed to `stylex.defineVars` (Astryx: 13 `*Defaults`
 * literals, 186 vars in `theme/tokens.stylex.ts`), with dual-mode values
 * ENCODED IN THE VALUE as CSS `light-dark(<light>, <dark>)` — a third mode
 * architecture next to Carbon's parallel themes and Nord's parallel files.
 *
 * This reader is SYNTACTIC and mechanical (same discipline as
 * core/wrap-plain-tokens.ts):
 *   · every `defineVars(X)` call is read — X an inline object literal or an
 *     identifier resolving to a same-file const object literal
 *   · keys become single-segment token paths (leading `--` stripped, hyphens
 *     kept — no dot-splitting, so `--color-accent` can never collide with
 *     `--color-accent-muted` as a group prefix)
 *   · a value that is EXACTLY `light-dark(a, b)` splits into two modes
 *     (paren-aware — `rgba(…)` commas do not split); the BASE tree carries
 *     the light branch, and per-mode trees carry both (the captured-tokens
 *     v1.6 modes shape — mode trees list only mode-VARYING entries)
 *   · `$type` is inferred from the value shape only (inferDtcgType) — when
 *     the light and dark branches infer differently, no $type is invented
 *   · everything unreadable (non-scalar values, spreads, computed keys,
 *     duplicate names, non-literal defineVars arguments) is SKIPPED BY NAME
 *     with a reason — never silently dropped, never guessed
 *
 * Browser-pure (no node:* imports; the TypeScript compiler API is heavy but
 * browser-safe, matching core/extract-react-tsx.ts).
 */
import ts from 'typescript';
import { inferDtcgType } from './wrap-plain-tokens.js';

export interface StylexTokenEntry {
  /** Single-segment token path — the var name minus the leading `--`. */
  path: string;
  /** The key as published (`--color-accent`). */
  name: string;
  /** The defineVars argument this entry came from (`colorDefaults`), or the
   *  result variable name for inline literals. */
  group: string;
  /** Base value — the LIGHT branch when the value was `light-dark()`. */
  value: string;
  /** DTCG $type inferred from the value shape — absent when ambiguous. */
  type?: string;
  /** Present iff the published value was `light-dark(light, dark)`. */
  modes?: { light: string; dark: string };
}

export interface StylexTokenSkip {
  name: string;
  reason: string;
}

export interface StylexTokenLayer {
  /** Flat DTCG tree — leaf shape { $value, $type? }, base (light) values. */
  tree: Record<string, unknown>;
  count: number;
  entries: StylexTokenEntry[];
  /** Per-mode DTCG trees, carrying only the mode-VARYING (light-dark)
   *  entries — absent when no value used light-dark(). */
  modes?: Record<string, { tree: Record<string, unknown>; count: number }>;
  /** Everything seen but NOT wrapped — named, never silent. */
  skipped: StylexTokenSkip[];
}

/** Split `light-dark(a, b)` into its two branches — paren-aware so nested
 *  `rgba(…, …)` commas do not split. Returns null unless the WHOLE value is
 *  exactly one light-dark() call with exactly two top-level arguments. */
export function splitLightDark(value: string): { light: string; dark: string } | null {
  const m = value.trim().match(/^light-dark\((.*)\)$/s);
  if (!m) return null;
  const inner = m[1];
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return null; // unbalanced — not a clean light-dark()
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  if (depth !== 0 || parts.length !== 2) return null;
  const [light, dark] = parts.map((p) => p.trim());
  if (!light || !dark) return null;
  return { light, dark };
}

const leaf = (value: string, type?: string): Record<string, unknown> => ({
  $value: value,
  ...(type ? { $type: type } : {}),
});

/**
 * Read every `defineVars({...})` token table out of a `.stylex.ts` source
 * text. `fileName` is used only for parser diagnostics.
 */
export function stylexTokensFromSource(source: string, fileName = 'tokens.stylex.ts'): StylexTokenLayer {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);

  // const-name → object literal (read through as/satisfies/parens), so
  // `defineVars(colorDefaults)` resolves to the same-file literal.
  const constObjects = new Map<string, ts.ObjectLiteralExpression>();
  // defineVars(X) sites: [result-or-argument name, argument node]
  const defineSites: { group: string; arg: ts.Expression }[] = [];

  const unwrap = (e: ts.Expression): ts.Expression => {
    let x = e;
    while (ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isParenthesizedExpression(x)) x = x.expression;
    return x;
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(init) && !constObjects.has(node.name.text)) {
        constObjects.set(node.name.text, init);
      }
      if (ts.isCallExpression(init) && /(^|\.)defineVars$/.test(init.expression.getText()) && init.arguments[0]) {
        const arg = unwrap(init.arguments[0]);
        defineSites.push({
          group: ts.isIdentifier(arg) ? arg.text : node.name.text,
          arg,
        });
      }
    } else if (ts.isCallExpression(node) && /(^|\.)defineVars$/.test(node.expression.getText()) && node.arguments[0]) {
      // defineVars used as an expression outside a simple const declaration
      const arg = unwrap(node.arguments[0]);
      if (ts.isIdentifier(arg) || ts.isObjectLiteralExpression(arg)) {
        defineSites.push({ group: ts.isIdentifier(arg) ? arg.text : '(inline)', arg });
      }
      ts.forEachChild(node, visit);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const entries: StylexTokenEntry[] = [];
  const skipped: StylexTokenSkip[] = [];
  const seenPaths = new Set<string>();
  const seenSites = new Set<ts.Node>();

  for (const site of defineSites) {
    const obj = ts.isObjectLiteralExpression(site.arg)
      ? site.arg
      : ts.isIdentifier(site.arg)
        ? constObjects.get(site.arg.text)
        : undefined;
    if (!obj) {
      skipped.push({
        name: site.group,
        reason: 'defineVars argument is not an object literal readable in file scope — table not wrapped',
      });
      continue;
    }
    if (seenSites.has(obj)) continue; // same table passed to defineVars twice
    seenSites.add(obj);

    for (const prop of obj.properties) {
      if (ts.isSpreadAssignment(prop)) {
        skipped.push({ name: `${site.group}.${prop.getText().slice(0, 40)}`, reason: 'spread entry — keys not enumerable syntactically' });
        continue;
      }
      const nameNode = prop.name;
      if (!nameNode || !(ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode))) {
        skipped.push({ name: `${site.group}.(computed)`, reason: 'computed/non-literal key — not wrapped' });
        continue;
      }
      const name = nameNode.text;
      if (!ts.isPropertyAssignment(prop)) {
        skipped.push({ name, reason: 'not a plain value assignment — not wrapped' });
        continue;
      }
      const initExpr = unwrap(prop.initializer);
      let raw: string | number | null = null;
      if (ts.isStringLiteral(initExpr) || ts.isNoSubstitutionTemplateLiteral(initExpr)) raw = initExpr.text;
      else if (ts.isNumericLiteral(initExpr)) raw = Number(initExpr.text);
      if (raw === null) {
        skipped.push({
          name,
          reason: `value is ${ts.SyntaxKind[initExpr.kind]} — not a plain scalar; wrap refuses to guess a representation`,
        });
        continue;
      }
      const path = name.replace(/^--/, '');
      if (!/^[a-z0-9-]+$/i.test(path)) {
        skipped.push({ name, reason: 'name outside the token-ref grammar ([a-z0-9-]) — not registrable' });
        continue;
      }
      if (seenPaths.has(path)) {
        skipped.push({ name, reason: `duplicate token path "${path}" (already wrapped from an earlier table) — later entry not wrapped` });
        continue;
      }
      seenPaths.add(path);

      const split = typeof raw === 'string' ? splitLightDark(raw) : null;
      if (split) {
        const lightType = inferDtcgType(split.light);
        const darkType = inferDtcgType(split.dark);
        const type = lightType === darkType ? lightType : undefined;
        entries.push({
          path,
          name,
          group: site.group,
          value: split.light,
          ...(type ? { type } : {}),
          modes: split,
        });
      } else {
        const value = String(raw);
        const type = inferDtcgType(raw);
        entries.push({ path, name, group: site.group, value, ...(type ? { type } : {}) });
      }
    }
  }

  const tree: Record<string, unknown> = {};
  for (const e of entries) tree[e.path] = leaf(e.value, e.type);

  const varying = entries.filter((e) => e.modes);
  const modes =
    varying.length > 0
      ? Object.fromEntries(
          (['light', 'dark'] as const).map((mode) => [
            mode,
            {
              tree: Object.fromEntries(varying.map((e) => [e.path, leaf(e.modes![mode], e.type)])),
              count: varying.length,
            },
          ]),
        )
      : undefined;

  return { tree, count: entries.length, entries, ...(modes ? { modes } : {}), skipped };
}
