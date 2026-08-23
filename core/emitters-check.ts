/**
 * Receipts for the NEW emitters (html, react-inline) — `npm run emitters:check`.
 *
 * The shipping react emitter is byte-guarded by evals/golden.json; these two
 * are not wired into the CLI, so this script asserts their schema-driven
 * invariants over Badge / Switch / Card / Button and writes eyeball samples
 * to core/samples/:
 *
 *   1. Every enum value produces a class (html) / a variant-styles branch or
 *      literal branch (inline).
 *   2. Every token ref either resolved to a literal (inline) or became a
 *      var(--…) reference (html) — ZERO unresolved {token.path} braces.
 *   3. The inline emitter's output contains NO var(-- references (that is
 *      its whole claim).
 *   4. The html emitter's output contains NO React syntax.
 *   5. The web-components emitter expands a MULTI-placeholder PART ref
 *      (untitled-ui's `{imported.social-button.text.color.{social}.{theme}}`)
 *      into one rule per enum tuple — ZERO `var(--…{…})` braces — and the
 *      resolved var() names are byte-equal to the React emitter's for the
 *      same contract (P0 2026-08-22: parts only had the one-placeholder
 *      branch; two placeholders shipped invalid CSS, part colour lost).
 *   6. A root or part `states` ref with ≥2 placeholders, and any ref with a
 *      BOOLEAN placeholder on a part, expands to the same resolved leaves on
 *      react / html / web-components (rule counts asserted, WC var() names
 *      byte-compared with React's); react-inline carries the static part
 *      token and NAMES the hover omission; a placeholder naming no prop is
 *      refused by name on all four (the residual the fix in 5 left open:
 *      every surface's `phs.length === 1` branch dropped these silently).
 *
 * This is a node script (it writes samples) over pure functions — the same
 * split as every other shell in the repo.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { importFromUrl } from "../extract/figma/rest/fetch.js";
import { createFigmaEngine, emitFigmaScript } from "./emit-figma-script.js";
import { emitHtml } from "./emit-html.js";
import { generateCss, validateContract } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { emitWebComponent } from "../packages/emitter-web-components/src/emit-wc.js";
import { emitters, type EmitterCtx } from "./emitter.js";
import { proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import { tokenInventoryFromJson } from "./tokens.js";
import { emitTokenSetScript } from "./token-set.js";
import { kebab } from "../extract/types.js";

const ROOT = process.cwd();
const SAMPLES = path.join(ROOT, "core", "samples");
const read = (p: string) =>
  JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, "contracts"))
    .filter((f) => f.endsWith(".contract.json"))
    .map((f) => ContractSchema.parse(read(path.join("contracts", f))))
    .map((c) => [c.id, c]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, "assets", "icons"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => [
      f.replace(/\.svg$/, ""),
      readFileSync(path.join(ROOT, "assets", "icons", f), "utf8").trim(),
    ]),
);
const brands = Object.fromEntries(
  readdirSync(path.join(ROOT, "tokens", "modes"))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => [
      f.replace(/^brand\.|\.tokens\.json$/g, ""),
      read(`tokens/modes/${f}`),
    ]),
);
const ctx: EmitterCtx = {
  tokens: {
    primitives: read("tokens/primitives.tokens.json"),
    semantic: read("tokens/semantic.tokens.json"),
    light: read("tokens/modes/semantic.light.tokens.json"),
    dark: read("tokens/modes/semantic.dark.tokens.json"),
    brands,
  },
  icons,
  contracts,
};

const SUBJECTS = ["ds.badge", "ds.switch", "ds.card", "ds.button"];
const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? "✔" : "✖"} ${label}`);
};

/** A brace-wrapped token path or placeholder that survived emission. */
const UNRESOLVED_REF =
  /\{[a-z][a-z0-9-]*(\.[a-z0-9{}-]+)+\}|\{[a-z][\w-]*\}(?![\s\S]*\bJSX\b)/;
/** Token-path-shaped braces only (JSX braces are legal in TSX output). */
const UNRESOLVED_TOKEN_PATH = /\{[a-z][a-z0-9-]*(\.[a-z0-9{}-]+)+\}/;

mkdirSync(SAMPLES, { recursive: true });

for (const id of SUBJECTS) {
  const contract = contracts.get(id)!;
  const name = contract.name;
  console.log(`\n${name} (${id})`);

  // ---- html emitter -------------------------------------------------------
  const { html, css } = emitHtml(contract, {
    tokens: tokenInventoryFromJson([
      ctx.tokens.primitives,
      ctx.tokens.semantic,
      ctx.tokens.light,
      ctx.tokens.dark,
    ]),
    icons,
    contracts,
  });
  const htmlAll = html + css;
  for (const p of contract.props) {
    if (typeof p.type !== "object" || !("enum" in p.type)) continue;
    for (const v of p.type.enum) {
      check(
        `html: enum ${p.name}=${v} produces the modifier class`,
        htmlAll.includes(`${kebab(name)}--${p.name}-${v}`),
      );
    }
  }
  check(
    "html: zero unresolved {token.path} braces",
    !UNRESOLVED_TOKEN_PATH.test(htmlAll),
  );
  check(
    "html: every bound token became a var(--…) reference or a literal",
    css.includes("var(--") || !/tokens/.test(JSON.stringify(contract.anatomy)),
  );
  check(
    "html: no React syntax (className/forwardRef/JSX braces)",
    !/className=|forwardRef|\{children\}|dangerouslySetInnerHTML/.test(htmlAll),
  );
  writeFileSync(path.join(SAMPLES, `${kebab(name)}.html`), html);
  writeFileSync(path.join(SAMPLES, `${kebab(name)}.css`), css);

  // ---- react-inline emitter ------------------------------------------------
  const { tsx } = emitReactInline(contract, {
    tokens: ctx.tokens,
    icons,
    contracts,
    mode: "light",
  });
  for (const p of contract.props) {
    if (typeof p.type !== "object" || !("enum" in p.type)) continue;
    for (const v of p.type.enum) {
      // Every enum value appears as a compiled branch: a variant-styles key,
      // a literal comparison, or a type-union member consumed by a lookup.
      check(
        `inline: enum ${p.name}=${v} produces a branch`,
        tsx.includes(`${p.name}-${v}:`) || tsx.includes(`'${v}'`),
      );
    }
  }
  check(
    "inline: NO var(-- references (tokens resolved to literals)",
    !tsx.includes("var(--"),
  );
  check(
    "inline: zero unresolved {token.path} braces",
    !UNRESOLVED_TOKEN_PATH.test(tsx),
  );
  check(
    "inline: names its resolution mode",
    tsx.includes("Resolution mode: light"),
  );
  check(
    "inline: traceability header names the contract",
    tsx.includes(`${contract.id} v${contract.version}`),
  );
  writeFileSync(path.join(SAMPLES, `${name}.inline.tsx`), tsx);
}

// ---- web-components emitter: multi-placeholder PART refs -------------------
// The WC stylesheet's validity referee is React's generateCss, which resolves
// every placeholder per enum value and passes — so a part ref the WC emitter
// itself could not expand reached the stylesheet with its braces intact
// (`color: var(--imported-social-button-text-color-{social}-{theme})`), invalid
// CSS the browser drops silently. The untitled-ui capture is the real repro:
// four contracts carry a PART ref with two placeholders. Each must emit, carry
// zero braces inside var(--…), and resolve to the SAME var() names React does.
console.log("\nweb-components (multi-placeholder part refs, untitled-ui capture)");
const UUI = path.join("examples", "untitled-ui");
const uuiContracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, UUI, "storybook", "contracts"))
    .filter((f) => f.endsWith(".contract.json"))
    .map((f) =>
      ContractSchema.parse(read(path.join(UUI, "storybook", "contracts", f))),
    )
    .map((c) => [c.id, c]),
);
const uuiIcons = new Map<string, string>(
  readdirSync(path.join(ROOT, UUI, "assets", "icons"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => [
      f.replace(/\.svg$/, ""),
      readFileSync(path.join(ROOT, UUI, "assets", "icons", f), "utf8").trim(),
    ]),
);
const uuiInventory = tokenInventoryFromJson([
  read(path.join(UUI, "storybook", "tokens", "captured.dtcg.json")),
  read(path.join(UUI, "storybook", "tokens", "minted.dtcg.json")),
]);
const WC_SUBJECTS = [
  "ds.social-button",
  "ds.progress-bar",
  "ds.progress-circle",
  "ds.slider",
];
/** A placeholder that survived INSIDE a var() — invalid CSS, dropped silently. */
const BRACED_VAR = /var\(--[^)]*\{/;
/** Every non-root part token ref carrying ≥2 placeholders: [part, cssProp, ref]. */
const multiPlaceholderPartRefs = (
  contract: Contract,
): Array<[string, string, string]> => {
  const out: Array<[string, string, string]> = [];
  const walk = (parts: Record<string, unknown> | undefined) => {
    for (const [name, part] of Object.entries(parts ?? {})) {
      const p = part as {
        tokens?: Record<string, string>;
        parts?: Record<string, unknown>;
      };
      for (const [cssProp, ref] of Object.entries(p.tokens ?? {})) {
        if ((ref.match(/\{[a-z][\w-]*\}/g) ?? []).length >= 2)
          out.push([name, cssProp, ref]);
      }
      walk(p.parts);
    }
  };
  walk((contract.anatomy.root as { parts?: Record<string, unknown> }).parts);
  return out;
};
const varNames = (css: string, prefix: string) =>
  new Set(
    [...css.matchAll(/var\((--[a-z0-9-]+)\)/g)]
      .map((m) => m[1])
      .filter((v) => v.startsWith(prefix)),
  );
for (const id of WC_SUBJECTS) {
  const contract = uuiContracts.get(id)!;
  console.log(`\n${contract.name} (${id})`);
  const refs = multiPlaceholderPartRefs(contract);
  // The premise is measured, not assumed: a subject with no such ref would
  // let every assertion below pass vacuously.
  check(`wc: subject carries a ≥2-placeholder PART ref`, refs.length > 0);
  let stylesheet: string;
  try {
    stylesheet = emitWebComponent(contract, {
      icons: uuiIcons,
      contracts: uuiContracts,
      tokens: uuiInventory,
    }).stylesheet;
  } catch (e) {
    check(`wc: emits (${(e as Error).message.split("\n")[0]})`, false);
    continue;
  }
  check("wc: zero var(--…{…}) braces in the stylesheet", !BRACED_VAR.test(stylesheet));
  check(
    "wc: zero unresolved {token.path} braces",
    !UNRESOLVED_TOKEN_PATH.test(stylesheet),
  );
  const reactErrors: string[] = [];
  const reactCss = generateCss(contract, uuiInventory, reactErrors);
  check("react: same contract resolves (the referee agrees it is valid)", reactErrors.length === 0);
  for (const [part, cssProp, ref] of refs) {
    const prefix = "--" + ref.slice(1).split("{")[0].split(".").join("-");
    const fromReact = varNames(reactCss, prefix);
    const fromWc = varNames(stylesheet, prefix);
    const equal =
      fromReact.size === fromWc.size && [...fromReact].every((v) => fromWc.has(v));
    check(
      `wc: part "${part}" ${cssProp} ${ref} → ${fromWc.size} resolved var() name(s), byte-equal to React's ${fromReact.size}`,
      fromReact.size > 0 && equal,
    );
  }
  if (id === "ds.social-button") {
    writeFileSync(path.join(SAMPLES, "social-button.wc.css.ts"), stylesheet);
  }
}

// A placeholder naming NO prop has no host attribute to select on. React's
// part path writes nothing for it (enumCombos over an empty value set runs
// zero checks), so this refusal is the WC emitter's own and must be proven
// to fire BY NAME — the silent alternative was exactly the brace leak above.
{
  const poisoned = JSON.parse(
    JSON.stringify(uuiContracts.get("ds.social-button")!),
  ) as Contract;
  (poisoned.anatomy.root as { parts: Record<string, { tokens: Record<string, string> }> })
    .parts["Text"].tokens["color"] =
    "{imported.social-button.text.color.{social}.{nonsense}}";
  let message = "";
  try {
    emitWebComponent(poisoned, {
      icons: uuiIcons,
      contracts: uuiContracts,
      tokens: uuiInventory,
    });
  } catch (e) {
    message = (e as Error).message;
  }
  check(
    'wc: a part ref substituting a non-prop placeholder is REFUSED naming the part and the placeholder',
    message.includes('part "Text"') && message.includes("{nonsense}"),
  );
}

// ---- states refs with ≥2 placeholders / a boolean placeholder ---------------
// RESIDUAL of the multi-axis fix above: `expandRef` covered tokens and
// tokensByProp only. A root or part `states` ref with two placeholders
// (`{color.{tone}.{emphasis}.hover}`) or a BOOLEAN placeholder fell through
// every CSS surface's `phs.length === 1 && enums.get(…)` branch and emitted
// NOTHING — not a refusal; the hover fact vanished. React's PART token path
// had the same shape for a boolean placeholder (enumCombos over an empty
// value set). Fixture: ds.button with every hole exercised at once, a token
// tree that carries every leaf, and one refusal fixture (a placeholder
// naming no prop) that must fail BY NAME on every target.
console.log("\nstates refs: ≥2 placeholders and boolean placeholders (react / react-inline / web-components / html)");
{
  const VARIANTS = ["primary", "secondary", "danger", "ghost"];
  const SIZES = ["sm", "md", "lg"];
  const BOOLS = ["true", "false"];
  const leaf = { $type: "color", $value: "#123456" };
  const tree = (keys: string[][]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const path of keys) {
      let cur = out;
      for (const seg of path.slice(0, -1)) cur = (cur[seg] ??= {}) as Record<string, unknown>;
      cur[path[path.length - 1]] = { ...leaf };
    }
    return out;
  };
  const fx = tree([
    ...VARIANTS.flatMap((v) => SIZES.map((s) => ["hover", v, s])),
    ...BOOLS.map((b) => ["hover-ink", b]),
    ...VARIANTS.flatMap((v) => BOOLS.map((b) => ["label-hover", v, b])),
    ...BOOLS.map((b) => ["label", b]),
  ]);
  const fxTokens = { ...ctx.tokens, primitives: { ...ctx.tokens.primitives, fx } };
  const fxInventory = tokenInventoryFromJson([
    ctx.tokens.primitives,
    ctx.tokens.semantic,
    ctx.tokens.light,
    ctx.tokens.dark,
    { fx },
  ]);
  // ds.button sets bindings.figma.statePreviews, whose canvas rule refuses a state ref
  // substituting two enum axes BY NAME ("previews multiply exactly ONE primary
  // axis") — a canvas constraint, not a code one. The fixture drops it so the
  // code surfaces are what is measured.
  const srcButton = contracts.get("ds.button")!;
  const { statePreviews: _previews, ...buttonFigma } = srcButton.bindings.figma;
  const button = { ...srcButton, bindings: { ...srcButton.bindings, figma: buttonFigma } };
  const fixture = (id: string, name: string, labelStates: Record<string, Record<string, string>>) =>
    ContractSchema.parse({
      ...button,
      id,
      name,
      anatomy: {
        root: {
          ...button.anatomy.root,
          states: {
            ...button.anatomy.root.states,
            hover: {
              ...button.anatomy.root.states?.hover,
              "background-color": "{fx.hover.{variant}.{size}}",
              color: "{fx.hover-ink.{loading}}",
            },
          },
          parts: {
            ...button.anatomy.root.parts,
            label: {
              ...button.anatomy.root.parts!.label,
              tokens: { color: "{fx.label.{loading}}" },
              states: labelStates,
            },
          },
        },
      },
    });
  const subject = fixture("ds.button-states", "ButtonStates", {
    hover: { color: "{fx.label-hover.{variant}.{loading}}" },
  });
  /** [label, var() prefix, expected resolved leaf count] — the four facts. */
  const facts: Array<[string, string, number]> = [
    ["root states.hover.background-color {variant}×{size}", "--fx-hover-", VARIANTS.length * SIZES.length],
    ["root states.hover.color {loading} (boolean)", "--fx-hover-ink-", BOOLS.length],
    ['part "label" states.hover.color {variant}×{loading}', "--fx-label-hover-", VARIANTS.length * BOOLS.length],
    ['part "label" tokens.color {loading} (boolean)', "--fx-label-", BOOLS.length],
  ];
  // Prefixes nest (--fx-hover- ⊃ --fx-hover-ink-, --fx-label- ⊃ --fx-label-hover-);
  // count a name under the LONGEST prefix it matches.
  const namesFor = (css: string, prefix: string): Set<string> => {
    const longer = facts.map(([, p]) => p).filter((p) => p !== prefix && p.startsWith(prefix));
    return new Set([...varNames(css, prefix)].filter((v) => !longer.some((p) => v.startsWith(p))));
  };
  const surfaces: Array<[string, () => string]> = [
    [
      "react",
      () => {
        const errors: string[] = [];
        validateContract(subject, contracts, errors, icons);
        const css = generateCss(subject, fxInventory, errors);
        if (errors.length > 0) throw new Error(errors.join("\n"));
        return css;
      },
    ],
    ["html", () => emitHtml(subject, { tokens: fxInventory, icons, contracts }).css],
    ["web-components", () => emitWebComponent(subject, { icons, contracts, tokens: fxInventory }).stylesheet],
  ];
  const emitted = new Map<string, string>();
  for (const [surface, emit] of surfaces) {
    try {
      emitted.set(surface, emit());
      check(`${surface}: the fixture emits`, true);
    } catch (e) {
      check(`${surface}: the fixture emits (${(e as Error).message.split("\n")[0]})`, false);
    }
  }
  for (const [surface, css] of emitted) {
    check(`${surface}: zero var(--…{…}) braces`, !BRACED_VAR.test(css));
    for (const [label, prefix, expected] of facts) {
      const got = namesFor(css, prefix);
      check(`${surface}: ${label} → ${expected} resolved var() names (got ${got.size})`, got.size === expected);
    }
  }
  const reactCss = emitted.get("react");
  const wcCss = emitted.get("web-components");
  if (reactCss !== undefined && wcCss !== undefined) {
    for (const [label, prefix] of facts) {
      const a = namesFor(reactCss, prefix);
      const b = namesFor(wcCss, prefix);
      check(
        `web-components: ${label} resolves the SAME var() names React does`,
        a.size > 0 && a.size === b.size && [...a].every((v) => b.has(v)),
      );
    }
  }
  // The selector each surface hangs the expanded rule on — enum values on
  // the mirrored class / data attribute, the boolean on attribute presence.
  if (reactCss !== undefined) {
    check(
      "react: .variant-primary.size-sm:hover:not(:disabled) { background-color: var(--fx-hover-primary-sm) }",
      /\.variant-primary\.size-sm:hover:not\(:disabled\) \{\n  background-color: var\(--fx-hover-primary-sm\);/.test(reactCss),
    );
    check(
      "react: .root:not([data-loading]):hover:not(:disabled) { color: var(--fx-hover-ink-false) }",
      /\.root:not\(\[data-loading\]\):hover:not\(:disabled\) \{\n  color: var\(--fx-hover-ink-false\);/.test(reactCss),
    );
    check(
      "react: .variant-danger[data-loading]:hover:not(:disabled) .label { color: var(--fx-label-hover-danger-true) }",
      /\.variant-danger\[data-loading\]:hover:not\(:disabled\) \.label \{\n  color: var\(--fx-label-hover-danger-true\);/.test(reactCss),
    );
    check(
      "react: .root[data-loading] .label { color: var(--fx-label-true) }",
      /\.root\[data-loading\] \.label \{\n  color: var\(--fx-label-true\);/.test(reactCss),
    );
  }
  const htmlCss = emitted.get("html");
  if (htmlCss !== undefined) {
    check(
      "html: .button-states--variant-primary.button-states--size-sm:hover:not(:disabled) { background-color }",
      htmlCss.includes(".button-states--variant-primary.button-states--size-sm:hover:not(:disabled) {\n  background-color: var(--fx-hover-primary-sm);"),
    );
    check(
      "html: .button-states:not([data-loading]) .button-states__label { color: var(--fx-label-false) }",
      htmlCss.includes(".button-states:not([data-loading]) .button-states__label {\n  color: var(--fx-label-false);"),
    );
  }
  // The WC stylesheet is a TS module — the CSS is a JSON string, so the
  // newline inside a rule is the two characters `\\n`.
  if (wcCss !== undefined) {
    check(
      "wc: [part='root'][part='root']:where([data-variant='primary'][data-size='sm']):hover:not(:disabled) { background-color }",
      wcCss.includes("[part='root'][part='root']:where([data-variant='primary'][data-size='sm']):hover:not(:disabled) {\\n  background-color: var(--fx-hover-primary-sm);"),
    );
    check(
      "wc: [part='root']:where([data-loading]) [part='label'] { color: var(--fx-label-true) }",
      wcCss.includes("[part='root']:where([data-loading]) [part='label'] {\\n  color: var(--fx-label-true);"),
    );
  }
  // react-inline: hover states are a NAMED limit of the inline surface (no
  // pseudo-classes) — the header must still say so; the boolean-placeholder
  // PART token is a static fact and must be carried as a V[] entry per side.
  try {
    const { tsx } = emitReactInline(subject, { tokens: fxTokens, icons, contracts, mode: "light" });
    check("inline: the fixture emits", true);
    check("inline: hover state tokens are NAMED as omitted in the header", /hover.*state tokens are not expressible as inline/s.test(tsx.slice(0, tsx.indexOf("*/"))));
    check(
      'inline: part "label" tokens.color {loading} → V["loading-true:label"] and V["loading-false:label"] resolved to literals',
      tsx.includes('"loading-true:label"') && tsx.includes('"loading-false:label"') && !tsx.includes("var(--"),
    );
    check("inline: zero unresolved {token.path} braces", !UNRESOLVED_TOKEN_PATH.test(tsx));
  } catch (e) {
    check(`inline: the fixture emits (${(e as Error).message.split("\n")[0]})`, false);
  }
  // A placeholder naming NO prop: refused BY NAME on every surface, never a
  // silently empty rule set.
  const poisoned = fixture("ds.button-states-poisoned", "ButtonStatesPoisoned", {
    hover: { color: "{fx.label-hover.{nonsense}.{loading}}" },
  });
  const refusals: Array<[string, () => void]> = [
    [
      "react",
      () => {
        const errors: string[] = [];
        validateContract(poisoned, contracts, errors, icons);
        generateCss(poisoned, fxInventory, errors);
        if (errors.length > 0) throw new Error(errors.join("\n"));
      },
    ],
    ["html", () => void emitHtml(poisoned, { tokens: fxInventory, icons, contracts })],
    ["react-inline", () => void emitReactInline(poisoned, { tokens: fxTokens, icons, contracts, mode: "light" })],
    ["web-components", () => void emitWebComponent(poisoned, { icons, contracts, tokens: fxInventory })],
  ];
  for (const [surface, run] of refusals) {
    let message = "";
    try {
      run();
    } catch (e) {
      message = (e as Error).message;
    }
    check(
      `${surface}: a states ref substituting a non-prop placeholder is REFUSED naming the part and the placeholder`,
      message.includes('part "label"') && message.includes("{nonsense}"),
    );
  }
}

// The registry itself is part of the spec story: four emitters, one contract.
console.log("\nRegistry");
check(
  "registry: react, html, react-inline, figma-script all registered",
  ["react", "html", "react-inline", "figma-script"].every((n) =>
    emitters.some((e) => e.name === n),
  ),
);
const badge = contracts.get("ds.badge")!;
for (const e of emitters) {
  const files = e.emit(badge, ctx);
  check(
    `registry: ${e.name} emits ${files.length} file(s) for Badge, all non-empty`,
    files.length > 0 && files.every((f) => f.contents.length > 0),
  );
}

const importedStyleEngine = createFigmaEngine({
  tokens: {
    primitives: {
      imported: {
        text: {
          "text-sm-semibold": {
            "font-size": {
              $type: "dimension",
              $value: "14px",
              $extensions: {
                dsContracts: {
                  textStyle: {
                    name: "Text sm/Semibold",
                    key: "published-style-key",
                  },
                },
              },
            },
            "font-weight": { $type: "number", $value: "600" },
          },
        },
      },
    },
    semantic: {},
    light: {},
    dark: {},
    brands: { default: {} },
  },
  icons: new Map(),
});
const importedStyleTokens = importedStyleEngine.buildTokensScript(null);
check(
  "figma tokens: imported text-style metadata recreates the exact style name",
  importedStyleTokens.includes('"name":"Text sm/Semibold"'),
);
check(
  "first-party tokens script prunes leftovers in owned collections",
  importedStyleTokens.includes("FC-APPLY-TOKENS-NOT-PRUNED") &&
    importedStyleTokens.includes("owned.set(prim.id"),
);
check(
  "figma tokens: published source style key survives as identity metadata",
  importedStyleTokens.includes('"sourceStyleKey":"published-style-key"') &&
    importedStyleTokens.includes("sourceTextStyleKey"),
);
const importedStyleBundleTokens = emitTokenSetScript(
  {
    name: "Imported",
    base: { placeholder: { $type: "number", $value: 0 } },
    minted: {
      imported: {
        text: {
          "text-sm-semibold": {
            "font-size": {
              $type: "dimension",
              $value: "14px",
              $extensions: {
                dsContracts: {
                  textStyle: {
                    name: "Text sm/Semibold",
                    key: "published-style-key",
                  },
                },
              },
            },
            "font-weight": { $type: "number", $value: "600" },
          },
        },
      },
    },
  },
  null,
);
check(
  "bundle token sync recreates imported text styles before component scripts",
  importedStyleBundleTokens.includes('"name":"Text sm/Semibold"') &&
    importedStyleBundleTokens.includes("sourceTextStyleKey"),
);
check(
  "bundle token sync prunes unreferenced leftovers in the owned collection",
  importedStyleBundleTokens.includes("FC-APPLY-TOKENS-NOT-PRUNED") &&
    importedStyleBundleTokens.includes("v.remove()"),
);

console.log("\nPer-variant component-path text-style identity");
{
  // Component-local axis leaves (imported.avatar.text.font-size.xl) carry
  // exact Figma style names in extensions — the emitter must recreate those
  // names, not only imported.text.* groups.
  const axisStyleEngine = createFigmaEngine({
    tokens: {
      primitives: {
        imported: {
          avatar: {
            text: {
              "font-size": {
                xs: {
                  $type: "dimension",
                  $value: "12px",
                  $extensions: {
                    dsContracts: {
                      textStyle: { name: "Text xs/Medium", key: "key-xs" },
                    },
                  },
                },
                xl: {
                  $type: "dimension",
                  $value: "20px",
                  $extensions: {
                    dsContracts: {
                      textStyle: { name: "Text xl/Medium" },
                    },
                  },
                },
              },
              "font-weight": { $type: "number", $value: "500" },
            },
          },
        },
      },
      semantic: {},
      light: {},
      dark: {},
      brands: { default: {} },
    },
    icons: new Map(),
  });
  const axisStyleTokens = axisStyleEngine.buildTokensScript(null);
  check(
    "figma tokens: per-variant component-path metadata recreates exact style names",
    axisStyleTokens.includes('"name":"Text xs/Medium"') &&
      axisStyleTokens.includes('"name":"Text xl/Medium"') &&
      axisStyleTokens.includes('"sourceStyleKey":"key-xs"'),
  );
  const axisBundleTokens = emitTokenSetScript(
    {
      name: "Avatar",
      base: { placeholder: { $type: "number", $value: 0 } },
      minted: {
        imported: {
          avatar: {
            text: {
              "font-size": {
                xs: {
                  $type: "dimension",
                  $value: "12px",
                  $extensions: {
                    dsContracts: {
                      textStyle: { name: "Text xs/Medium", key: "key-xs" },
                    },
                  },
                },
                xl: {
                  $type: "dimension",
                  $value: "20px",
                  $extensions: {
                    dsContracts: { textStyle: { name: "Text xl/Medium" } },
                  },
                },
              },
              "font-weight": { $type: "number", $value: "500" },
            },
          },
        },
      },
    },
    null,
  );
  check(
    "bundle token sync recreates per-variant component-path text styles",
    axisBundleTokens.includes('"name":"Text xs/Medium"') &&
      axisBundleTokens.includes('"name":"Text xl/Medium"') &&
      axisBundleTokens.includes("sourceTextStyleKey"),
  );
}

console.log("\nText-style identity fail-closed");
{
  const conflictingMinted = {
    imported: {
      text: {
        a: {
          "font-size": {
            $type: "dimension",
            $value: "12px",
            $extensions: {
              dsContracts: { textStyle: { name: "Body/Md" } },
            },
          },
          "font-weight": { $type: "number", $value: "500" },
        },
        b: {
          "font-size": {
            $type: "dimension",
            $value: "16px",
            $extensions: {
              dsContracts: { textStyle: { name: "Body/Md" } },
            },
          },
          "font-weight": { $type: "number", $value: "700" },
        },
      },
    },
  };
  const engineRefused = (() => {
    try {
      createFigmaEngine({
        tokens: {
          primitives: conflictingMinted,
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        },
        icons: new Map(),
      });
      return false;
    } catch (error) {
      return (
        error instanceof Error &&
        error.message.includes("text-style-identity-refused")
      );
    }
  })();
  check(
    "figma deriveTextStyles refuses same style name with conflicting size/weight",
    engineRefused,
  );
  const bundleRefused = (() => {
    try {
      emitTokenSetScript(
        {
          name: "Conflict",
          base: { placeholder: { $type: "number", $value: 0 } },
          minted: conflictingMinted,
        },
        null,
      );
      return false;
    } catch (error) {
      return (
        error instanceof Error &&
        error.message.includes("text-style-identity-refused")
      );
    }
  })();
  check(
    "bundle tokenSetTextStyles refuses duplicate contradictory style definition",
    bundleRefused,
  );
  // buildNode runtime is shared across every component script — pin the
  // fail-closed wording (never the old silent "raw props stand" catch).
  const runtimeScript = emitFigmaScript(contracts.get("ds.badge")!, {
    tokens: ctx.tokens,
    icons,
    contracts,
  });
  check(
    "component runtime refuses missing/failed textStyle bind (no silent raw props)",
    runtimeScript.includes("text-style-identity-refused") &&
      !runtimeScript.includes("raw props stand"),
  );
}

// ---- figma-script slot part `layout.grow` (r10, canvas conformance
// slot-primary-axis-fill). The slot spec was the one NodeSpec built without
// `grow`, so a slot part proposed with layout.grow (a native SLOT drawn FILL
// along its ROW parent's primary axis) regenerated as a HUG slot — the
// carried fact lost on the way back to the canvas. The fillW runtime reads
// `grow` on any in-flow child; the spec just has to carry it.
console.log("\nFigma script — a slot part's layout.grow reaches its spec");
{
  const card = contracts.get("ds.card")!;
  const grown = structuredClone(card);
  const body = grown.anatomy.root.parts!.body!;
  body.layout = { ...(body.layout ?? {}), grow: true };
  const scriptCtx = { tokens: ctx.tokens, icons, contracts };
  const withGrow = emitFigmaScript(grown, scriptCtx);
  const withoutGrow = emitFigmaScript(card, scriptCtx);
  const slotGrow = /"grow": true,\n\s*"slotProperty": "Body"/;
  check(
    "a slot part with layout.grow emits grow: true on its slot spec (ahead of slotProperty — the fillW runtime's input)",
    slotGrow.test(withGrow),
  );
  check(
    "a slot part without layout.grow emits no grow on its spec (byte-invariant for every repo contract)",
    !slotGrow.test(withoutGrow) && !withoutGrow.includes('"grow": true,\n      "slotProperty"'),
  );
}

// ---- figma-script minted-variable preamble (the designer validation loop) --
// The degraded Badge demo import (committed REST fixture, variables endpoint
// answered with the non-Enterprise 403 — the exact path the playground's
// "Demo import (degraded)" runs) mints provisional imported.* tokens the
// proposal binds. The emitted Figma script must carry the preamble that
// upserts those tokens as variables in an 'Imported (provisional)'
// collection — otherwise pasting the script back into the ORIGIN file (which
// never synced them) throws 'Missing variable'. Repo contracts mint nothing
// and must emit WITHOUT the preamble: the golden guard's byte-invariant.
console.log(
  "\nFigma script — minted-variable preamble (degraded Badge demo import)",
);
{
  const badgeRest = read("extract/figma/rest/fixtures/badge.rest.json");
  const respond = (status: number, body: unknown) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  const fetchImpl = (url: string) => {
    if (url.includes("/variables/local"))
      return respond(403, {
        status: 403,
        err: "Incompatible plan for this endpoint",
      });
    if (url.includes("/nodes?ids=")) return respond(200, badgeRest);
    return respond(404, { err: "not served by the fixture" });
  };
  const { dump } = await importFromUrl(
    "https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC?node-id=101-1",
    "demo-fixture-token",
    { fetchImpl },
  );
  const set = Object.entries(dump).find(
    ([name, value]) =>
      name !== "_provenance" &&
      value &&
      typeof value === "object" &&
      "variants" in value,
  );
  check("degraded import: fixture yields a component set", !!set);
  // This fixture predates dump v1.14 row tuples. Its REST payload happens to
  // carry set-level definitions, which is partial structured evidence and must
  // refuse. Strip the partial channel to exercise the explicitly legacy
  // degraded-import behavior this section owns.
  const legacySet = structuredClone(
    set![1] as Parameters<typeof proposeFromDump>[0],
  );
  delete legacySet.propertyDefinitions;
  for (const variant of legacySet.variants) delete variant.variantProperties;
  const proposal = proposeFromDump(
    legacySet,
    {
      projectionMode: "reviewable-inversion",
      corpus: tokenCorpusFromJson({
        primitives: ctx.tokens.primitives as Record<string, unknown>,
        semantic: ctx.tokens.semantic as Record<string, unknown>,
        light: ctx.tokens.light as Record<string, unknown>,
        brandDefault: brands.default as Record<string, unknown>,
      }),
      contractIdByName: new Map(
        [...contracts.values()].map((c) => [c.name, c.id]),
      ),
      fileKey: "8nim1d0IPnehMxA7B7SYxC",
      mintUnbound: true,
    },
  );
  const minted = proposal.mintedTokens;
  check(
    "degraded import: mints provisional imported.* tokens",
    !!minted && minted.count > 0,
  );
  const contract = ContractSchema.parse(proposal.contract);
  const scriptCtx = {
    // Mirror the playground's composed token source: the minted tree rides
    // the semantic slot (its root is `imported` — no collision by invariant).
    tokens: {
      ...ctx.tokens,
      semantic: {
        ...(ctx.tokens.semantic as Record<string, unknown>),
        ...minted!.tree,
      },
    },
    icons,
    contracts: new Map([[contract.id, contract]]),
  };
  const withMint = emitFigmaScript(contract, {
    ...scriptCtx,
    mintedTokens: minted!.tree,
  });
  check(
    "minted script: carries the Imported (provisional) preamble",
    withMint.includes("'Imported (provisional)'") &&
      withMint.includes("MINTED_VARIABLES"),
  );
  const varsJson = withMint.match(/^const MINTED_VARIABLES = (\[.*\]);$/m);
  const mintedVars: Array<{ name: string; type: string; value: unknown }> =
    varsJson ? JSON.parse(varsJson[1]) : [];
  check(
    `minted script: one variable per minted leaf (${minted!.count})`,
    mintedVars.length === minted!.count,
  );
  check(
    "minted script: names are slash-form imported/* paths, typed COLOR/FLOAT",
    mintedVars.length > 0 &&
      mintedVars.every(
        (v) =>
          v.name.startsWith("imported/") &&
          (v.type === "COLOR" || v.type === "FLOAT"),
      ),
  );
  check(
    "minted script: parses in the plugin runner's exact execution shape",
    (() => {
      try {
        new Function("return (async () => {\n" + withMint + "\n})()");
        return true;
      } catch {
        return false;
      }
    })(),
  );
  const withoutMint = emitFigmaScript(contract, scriptCtx);
  check(
    "same contract, no minted layer: NO preamble",
    !withoutMint.includes("Imported (provisional)"),
  );
  const repoBadge = emitFigmaScript(contracts.get("ds.badge")!, {
    tokens: ctx.tokens,
    icons,
    contracts,
  });
  check(
    "repo Badge (mints nothing): NO preamble — golden byte-invariant",
    !repoBadge.includes("Imported (provisional)"),
  );
}

console.log(`\nsamples → core/samples/`);
if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} emitter invariant(s) failed`);
  process.exit(1);
}
console.log(
  `✔ all emitter invariants hold (${SUBJECTS.length} contracts × 2 new emitters + registry)`,
);
