import assert from "node:assert/strict";
import test from "node:test";
import { proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import {
  tokensByPropEntries,
  resolveTokens,
  type Part,
} from "../scripts/contract-schema.js";
import type { DumpSet } from "../extract/figma/types.js";

const corpus = tokenCorpusFromJson({
  primitives: {
    paint: {
      a: { $type: "color", $value: "#ffffff" },
      b: { $type: "color", $value: "#000000" },
    },
    radii: {
      a: { $type: "dimension", $value: "4px" },
      b: { $type: "dimension", $value: "8px" },
    },
  },
  semantic: {},
  light: {},
  brandDefault: {},
});

test("letter spacing carries signed pixels and names mixed or partial evidence", () => {
  for (const [values, expected] of [
    [[1, 1], "1px"],
    [[-0.5, -0.5], "-0.5px"],
    [[0, 0], undefined],
    [[undefined, undefined], undefined],
    [[1, 2], undefined],
    [[1, undefined], undefined],
  ] as Array<[Array<number | undefined>, string | undefined]>) {
    const dump = specimen(false);
    dump.variants.forEach((variant, i) => {
      variant.children = [
        {
          name: "label",
          type: "TEXT",
          text: {
            characters: "Label",
            fontSize: 12,
            fontStyle: "Regular",
            lineHeight: 20,
            letterSpacing: values[i],
          },
        },
      ];
    });
    const result = proposeFromDump(dump, {
      corpus,
      contractIdByName: new Map(),
      fileKey: null,
      projectionMode: "reviewable-inversion",
    });
    const part = (result.contract.anatomy as { root: Part }).root;
    assert.equal(part.literals?.["letter-spacing"], expected);
    if (values[0] !== values[1])
      assert.ok(
        result.notes.some((n) =>
          n.includes("letter-spacing is mixed, partial"),
        ),
      );
  }
});
function specimen(twoAxes = true): DumpSet {
  const tones = ["Danger", "Neutral"];
  const shapes = twoAxes ? ["Label", "Dot"] : ["Label"];
  return {
    setName: "Specimen",
    type: "COMPONENT_SET",
    propertyDefinitions: {
      Tone: { type: "VARIANT", defaultValue: "Danger", variantOptions: tones },
      Shape: { type: "VARIANT", defaultValue: "Label", variantOptions: shapes },
    },
    variants: tones.flatMap((tone) =>
      shapes.map((shape) => ({
        name: `Tone=${tone}, Shape=${shape}`,
        type: "COMPONENT" as const,
        variantProperties: { Tone: tone, Shape: shape },
        layout: {
          mode: "HORIZONTAL" as const,
          primary: "CENTER" as const,
          counter: "CENTER" as const,
          padding: [0, 0, 0, 0] as [number, number, number, number],
          primarySizing: "AUTO" as const,
          counterSizing: "AUTO" as const,
        },
        fill: { var: tone === "Danger" ? "paint/a" : "paint/b" },
        bound: Object.fromEntries(
          [
            "topLeftRadius",
            "topRightRadius",
            "bottomLeftRadius",
            "bottomRightRadius",
          ].map((k) => [k, shape === "Label" ? "radii/a" : "radii/b"]),
        ),
      })),
    ),
  };
}
test("independent paint and radius axes both survive the canvas proposer", () => {
  const proposal = proposeFromDump(specimen(), {
    corpus,
    contractIdByName: new Map(),
    fileKey: null,
    projectionMode: "reviewable-inversion",
  });
  const root = (proposal.contract.anatomy as { root: Part }).root;
  assert.deepEqual(
    tokensByPropEntries(root).map((e) => e.prop),
    ["tone", "shape"],
  );
  for (const tone of ["danger", "neutral"])
    for (const shape of ["label", "dot"]) {
      const tokens = resolveTokens(root, { tone, shape });
      assert.equal(
        tokens["background-color"],
        tone === "danger" ? "{paint.a}" : "{paint.b}",
      );
      assert.equal(
        tokens["border-radius"],
        shape === "label" ? "{radii.a}" : "{radii.b}",
      );
    }
});

test("partially bound FIXED dimensions do not suppress the mixed HUG/FIXED size carrier", () => {
  const dump = specimen();
  for (const variant of dump.variants) {
    const dot = variant.variantProperties?.Shape === "Dot";
    variant.bbox = { width: dot ? 8 : 57, height: dot ? 8 : 20 };
    if (dot) {
      variant.layout!.primarySizing = "FIXED";
      variant.layout!.counterSizing = "FIXED";
      variant.bound = { ...variant.bound, width: "radii/b", height: "radii/b" };
    }
  }
  const proposal = proposeFromDump(dump, {
    corpus,
    contractIdByName: new Map(),
    fileKey: null,
    projectionMode: "reviewable-inversion",
    mintUnbound: true,
  });
  const root = (proposal.contract.anatomy as { root: Part }).root;
  for (const tone of ["danger", "neutral"]) {
    const dot = resolveTokens(root, { tone, shape: "dot" });
    assert.ok(dot.width, "a bound FIXED dot must not collapse to CSS auto");
    assert.ok(dot.height);
    assert.match(dot.width, /\{shape\}/, "mixed size must remain conditional");
  }
  const minted = proposal.mintedTokens!.tree as any;
  assert.equal(minted.imported.specimen.root.width.dot.$value, "8px");
  assert.equal(minted.imported.specimen.root.width.label.$value, "fit-content");
});
test("single-axis proposals keep the backwards-compatible object spelling", () => {
  const proposal = proposeFromDump(specimen(false), {
    corpus,
    contractIdByName: new Map(),
    fileKey: null,
    projectionMode: "reviewable-inversion",
  });
  const root = (proposal.contract.anatomy as { root: Part }).root;
  assert.equal(Array.isArray(root.tokensByProp), false);
  assert.deepEqual(
    tokensByPropEntries(root).map((e) => e.prop),
    ["tone"],
  );
});

test("uniform fixed root widths preserve their binding and an independent maximum", () => {
  for (const mode of ["HORIZONTAL", "VERTICAL", "GRID", "NONE"] as const) {
    const dump = specimen(false);
    for (const variant of dump.variants) {
      variant.bbox = { width: 4, height: 8 };
      variant.bound = { ...variant.bound, width: "radii/a", maxWidth: "radii/b" };
      if (mode === "NONE") delete variant.layout;
      else {
        variant.layout!.mode = mode;
        variant.layout!.primarySizing = mode === "VERTICAL" ? "AUTO" : "FIXED";
        variant.layout!.counterSizing = mode === "VERTICAL" ? "FIXED" : "AUTO";
      }
    }
    const result = proposeFromDump(dump, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: "reviewable-inversion", mintUnbound: true });
    const root = (result.contract.anatomy as { root: Part }).root;
    assert.equal(root.tokens?.width, "{radii.a}", mode);
    assert.equal(root.tokens?.["max-width"], "{radii.b}", mode);
    assert.ok(result.notes.some(n => n.includes("bound root width retained as width")));
  }
});

test("fill, hug, mixed, unknown and unmeasured root sizing never gain a fixed binding from one plane", () => {
  for (const kind of ["fill", "hug", "mixed", "unknown", "unmeasured", "zero", "negative", "nonfinite"] as const) {
    const dump = specimen(false);
    dump.variants.forEach((variant, index) => {
      variant.bbox = { width: 4, height: 8 };
      variant.bound = { ...variant.bound, width: "radii/a" };
      variant.layout!.primarySizing = kind === "hug" || (kind === "mixed" && index === 1) ? "AUTO" : "FIXED";
      if (kind === "fill") variant.fillWidth = true;
      if (kind === "unknown" && index === 1) Reflect.deleteProperty(variant.layout!, "primarySizing");
      if (index === 1) {
        if (kind === "unmeasured") delete variant.bbox;
        if (kind === "zero") variant.bbox!.width = 0;
        if (kind === "negative") variant.bbox!.width = -1;
        if (kind === "nonfinite") variant.bbox!.width = Number.NaN;
      }
    });
    const result = proposeFromDump(dump, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: "reviewable-inversion", mintUnbound: true });
    const root = (result.contract.anatomy as { root: Part }).root;
    assert.equal(root.tokens?.width, undefined, kind);
    assert.equal(root.tokens?.["max-width"], "{radii.a}", kind);
    assert.ok(result.notes.some(n => n.includes("mixed/HUG/FILL behavior requires review")));
  }
});

test("partial padding bindings retain measured sides without replacing a carried binding", () => {
  const dump = specimen();
  for (const variant of dump.variants) {
    const label = variant.variantProperties!.Shape === "Label";
    variant.layout!.padding = [4, label ? 8 : 0, 4, label ? 8 : 0];
    variant.bound = {
      ...variant.bound,
      paddingTop: "radii/a",
      paddingBottom: "radii/a",
      ...(label ? { paddingLeft: "radii/b", paddingRight: "radii/b" } : {}),
    };
  }
  const options = {
    corpus,
    contractIdByName: new Map<string, string>(),
    fileKey: null,
    projectionMode: "reviewable-inversion" as const,
  };
  const result = proposeFromDump(dump, { ...options, mintUnbound: true });
  const part = (result.contract.anatomy as { root: Part }).root;
  const tokens = resolveTokens(part, { tone: "danger", shape: "label" });
  assert.equal(
    tokens["padding-block"],
    "{radii.a}",
    "carried variable identity wins",
  );
  assert.ok(tokens["padding-left"], "partially bound side must not vanish");
  assert.ok(tokens["padding-right"]);
  const tree = result.mintedTokens!.tree as any;
  assert.equal(tree.imported.specimen.root["padding-left"].label.$value, "8px");
  assert.equal(tree.imported.specimen.root["padding-left"].dot.$value, "0px");
  assert.ok(
    result.notes.some(
      (note) =>
        note.includes("captured padding values") &&
        note.includes("binding identity"),
    ),
  );
  const withoutMint = proposeFromDump(dump, options);
  const unminted = resolveTokens(
    (withoutMint.contract.anatomy as { root: Part }).root,
    { tone: "danger", shape: "label" },
  );
  assert.equal(
    unminted["padding-left"],
    undefined,
    "mint-off still refuses partial bindings",
  );
});
