/**
 * COLLAPSE MUST KEEP EVERY VARIABLE NAME. The canonical hash that proves
 * compile → collapse → compile is a fixed point does not include variable
 * names, so a collapse that renamed a parameter's variable was invisible to
 * it: radio, switch and checkbox rebuilt their state-opacity variables as
 * `${instance.id}…` — and the instance carries its id at identity.id, so the
 * canvas came back naming variables "undefined.states-…" (measured
 * 2026-09-02). This test walks every parameter on both sides.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalCheckboxRecipeInstance } from "../fixtures/checkbox.js";
import { canonicalRadioRecipeInstance } from "../fixtures/radio.js";
import { canonicalSwitchRecipeInstance } from "../fixtures/switch.js";
import { collapseCheckboxRecipe, compileCheckboxRecipe } from "./checkbox.js";
import { collapseRadioRecipe, compileRadioRecipe } from "./radio.js";
import { collapseSwitchRecipe, compileSwitchRecipe } from "./switch.js";

const variables = (value: unknown, at = "", out = new Map<string, string>()): Map<string, string> => {
  if (value === null || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  if (typeof record.variable === "string" && "fallback" in record) out.set(at, record.variable);
  for (const [k, v] of Object.entries(record)) variables(v, at ? `${at}.${k}` : k, out);
  return out;
};

const cases = [
  ["radio", canonicalRadioRecipeInstance, compileRadioRecipe, collapseRadioRecipe],
  ["switch", canonicalSwitchRecipeInstance, compileSwitchRecipe, collapseSwitchRecipe],
  ["checkbox", canonicalCheckboxRecipeInstance, compileCheckboxRecipe, collapseCheckboxRecipe],
] as const;

for (const [name, instance, compile, collapse] of cases) {
  test(`${name}: collapse returns every token variable under the name it was compiled with`, () => {
    const inst = instance as unknown as { tokens: unknown; provenance: { selection: unknown } };
    const envelope = compile(instance as never);
    const back = collapse(envelope as never, inst.provenance.selection) as unknown as { tokens: unknown };
    const before = variables(inst.tokens);
    const after = variables(back.tokens);
    const renamed = [...before].filter(([path, variable]) => after.get(path) !== variable).map(([path, variable]) => `${path}: ${variable} → ${after.get(path)}`);
    assert.deepEqual(renamed, [], `${name} collapse renamed variables`);
    assert.equal([...after.values()].filter((v) => v.startsWith("undefined")).length, 0, "no variable is named from an undefined id");
  });
}
