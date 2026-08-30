import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditTableAccounting } from "./accounting.js";
import {
  adaptReviewedTable,
  auditReviewedTableAcquisition,
  type ReviewedTableAdapterConfig,
} from "./adapters/table.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalTableRecipeInstance } from "./fixtures/table.js";
import {
  TABLE_PAIRED_PROOF_PROTOCOL,
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
  muiTableAdapterConfig,
  muiTableSource,
} from "./fixtures/library-tables.js";
import type { FrameNode, IRNode } from "./figma-ir.js";
import { deriveRecipeIntegrity, hashRecipeEnvelope } from "./hash.js";
import { emitTableOutputs } from "./output/table.js";
import { assertSafeOutputFiles } from "./output-safety.js";
import {
  collapseTableRecipe,
  compileTableRecipe,
  type TableRecipeInstance,
} from "./recipes/table.js";
import { RecipeRefusal } from "./recipe.js";
import { measureTableRequiredFacts } from "./required-facts.js";

const sources = [
  [firstPartyTableSource, firstPartyTableAdapterConfig],
  [muiTableSource, muiTableAdapterConfig],
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

test("table@1 compiles two reviewed real sources through one generic recipe", () => {
  for (const [source, config] of sources) {
    const started = performance.now();
    const instance = adaptReviewedTable(source, config);
    const first = compileTableRecipe(instance);
    const collapsed1 = collapseTableRecipe(
      first,
      instance.provenance.selection,
    );
    const second = compileTableRecipe(collapsed1);
    const collapsed2 = collapseTableRecipe(
      second,
      instance.provenance.selection,
    );
    const third = compileTableRecipe(collapsed2);
    assert.equal(first.integrity.canonicalHash, second.integrity.canonicalHash);
    assert.equal(second.integrity.canonicalHash, third.integrity.canonicalHash);
    assert.ok(
      performance.now() - started <
        TABLE_PAIRED_PROOF_PROTOCOL.performanceBoundsMs
          .adaptCompileCollapseTwoCyclesPerSource,
    );
    const report = auditTableAccounting(instance, first);
    assert.equal(report.factsCompared, instance.inputFacts.length);
    assert.equal(report.measuredLandings, instance.inputFacts.length);
    assert.ok(report.factsCompared > 40);
    assert.deepEqual(report.failures, []);
  }
  const generic = [
    "recipe/recipes/table.ts",
    "recipe/adapters/table.ts",
    "recipe/output/table.ts",
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
  const envelope = compileTableRecipe(canonicalTableRecipeInstance);
  assert.equal(envelope.ir.kind, "frame");
  const counts: Record<string, number> = {};
  walk(envelope.ir, (node) => {
    counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  });
  assert.deepEqual(counts, {
    frame: 5,
    "component-set": 3,
    component: TABLE_PAIRED_PROOF_PROTOCOL.expected.components,
    text: 4,
    instance: TABLE_PAIRED_PROOF_PROTOCOL.expected.instances,
  });
  assert.equal(byRole(envelope.ir, "table/set").length, 1);
  assert.equal(byRole(envelope.ir, "table/row-set").length, 1);
  assert.equal(byRole(envelope.ir, "table/cell-set").length, 1);
  assert.equal(byRole(envelope.ir, "table/header").length, 2);
  assert.equal(byRole(envelope.ir, "table/body").length, 2);
  assert.equal(byRole(envelope.ir, "table/header-cell-instance/0").length, 2);
  assert.equal(byRole(envelope.ir, "table/header-cell-instance/2").length, 2);
  assert.equal(byRole(envelope.ir, "table/row-instance/0").length, 2);
  assert.equal(byRole(envelope.ir, "table/cell-instance/0").length, 4);
  assert.deepEqual(canonicalTableRecipeInstance.designerEditSurface, {
    textProperties: ["Label", "Column", "Cell 0", "Cell 1", "Cell 2"],
    variantProperties: ["Density", "State", "Kind"],
    instanceSwapProperties: [],
    columnAxis: {
      count: 3,
      editableProperties: ["Label", "Column", "Align"],
    },
    rowCollection: {
      componentRef: "table@1/row",
      repeatedAs: "instances",
      editableProperties: ["State", "Cell 0", "Cell 1", "Cell 2"],
    },
    cellTemplate: {
      componentRef: "table@1/cell",
      repeatedAs: "instances",
      editableProperties: ["Label", "Column", "Kind"],
    },
    resize: {
      root: "hug-contents",
      row: "hug-contents",
      cell: "hug-contents",
    },
    structuralEdits: "refuse",
  });
});

test("legacy required-facts seed evolves into measured table invariants", () => {
  const envelope = compileTableRecipe(canonicalTableRecipeInstance);
  assert.equal(envelope.ir.kind, "frame");
  if (envelope.ir.kind !== "frame") return;
  const measured = measureTableRequiredFacts(envelope.ir);
  assert.deepEqual(
    measured.map((fact) => fact.requiredFactId),
    [
      "table/column-stack",
      "table/cell-padding",
      "table/row-rule",
      "table/header-type",
      "table/cell-instance-repetition",
    ],
  );
  assert.equal(
    measured.every((fact) => fact.status === "measured"),
    true,
  );
  const planted = structuredClone(envelope.ir);
  const cell = byRole(planted, "table/cell/compact/body")[0];
  assert.equal(cell?.kind, "component");
  if (cell?.kind === "component") cell.layout.padding.left = 0;
  assert.equal(
    measureTableRequiredFacts(planted).find(
      (fact) => fact.requiredFactId === "table/cell-padding",
    )?.status,
    "missing",
  );
});

test("inverse refuses every hard structural and semantic plant by name", () => {
  const clean = compileTableRecipe(canonicalTableRecipeInstance);
  const selection = canonicalTableRecipeInstance.provenance.selection;
  const plants: Array<[string, (root: FrameNode) => void, RegExp]> = [
    [
      "missing header",
      (root) => {
        const set = byRole(root, "table/set")[0];
        assert.equal(set?.kind, "component-set");
        if (set?.kind === "component-set")
          set.children[0]!.children = set.children[0]!.children.filter(
            (node) => node.role !== "table/header",
          );
      },
      /required table\/header/,
    ],
    [
      "non-instance repetition",
      (root) => {
        const cell = byRole(root, "table/header-cell-instance/0")[0];
        if (cell?.kind === "instance") cell.componentRef = "flat/rectangle";
      },
      /non-instance repetition/,
    ],
    [
      "fake layout",
      (root) => {
        const table = byRole(root, "table/variant/comfortable")[0];
        if (table?.kind === "component") table.layout.mode = "none";
      },
      /table root must be a vertical column stack/,
    ],
    [
      "missing binding",
      (root) => {
        const cell = byRole(root, "table/cell/comfortable/body")[0];
        if (cell?.kind === "component")
          cell.bindings = cell.bindings?.filter(
            (binding) => binding.field !== "layout.padding.left",
          );
      },
      /required binding layout\.padding\.left|unsupported structural edit/,
    ],
    [
      "unknown structural role",
      (root) => {
        const header = byRole(root, "table/header")[0];
        if (header) header.role = "hand-built/rectangle";
      },
      /required table\/header|unknown structural edit/,
    ],
  ];
  for (const [name, mutate, expected] of plants) {
    const planted = structuredClone(clean);
    assert.equal(planted.ir.kind, "frame");
    if (planted.ir.kind !== "frame") continue;
    mutate(planted.ir);
    assert.throws(
      () => collapseTableRecipe(resign(planted), selection),
      expected,
      name,
    );
  }
  const invalid = structuredClone(
    canonicalTableRecipeInstance,
  ) as TableRecipeInstance;
  (invalid.semantic as { columnAxis: string }).columnAxis = "inferred";
  assert.throws(() => compileTableRecipe(invalid), /invalid ARIA\/data model/);
  assert.throws(
    () => collapseTableRecipe(clean, undefined),
    /recipe selection is absent/,
  );
  assert.throws(
    () =>
      collapseTableRecipe(clean, {
        ...selection,
        candidates: [
          { id: "table", version: 1 },
          { id: "input-field", version: 1 },
        ],
      }),
    /recipe selection is ambiguous/,
  );
});

test("source occurrence audit catches omission, mislabelling, and duplicate collapse", () => {
  const instance = adaptReviewedTable(
    firstPartyTableSource,
    firstPartyTableAdapterConfig,
  );
  const clean = auditReviewedTableAcquisition(
    firstPartyTableSource,
    firstPartyTableAdapterConfig,
    instance,
  );
  assert.ok(clean.occurrences > 40);
  assert.ok(clean.ir > 0 && clean.extensions > 0 && clean.refusals > 0);
  assert.deepEqual(clean.failures, []);

  const omitted = structuredClone(
    firstPartyTableAdapterConfig,
  ) as ReviewedTableAdapterConfig;
  omitted.sourceFacts = omitted.sourceFacts.filter(
    (fact) => fact.target !== "tokens.densities.comfortable.paddingX",
  );
  omitted.manualMappings = omitted.sourceFacts.map(
    (fact) => `${fact.occurrenceId}→${fact.target}`,
  );
  const auditedOmission = auditReviewedTableAcquisition(
    firstPartyTableSource,
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
    /tokens\.densities\.comfortable\.paddingX: selected source occurrence is missing/,
  );

  const mislabeled = structuredClone(
    firstPartyTableAdapterConfig,
  ) as ReviewedTableAdapterConfig;
  const index = mislabeled.sourceFacts.findIndex(
    (fact) => fact.target === "tokens.densities.comfortable.paddingX",
  );
  assert.notEqual(index, -1);
  mislabeled.sourceFacts[index] = {
    ...mislabeled.sourceFacts[index]!,
    category: "fill",
  };
  assert.match(
    auditReviewedTableAcquisition(
      firstPartyTableSource,
      mislabeled,
      instance,
    ).failures.join("\n"),
    /category fill mislabels .*paddingX; expected geometry/,
  );

  const duplicate = structuredClone(
    firstPartyTableAdapterConfig,
  ) as ReviewedTableAdapterConfig;
  duplicate.sourceFacts.push({
    ...duplicate.sourceFacts[0]!,
    occurrenceId: "first-party-duplicate-collapse",
  });
  duplicate.manualMappings.push("duplicate");
  assert.match(
    auditReviewedTableAcquisition(
      firstPartyTableSource,
      duplicate,
      instance,
    ).failures.join("\n"),
    /duplicate collapse/,
  );
});

test("paired matrix is frozen before results and cannot flatter an unstarted live grade", () => {
  const protocol = TABLE_PAIRED_PROOF_PROTOCOL;
  assert.equal(protocol.frozenBeforeResults, true);
  assert.equal(protocol.resultStatus, "not-run");
  assert.equal(protocol.cellsPerSource, 4);
  assert.equal(protocol.totalCells, 8);
  assert.ok(protocol.cells.some((cell) => cell.includes("compact")));
  assert.ok(protocol.cells.some((cell) => cell.includes("comfortable")));
  assert.ok(protocol.cells.some((cell) => cell.includes("selected")));
  assert.equal(protocol.expected.tableVariants, 2);
  assert.equal(protocol.expected.rowVariants, 4);
  assert.equal(protocol.expected.cellVariants, 4);
  assert.equal(protocol.expected.components, 10);
  assert.equal(protocol.expected.instances, 22);
  assert.match(protocol.comparison.legacyContext, /no live grade/);
  assert.equal(protocol.comparison.sourceReferencesRendered, false);
  assert.equal(protocol.comparison.aiGrading, false);
  assert.equal(protocol.comparison.liveFigma, false);
});

test("React/WC output is deterministic, semantic, and injection-safe", () => {
  const envelope = compileTableRecipe(canonicalTableRecipeInstance);
  const first = emitTableOutputs(
    envelope,
    canonicalTableRecipeInstance.provenance.selection,
  );
  const second = emitTableOutputs(
    envelope,
    canonicalTableRecipeInstance.provenance.selection,
  );
  assert.deepEqual(first, second);
  const react = first.react.find((file) =>
    file.path.endsWith(".tsx"),
  )!.contents;
  const wc = first.webComponent.find((file) =>
    file.path.endsWith(".js"),
  )!.contents;
  for (const source of [react, wc]) {
    assert.match(source, /role="table"|setAttribute\("role","table"\)/);
    assert.match(source, /role="row"|setAttribute\("role","row"\)/);
    assert.match(
      source,
      /role="columnheader"|setAttribute\("role","columnheader"\)/,
    );
    assert.match(source, /role="cell"|setAttribute\("role","cell"\)/);
    assert.match(source, /ArrowDown/);
    assert.match(source, /Home/);
  }
  assert.doesNotMatch(wc, /shadowRoot\.innerHTML|innerHTML\s*=/);
  assert.match(wc, /textContent/);
  assert.match(wc, /replaceChildren/);

  const attack = structuredClone(
    canonicalTableRecipeInstance,
  ) as TableRecipeInstance;
  attack.tokens.typography.body.requestedFamily =
    "Inter; } body{display:none}/*";
  attack.tokens.typography.body.resolvedFamily =
    "Inter; } body{display:none}/*";
  attack.tokens.typography.body.fallbackChain[0]!.family =
    "Inter; } body{display:none}/*";
  assert.throws(
    () =>
      emitTableOutputs(compileTableRecipe(attack), attack.provenance.selection),
    /unsafe font-family/,
  );
  const collision = structuredClone(
    canonicalTableRecipeInstance,
  ) as TableRecipeInstance;
  collision.tokens.surface.variable = "collision.a";
  collision.tokens.text.variable = "collision-a";
  assert.throws(
    () =>
      emitTableOutputs(
        compileTableRecipe(collision),
        collision.provenance.selection,
      ),
    /token-name collision/,
  );
  assert.throws(
    () => assertSafeOutputFiles([{ path: "react/../../escape.ts" }], "react"),
    /escapes react/,
  );
});

test("a dead axis is refused — two variants that compile identically", () => {
  // calendar@1 shipped exactly this class in the same session: an axis whose
  // values produced byte-identical content, so it decided nothing while a
  // designer could still click it. Closed here too, not only where it was found.
  const envelope: any = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const broken = structuredClone(envelope);
  const cellSet = broken.ir.children.find(
    (child: any) => child.role === "table/cell-set",
  );
  // Make two cell variants identical apart from their variant identity.
  const [first, second] = cellSet.children;
  const keep = {
    role: second.role,
    label: second.label,
    variantProperties: second.variantProperties,
  };
  cellSet.children[1] = { ...structuredClone(first), ...keep };
  // Re-sign, or collapse refuses on the integrity hash before it ever reaches
  // the structural check this test is about.
  broken.integrity.canonicalHash = hashRecipeEnvelope(broken);

  assert.throws(
    () => collapseTableRecipe(broken, (envelope as any).provenance.selection),
    (error: unknown) =>
      error instanceof RecipeRefusal &&
      error.findings.some((line) => line.includes("dead axis")),
    "an axis whose variants compile identically must refuse",
  );
});
