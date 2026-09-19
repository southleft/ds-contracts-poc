import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, DEFAULT_FONT_FAMILY, DEFAULT_FONT_STACK, type Contract } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { shadowCss } from "../packages/emitter-web-components/src/emit-wc.js";
import { tokenInventoryFromJson } from "./tokens.js";

// No declared family = the pipeline default family, on every code surface.
// The proposer never carries Inter (door propose.font-family-inter-is-default),
// so a design-led contract arrives with NO font-family; the emitters used to
// declare nothing and a clean consumer rendered the browser's serif (CBDS
// Badge 2026-09-18: 0 of 72 variants inside 5 %).
const tokens = { primitives: { paint: { base: { $type: "color", $value: "#4375ff" } }, type: { brand: { $type: "fontFamily", $value: "Manrope, sans-serif" } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const TEXT = { name: "text", type: "text", default: "Badge", bindings: { code: { prop: "text" }, figma: { kind: "TEXT", property: "Text" } } };
function contract(anatomyRoot: Record<string, unknown>, props: unknown[] = [], element = "div"): Contract {
  return ContractSchema.parse({
    id: "probe.family", name: "FamilyProbe", version: "1.0.0", archetype: "none",
    description: "Default font family conformance, not a qualified source component.",
    semantics: { element }, props, states: [],
    anatomy: { root: { layout: { display: "inline-flex", direction: "row" }, tokens: { "background-color": "{paint.base}" }, ...anatomyRoot } },
    bindings: { code: { anchors: { importPath: "./fixture", export: "Fixture" } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const surfaces = (c: Contract) => ({
  modules: emitReact(c, { contracts: new Map([[c.id, c]]), icons: new Map(), tokens: tokenInventoryFromJson([tokens.primitives]) }).css,
  inline: emitReactInline(c, { contracts: new Map([[c.id, c]]), icons: new Map(), tokens, mode: "light" } as never).tsx,
  wc: shadowCss(c),
});
const rule = (css: string, cls: string) => css.match(new RegExp(`\\.${cls} \\{[^}]*\\}`))?.[0] ?? "";
const DECL = `font-family: ${DEFAULT_FONT_STACK}`;
const INLINE = `"fontFamily": ${JSON.stringify(DEFAULT_FONT_STACK)}`;

test("the default is Inter and its CSS spelling needs nothing from the consumer", () => {
  assert.equal(DEFAULT_FONT_FAMILY, "Inter");
  assert.ok(DEFAULT_FONT_STACK.startsWith("Inter,"));
  assert.doesNotMatch(DEFAULT_FONT_STACK, /var\(/, "a custom property may be undefined in a clean consumer");
});

test("a text part with no declared family declares the default on that part, on every surface", () => {
  const s = surfaces(contract({ parts: { label: { content: { prop: "text" } } } }, [TEXT]));
  assert.ok(rule(s.modules, "label").includes(DECL), s.modules);
  assert.ok(!rule(s.modules, "root").includes("font-family"), "the root draws no text of its own");
  assert.ok(s.wc.includes(DECL), s.wc);
  assert.ok(s.inline.includes(INLINE), s.inline);
  assert.doesNotMatch(s.modules.split("\n").filter((l) => l.includes("font-family")).join("\n"), /var\(/);
});

test("static text, root children text and a text-entry control all draw text", () => {
  assert.ok(rule(surfaces(contract({ parts: { dots: { text: "…" } } })).modules, "dots").includes(DECL));
  const children = { ...TEXT, name: "children", bindings: { code: { prop: "children" }, figma: { kind: "TEXT", property: "Label" } } };
  assert.ok(rule(surfaces(contract({}, [children])).modules, "root").includes(DECL));
  const field = surfaces(contract({ parts: { control: { element: "input", attrs: { type: "text" } } } })).modules;
  const control = rule(field, "control");
  assert.ok(control.includes(DECL), field);
  assert.ok(control.indexOf("font: inherit") < control.indexOf(DECL), "`font: inherit` is a shorthand — a family written before it is erased");
});

test("a declared family is kept — on the part, or inherited from an ancestor part — and nothing is added", () => {
  for (const anatomy of [
    { parts: { label: { content: { prop: "text" }, declared: { "font-family": "Manrope" } } } },
    { declared: { "font-family": "Manrope" }, parts: { label: { content: { prop: "text" } } } },
    { parts: { label: { content: { prop: "text" }, tokens: { "font-family": "{type.brand}" } } } },
  ]) {
    const s = surfaces(contract(anatomy, [TEXT]));
    for (const out of [s.modules, s.wc, s.inline]) assert.ok(!out.includes(DEFAULT_FONT_STACK), out);
    assert.match(s.modules, /font-family: (Manrope|var\(--type-brand\))/);
  }
});

test("a textless component, a slot and a native checkable gain nothing", () => {
  for (const anatomy of [
    {},
    { slot: { name: "children" } },
    { parts: { block: { element: "span", text: "" } } }, // intentional emptiness draws no glyph
    { parts: { box: { tokens: { "background-color": "{paint.base}" } }, native: { element: "input", attrs: { type: "checkbox" } } } },
  ]) {
    const s = surfaces(contract(anatomy));
    for (const out of [s.modules, s.wc, s.inline]) assert.ok(!out.includes("Inter"), out);
  }
});
