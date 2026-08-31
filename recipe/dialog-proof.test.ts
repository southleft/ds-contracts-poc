import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedDialog } from "./adapters/dialog.js";
import {
  DIALOG_THREE_LIBRARY_PROOF_PROTOCOL,
  antdDialogAdapterConfig,
  antdDialogSource,
  astryxDialogAdapterConfig,
  astryxDialogSource,
  muiDialogAdapterConfig,
  muiDialogSource,
} from "./fixtures/library-dialogs.js";
import {
  collapseDialogRecipe,
  compileDialogRecipe,
  validateDialogStructure,
} from "./recipes/dialog.js";

const PAIRS = [
  ["astryx", astryxDialogSource, astryxDialogAdapterConfig],
  ["mui", muiDialogSource, muiDialogAdapterConfig],
  ["antd", antdDialogSource, antdDialogAdapterConfig],
] as const;

test("dialog@1 adapts Astryx Dialog, MUI Dialog, and AntD Modal from named package facts", () => {
  const astryx = adaptReviewedDialog(
    astryxDialogSource,
    astryxDialogAdapterConfig,
  );
  const mui = adaptReviewedDialog(muiDialogSource, muiDialogAdapterConfig);
  const antd = adaptReviewedDialog(antdDialogSource, antdDialogAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.dialog");
  assert.equal(astryx.tokens.paper.minWidth.fallback, 400);
  assert.equal(astryx.tokens.paper.radius.fallback, 12);
  assert.equal(astryx.tokens.titleFontSize.fallback, 20);
  assert.equal(mui.tokens.paper.minWidth.fallback, 600);
  assert.equal(mui.tokens.titleLineHeight.fallback, 32);
  assert.equal(antd.tokens.paper.radius.fallback, 8);
  assert.equal(antd.tokens.paper.paddingY.fallback, 20);
  assert.equal(DIALOG_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("dialog@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedDialog(source, config);
    const first = compileDialogRecipe(instance);
    validateDialogStructure(first.ir);
    const collapsed = collapseDialogRecipe(first, instance.provenance.selection);
    const second = compileDialogRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "modal / dialog", name);
    assert.equal(first.ir.kind, "component", name);
    assert.equal(
      first.ir.children.filter((child) => child.role === "dialog/title").length,
      1,
      name,
    );
    assert.equal(
      first.ir.children.filter((child) => child.role === "dialog/body").length,
      1,
      name,
    );
  }
});

test("dialog@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/dialog.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
