import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { tokenInventoryFromJson } from "./tokens.js";

// A component whose JSX never renders `children` must refuse them in its
// props type instead of accepting and discarding them (design-led consumer
// finding, Altitude Badge 2026-09-18). A component with a declared slot keeps
// `children` byte-for-byte.
const tokens = { primitives: { paint: { base: { $type: "color", $value: "#4375ff" } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
function contract(anatomyRoot: Record<string, unknown>, props: unknown[] = []): Contract {
  return ContractSchema.parse({
    id: "probe.children", name: "ChildrenProbe", version: "1.0.0", archetype: "none",
    description: "Children refusal conformance, not a qualified source component.",
    semantics: { element: "div" }, props, states: [],
    anatomy: { root: { layout: { display: "inline-flex", direction: "row" }, tokens: { "background-color": "{paint.base}" }, ...anatomyRoot } },
    bindings: { code: { anchors: { importPath: "./fixture", export: "Fixture" } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const emit = (c: Contract) => emitReact(c, { contracts: new Map([[c.id, c]]), icons: new Map(), tokens: tokenInventoryFromJson([tokens.primitives]) }).tsx;

test("a slotless component omits children from its props type and destructure", () => {
  const tsx = emit(contract({ parts: { label: { content: { prop: "text" } } } }, [
    { name: "text", type: "text", default: "Badge", bindings: { code: { prop: "text" }, figma: { kind: "TEXT", property: "Text" } } },
  ]));
  assert.match(tsx, /extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>/);
  assert.match(tsx, /`children` OMITTED/);
  assert.doesNotMatch(tsx.slice(tsx.indexOf("forwardRef<")), /\bchildren\b/);
  assert.match(tsx, /\{text\}/, "the TEXT-bound prop still renders");
});

test("a component with a declared slot keeps children in its props type and renders them", () => {
  const tsx = emit(contract({ slot: { name: "children" } }));
  assert.match(tsx, /extends HTMLAttributes<HTMLDivElement> \{/);
  assert.doesNotMatch(tsx, /`children` OMITTED/);
  assert.match(tsx, /\{children\}/);
});
