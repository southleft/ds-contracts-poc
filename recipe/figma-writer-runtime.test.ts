import assert from "node:assert/strict";
import test from "node:test";

import { figmaWriterRuntime, SCRATCH_FILE } from "./figma-writer-runtime.js";

const base = {
  archetype: "checkbox",
  prefix: "CHECKBOX",
  namespace: "ds.contracts.checkbox.recipe.v1",
  writerVersion: 1,
  collectionLabel: "Recipe Checkbox",
  mint: { kind: "set" as const, field: "checkboxSet" },
  forbiddenPages: [{ id: "115:295378", marker: "INPUT-PAGE" }],
  forbiddenIdentities: [{ namespace: "ds.contracts.input.recipe.v5", marker: "INPUT-IDENTITY-REUSE" }],
};

test("scratch target pins the Scratch file and refuses the listed pages and identities", () => {
  const code = figmaWriterRuntime({ ...base, target: "scratch" });
  assert.ok(code.includes(`"${SCRATCH_FILE.fileKey}"`), "file key pinned");
  assert.ok(code.includes('throw new Error("WRONG-FILE:"'), "wrong file refused");
  assert.ok(code.includes('figma.currentPage.id==="115:295378"'), "current page guard");
  assert.ok(code.includes('page.id==="115:295378"'), "created page guard");
  assert.ok(code.includes("CHECKBOX-MUST-NOT-WRITE-INPUT-PAGE"));
  assert.ok(code.includes('NS==="ds.contracts.input.recipe.v5"'), "identity guard");
});

test("plugin target carries no file pin and no page list — it creates its own page wherever it runs", () => {
  const code = figmaWriterRuntime({ ...base, target: "plugin" });
  assert.equal(code.includes(SCRATCH_FILE.fileKey), false);
  assert.equal(code.includes("WRONG-FILE"), false);
  assert.equal(code.includes("115:295378"), false);
  assert.ok(code.includes("CHECKBOX-WRITER-PLUGIN-TARGET-NO-FILE-PIN"));
  assert.ok(code.includes("page=figma.createPage()"), "still creates its own page");
  assert.ok(code.includes("return{writerVersion:"), "ends in the report the plugin's runScript expects");
});

test("the runtime handles every field the writers used to lose, and names them", () => {
  const code = figmaWriterRuntime({ ...base, target: "scratch" });
  for (const marker of [
    "CHECKBOX-WRITER-LAYOUT-MIN-WIDTH",
    "CHECKBOX-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES",
    "CHECKBOX-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL",
    "CHECKBOX-WRITER-LETTER-SPACING",
    "CHECKBOX-WRITER-EFFECTS",
    "CHECKBOX-WRITER-VECTOR-PATH",
    "CHECKBOX-WRITER-GLYPH-BOUNDS-GUARD",
    "CHECKBOX-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT",
    "CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL",
    "CHECKBOX-FONT-PROVENANCE-TAMPER",
    "CHECKBOX-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
  ]) assert.ok(code.includes(marker), marker);
  assert.ok(code.includes('set.name=setIr.role+" :: "+(setIr.label||source.sourceName)'));
  assert.equal(code.includes("Inter"), false, "no invented Inter anywhere in the program");
  const component = figmaWriterRuntime({ ...base, mint: { kind: "component", field: "chip" }, target: "scratch" });
  assert.ok(component.includes("CHECKBOX-WRITER-CONTAINER-HUGS-COMPONENT"));
  assert.ok(component.includes("container.clipsContent=false"));
  assert.ok(component.includes("CHECKBOX-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL"));
});
