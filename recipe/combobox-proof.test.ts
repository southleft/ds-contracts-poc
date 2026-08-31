import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditComboboxAccounting } from "./accounting.js";
import {
  adaptReviewedCombobox,
  auditReviewedComboboxAcquisition,
  type ReviewedComboboxAdapterConfig,
} from "./adapters/combobox.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalComboboxRecipeInstance } from "./fixtures/combobox.js";
import {
  COMBOBOX_PAIRED_PROOF_PROTOCOL,
  antdComboboxAdapterConfig,
  antdComboboxSource,
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import type { FrameNode, IRNode } from "./figma-ir.js";
import { deriveRecipeIntegrity } from "./hash.js";
import { emitComboboxOutputs } from "./output/combobox.js";
import { assertSafeOutputFiles } from "./output-safety.js";
import {
  collapseComboboxRecipe,
  compileComboboxRecipe,
  type ComboboxRecipeInstance,
} from "./recipes/combobox.js";
import { measureComboboxRequiredFacts } from "./required-facts.js";

const sources = [
  [muiComboboxSource, muiComboboxAdapterConfig],
  [antdComboboxSource, antdComboboxAdapterConfig],
] as const;

const resign = (envelope: RecipeEnvelope): RecipeEnvelope => {
  const { integrity: _integrity, ...unsigned } = envelope;
  return { ...unsigned, integrity: deriveRecipeIntegrity(unsigned) };
};
const walk = (node: IRNode, visit: (node: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
};
const byRole = (root: IRNode, role: string): IRNode[] => {
  const matches: IRNode[] = [];
  walk(root, (node) => {
    if (node.role === role) matches.push(node);
  });
  return matches;
};

test("combobox@1 compiles two reviewed real sources through one generic recipe", () => {
  for (const [source, config] of sources) {
    const started = performance.now();
    const instance = adaptReviewedCombobox(source, config);
    const first = compileComboboxRecipe(instance);
    const collapsed1 = collapseComboboxRecipe(
      first,
      instance.provenance.selection,
    );
    const second = compileComboboxRecipe(collapsed1);
    const collapsed2 = collapseComboboxRecipe(
      second,
      instance.provenance.selection,
    );
    const third = compileComboboxRecipe(collapsed2);
    assert.equal(first.integrity.canonicalHash, second.integrity.canonicalHash);
    assert.equal(second.integrity.canonicalHash, third.integrity.canonicalHash);
    assert.ok(
      performance.now() - started <
        COMBOBOX_PAIRED_PROOF_PROTOCOL.performanceBoundsMs
          .adaptCompileCollapseTwoCyclesPerSource,
    );
    const report = auditComboboxAccounting(instance, first);
    assert.equal(report.factsCompared, instance.inputFacts.length);
    assert.equal(report.measuredLandings, instance.inputFacts.length);
    assert.ok(report.factsCompared > 100);
    assert.deepEqual(report.failures, []);
  }
  const generic = [
    "recipe/recipes/combobox.ts",
    "recipe/adapters/combobox.ts",
    "recipe/output/combobox.ts",
  ]
    .map((path) => readFileSync(path, "utf8").toLowerCase())
    .join("\n");
  for (const forbidden of ["@mui", "mui.", "material", "antd", "ant-design"])
    assert.equal(
      generic.includes(forbidden),
      false,
      `${forbidden} must remain adapter fixture data`,
    );
});

test("canonical IR has exact useful component and instance structure", () => {
  const envelope = compileComboboxRecipe(canonicalComboboxRecipeInstance);
  assert.equal(envelope.ir.kind, "frame");
  const counts: Record<string, number> = {};
  walk(envelope.ir, (node) => {
    counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  });
  assert.deepEqual(counts, {
    frame: 193,
    "component-set": 2,
    component: COMBOBOX_PAIRED_PROOF_PROTOCOL.expected.components,
    text: 220,
    instance: COMBOBOX_PAIRED_PROOF_PROTOCOL.expected.instances,
  });
  assert.equal(byRole(envelope.ir, "combobox/set").length, 1);
  assert.equal(byRole(envelope.ir, "combobox/option-set").length, 1);
  assert.equal(byRole(envelope.ir, "combobox/trigger").length, 64);
  assert.equal(byRole(envelope.ir, "combobox/overlay").length, 32);
  assert.equal(byRole(envelope.ir, "combobox/listbox").length, 32);
  assert.equal(byRole(envelope.ir, "combobox/option-instance/0").length, 12);
  assert.equal(byRole(envelope.ir, "combobox/option-instance/3").length, 12);
  for (const overlay of byRole(envelope.ir, "combobox/overlay")) {
    assert.equal(overlay.kind, "frame");
    if (overlay.kind !== "frame") continue;
    assert.equal(overlay.layout.positioning, "absolute");
    assert.equal(overlay.layout.constraints?.horizontal, "left");
    assert.ok((overlay.layout.offset?.y ?? 0) > 0);
  }
  assert.deepEqual(canonicalComboboxRecipeInstance.designerEditSurface, {
    textProperties: [
      "Label",
      "Placeholder",
      "Helper text",
      "Error text",
      "Empty text",
      "Loading text",
    ],
    variantProperties: [
      "Size",
      "Appearance",
      "Open",
      "Field state",
      "Content",
      "Option state",
    ],
    instanceSwapProperties: [
      "Leading control",
      "Clear indicator",
      "Popup indicator",
      "Selected indicator",
    ],
    optionCollection: {
      componentRef: "combobox@1/option",
      repeatedAs: "instances",
      editableProperties: ["Label", "Value", "Disabled"],
    },
    resize: {
      root: "fixed-width",
      trigger: "fill-container",
      overlay: "match-trigger-width",
      vertical: "hug-contents",
    },
    structuralEdits: "refuse",
  });
});

test("legacy required-facts seed evolves into measured combobox invariants", () => {
  const envelope = compileComboboxRecipe(canonicalComboboxRecipeInstance);
  assert.equal(envelope.ir.kind, "frame");
  if (envelope.ir.kind !== "frame") return;
  const measured = measureComboboxRequiredFacts(envelope.ir);
  assert.deepEqual(
    measured.map((fact) => fact.requiredFactId),
    [
      "select/box-grammar",
      "select/padding-inline",
      "select/width-rule",
      "select/chevron",
      "select/height",
      "select/detached-listbox",
      "select/option-instance-repetition",
    ],
  );
  assert.equal(
    measured.every((fact) => fact.status === "measured"),
    true,
  );
  const planted = structuredClone(envelope.ir);
  const trigger = byRole(planted, "combobox/trigger")[0];
  assert.equal(trigger?.kind, "frame");
  if (trigger?.kind === "frame") trigger.layout.padding.left = 0;
  assert.equal(
    measureComboboxRequiredFacts(planted).find(
      (fact) => fact.requiredFactId === "select/padding-inline",
    )?.status,
    "missing",
  );
});

test("inverse refuses every hard structural and semantic plant by name", () => {
  const clean = compileComboboxRecipe(canonicalComboboxRecipeInstance);
  const selection = canonicalComboboxRecipeInstance.provenance.selection;
  const plants: Array<[string, (root: FrameNode) => void, RegExp]> = [
    [
      "missing trigger",
      (root) => {
        const set = byRole(root, "combobox/set")[0];
        assert.equal(set?.kind, "component-set");
        if (set?.kind === "component-set")
          set.children[0]!.children = set.children[0]!.children.filter(
            (node) => node.role !== "combobox/trigger",
          );
      },
      /required combobox\/trigger/,
    ],
    [
      "missing overlay",
      (root) => {
        const open = byRole(root, "combobox/overlay")[0];
        assert.ok(open);
        walk(root, (node) => {
          if (
            node.kind === "component" &&
            node.children.includes(open as never)
          )
            node.children = node.children.filter((child) => child !== open);
        });
      },
      /Open axis disagrees with overlay presence/,
    ],
    [
      "broken anchor",
      (root) => {
        const overlay = byRole(root, "combobox/overlay")[0];
        if (overlay?.kind === "frame") overlay.layout.positioning = "auto";
      },
      /absolute positioning requires explicit offset|broken anchor\/overlay/,
    ],
    [
      "non-instance repetition",
      (root) => {
        const option = byRole(root, "combobox/option-instance/0")[0];
        if (option?.kind === "instance") option.componentRef = "flat/rectangle";
      },
      /non-instance repetition/,
    ],
    [
      "selected highlighted collapse",
      (root) => {
        const set = byRole(root, "combobox/option-set")[0];
        if (set?.kind !== "component-set") return;
        const highlighted = set.children.find(
          (node) =>
            node.variantProperties.Size === "small" &&
            node.variantProperties["Option state"] === "highlighted",
        )!;
        const normal = set.children.find(
          (node) =>
            node.variantProperties.Size === "small" &&
            node.variantProperties["Option state"] === "default",
        )!;
        highlighted.fills = structuredClone(normal.fills);
        highlighted.bindings = structuredClone(normal.bindings);
        highlighted.children = structuredClone(normal.children);
      },
      /selected\/highlighted collapse/,
    ],
    [
      "fake layout",
      (root) => {
        const listbox = byRole(root, "combobox/listbox")[0];
        if (listbox?.kind === "frame") listbox.layout.mode = "none";
      },
      /listbox must be a fill-width vertical stack|fake layout/,
    ],
    [
      "missing binding",
      (root) => {
        const trigger = byRole(root, "combobox/trigger")[0];
        if (trigger?.kind === "frame")
          trigger.bindings = trigger.bindings?.filter(
            (binding) => binding.field !== "layout.height.value",
          );
      },
      /required binding layout\.height\.value|unsupported structural edit/,
    ],
    [
      "unknown structural role",
      (root) => {
        const trigger = byRole(root, "combobox/trigger")[0];
        if (trigger) trigger.role = "hand-built/rectangle";
      },
      /required combobox\/trigger|unknown structural edit/,
    ],
  ];
  for (const [name, mutate, expected] of plants) {
    const planted = structuredClone(clean);
    assert.equal(planted.ir.kind, "frame");
    if (planted.ir.kind !== "frame") continue;
    mutate(planted.ir);
    assert.throws(
      () => collapseComboboxRecipe(resign(planted), selection),
      expected,
      name,
    );
  }
  const invalid = structuredClone(
    canonicalComboboxRecipeInstance,
  ) as ComboboxRecipeInstance;
  (invalid.semantic as { selection: string }).selection = "multiple";
  assert.throws(
    () => compileComboboxRecipe(invalid),
    /invalid ARIA\/data model/,
  );
  assert.throws(
    () => collapseComboboxRecipe(clean, undefined),
    /recipe selection is absent/,
  );
  assert.throws(
    () =>
      collapseComboboxRecipe(clean, {
        ...selection,
        candidates: [
          { id: "combobox", version: 1 },
          { id: "input-field", version: 1 },
        ],
      }),
    /recipe selection is ambiguous/,
  );
});

test("source occurrence audit catches omission, mislabelling, and duplicate collapse", () => {
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const clean = auditReviewedComboboxAcquisition(
    muiComboboxSource,
    muiComboboxAdapterConfig,
    instance,
  );
  assert.ok(clean.occurrences > 100);
  assert.ok(clean.ir > 0 && clean.extensions > 0 && clean.refusals > 0);
  assert.deepEqual(clean.failures, []);

  const omitted = structuredClone(
    muiComboboxAdapterConfig,
  ) as ReviewedComboboxAdapterConfig;
  omitted.sourceFacts = omitted.sourceFacts.filter(
    (fact) => fact.target !== "tokens.sizes.medium.triggerHeight",
  );
  omitted.manualMappings = omitted.sourceFacts.map(
    (fact) => `${fact.occurrenceId}→${fact.target}`,
  );
  const auditedOmission = auditReviewedComboboxAcquisition(
    muiComboboxSource,
    omitted,
    instance,
  );
  assert.equal(
    auditedOmission.occurrences,
    clean.occurrences - 1,
    "the denominator makes the planted omission visible",
  );
  assert.match(
    auditedOmission.failures.join("\n"),
    /tokens\.sizes\.medium\.triggerHeight: selected source occurrence is missing/,
  );

  const mislabeled = structuredClone(
    muiComboboxAdapterConfig,
  ) as ReviewedComboboxAdapterConfig;
  const index = mislabeled.sourceFacts.findIndex(
    (fact) => fact.target === "tokens.sizes.medium.triggerHeight",
  );
  assert.notEqual(index, -1);
  mislabeled.sourceFacts[index] = {
    ...mislabeled.sourceFacts[index]!,
    category: "fill",
  };
  assert.match(
    auditReviewedComboboxAcquisition(
      muiComboboxSource,
      mislabeled,
      instance,
    ).failures.join("\n"),
    /category fill mislabels .*triggerHeight; expected geometry/,
  );

  const duplicate = structuredClone(
    muiComboboxAdapterConfig,
  ) as ReviewedComboboxAdapterConfig;
  duplicate.sourceFacts.push({
    ...duplicate.sourceFacts[0]!,
    occurrenceId: "mui-duplicate-collapse",
  });
  duplicate.manualMappings.push("duplicate");
  assert.match(
    auditReviewedComboboxAcquisition(
      muiComboboxSource,
      duplicate,
      instance,
    ).failures.join("\n"),
    /duplicate collapse/,
  );
});

test("paired matrix is frozen before results and cannot flatter the weak legacy stub", () => {
  const protocol = COMBOBOX_PAIRED_PROOF_PROTOCOL;
  assert.equal(protocol.frozenBeforeResults, true);
  assert.equal(protocol.resultStatus, "not-run");
  assert.equal(protocol.cellsPerSource, 12);
  assert.equal(protocol.totalCells, 24);
  assert.ok(protocol.cells.some((cell) => cell.includes("open")));
  assert.ok(protocol.cells.some((cell) => cell.includes("loading")));
  assert.ok(protocol.cells.some((cell) => cell.includes("empty")));
  assert.ok(protocol.cells.some((cell) => cell.includes("disabled")));
  assert.ok(protocol.cells.some((cell) => cell.includes("error")));
  assert.equal(protocol.expected.comboboxVariants, 64);
  assert.equal(protocol.expected.optionVariants, 8);
  assert.equal(protocol.expected.instances, 242);
  assert.match(protocol.comparison.legacyContext, /six weak variants/);
  assert.equal(protocol.comparison.sourceReferencesRendered, false);
  assert.equal(protocol.comparison.aiGrading, false);
  assert.equal(protocol.comparison.liveFigma, false);
});

test("React/WC output is deterministic, semantic, and injection-safe", () => {
  const envelope = compileComboboxRecipe(canonicalComboboxRecipeInstance);
  const first = emitComboboxOutputs(
    envelope,
    canonicalComboboxRecipeInstance.provenance.selection,
  );
  const second = emitComboboxOutputs(
    envelope,
    canonicalComboboxRecipeInstance.provenance.selection,
  );
  assert.deepEqual(first, second);
  const react = first.react.find((file) =>
    file.path.endsWith(".tsx"),
  )!.contents;
  const wc = first.webComponent.find((file) =>
    file.path.endsWith(".js"),
  )!.contents;
  for (const source of [react, wc]) {
    assert.match(source, /aria-activedescendant/);
    assert.match(source, /aria-expanded/);
    assert.match(source, /aria-controls/);
    assert.match(source, /ArrowDown/);
    assert.match(source, /Escape/);
  }
  assert.doesNotMatch(wc, /shadowRoot\.innerHTML|innerHTML\s*=/);
  assert.match(wc, /textContent/);
  assert.match(wc, /replaceChildren/);

  const attack = structuredClone(
    canonicalComboboxRecipeInstance,
  ) as ComboboxRecipeInstance;
  attack.tokens.typography.input.requestedFamily =
    "Inter; } body{display:none}/*";
  attack.tokens.typography.input.resolvedFamily =
    "Inter; } body{display:none}/*";
  attack.tokens.typography.input.fallbackChain[0]!.family =
    "Inter; } body{display:none}/*";
  assert.throws(
    () =>
      emitComboboxOutputs(
        compileComboboxRecipe(attack),
        attack.provenance.selection,
      ),
    /unsafe font-family/,
  );
  const collision = structuredClone(
    canonicalComboboxRecipeInstance,
  ) as ComboboxRecipeInstance;
  collision.tokens.overlay.background.variable = "collision.a";
  collision.tokens.overlay.border.variable = "collision-a";
  assert.throws(
    () =>
      emitComboboxOutputs(
        compileComboboxRecipe(collision),
        collision.provenance.selection,
      ),
    /token-name collision/,
  );
  assert.throws(
    () => assertSafeOutputFiles([{ path: "react/../../escape.ts" }], "react"),
    /escapes react/,
  );
});
