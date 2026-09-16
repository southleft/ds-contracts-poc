import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import {
  createFigmaEngine,
  type FigmaEngineInput,
  type NodeSpec,
} from "./emit-figma-script.js";

/** Compiler context conformance only: no native Figma mode/binding claim. */
const leaf = ($type: string, $value: string | number) => ({ $type, $value });
const tokens = {
  primitives: {
    measure: {
      small: leaf("dimension", "14px"),
      large: leaf("dimension", "22px"),
      short: leaf("dimension", "20px"),
      tall: leaf("dimension", "30px"),
      narrow: leaf("dimension", "90px"),
      wide: leaf("dimension", "140px"),
      tight: leaf("dimension", "1px"),
      loose: leaf("dimension", "2px"),
    },
    weight: { regular: leaf("number", 400), bold: leaf("number", 700) },
    family: {
      plain: leaf("fontFamily", "Inter"),
      alternate: leaf("fontFamily", "Arial"),
    },
    ink: { day: leaf("color", "#112233"), night: leaf("color", "#ddeeff") },
  },
  semantic: {
    font: {
      control: {
        size: leaf("dimension", "{measure.small}"),
        weight: leaf("number", "{weight.regular}"),
        family: leaf("fontFamily", "{brand.family}"),
      },
    },
    button: { width: leaf("dimension", "{brand.width}") },
  },
  light: {
    font: {
      control: {
        size: leaf("dimension", "{measure.small}"),
        weight: leaf("number", "{weight.regular}"),
        lineHeight: leaf("dimension", "{measure.short}"),
        tracking: leaf("dimension", "{measure.tight}"),
      },
    },
    color: { ink: leaf("color", "{ink.day}") },
  },
  dark: {
    font: {
      control: {
        size: leaf("dimension", "{measure.large}"),
        weight: leaf("number", "{weight.bold}"),
        lineHeight: leaf("dimension", "{measure.tall}"),
        tracking: leaf("dimension", "{measure.loose}"),
      },
    },
    color: { ink: leaf("color", "{ink.night}") },
  },
  brands: {
    default: {
      brand: {
        family: leaf("fontFamily", "{family.plain}"),
        width: leaf("dimension", "{measure.narrow}"),
      },
    },
    alternate: {
      brand: {
        family: leaf("fontFamily", "{family.alternate}"),
        width: leaf("dimension", "{measure.wide}"),
      },
    },
  },
};

function fixture(): Contract {
  return ContractSchema.parse({
    id: "check.context",
    name: "ContextProbe",
    version: "0.1.0",
    status: "draft",
    description: "Explicit compile context conformance",
    archetype: "none",
    props: [],
    states: [],
    semantics: { element: "div" },
    anatomy: {
      root: {
        layout: { display: "flex" },
        tokens: { width: "{button.width}" },
        literals: { "padding-block": "5px", "padding-inline": "7px" },
        parts: {
          label: {
            text: "Observed text",
            tokens: {
              "font-size": "{font.control.size}",
              "font-weight": "{font.control.weight}",
              "font-family": "{font.control.family}",
              "line-height": "{font.control.lineHeight}",
              "letter-spacing": "{font.control.tracking}",
              color: "{color.ink}",
            },
          },
          literal: {
            text: "Literal text",
            literals: {
              "font-size": "13px",
              "line-height": "19px",
              color: "#123456",
            },
          },
        },
      },
    },
    bindings: {
      code: {
        anchors: { importPath: "checks/ContextProbe", export: "ContextProbe" },
      },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
}
const makeEngine = (context: Record<string, unknown> = {}) =>
  createFigmaEngine({
    tokens,
    icons: new Map(),
    ...context,
  } as FigmaEngineInput);
function compile(context: Record<string, unknown> = {}) {
  const engine = makeEngine(context);
  const contract = fixture();
  const contracts = new Map([[contract.id, contract]]);
  const data = engine.compileComponentData(contract, contracts);
  return { engine, contract, contracts, data, root: data.variants[0].spec };
}
function named(root: NodeSpec, name: string): NodeSpec {
  const found = root.children?.find((child) => child.name === name);
  assert.ok(found, `compiler must retain ${name}`);
  return found;
}

test("explicit mode and brand independently drive token literals, numeric typography and dimensions", () => {
  const expected = [
    {
      mode: "light",
      brand: "default",
      size: 14,
      weight: "Regular",
      line: 20,
      tracking: 1,
      family: "Inter",
      width: 90,
      ink: "#112233",
    },
    {
      mode: "dark",
      brand: "default",
      size: 22,
      weight: "Bold",
      line: 30,
      tracking: 2,
      family: "Inter",
      width: 90,
      ink: "#ddeeff",
    },
    {
      mode: "light",
      brand: "alternate",
      size: 14,
      weight: "Regular",
      line: 20,
      tracking: 1,
      family: "Arial",
      width: 140,
      ink: "#112233",
    },
    {
      mode: "dark",
      brand: "alternate",
      size: 22,
      weight: "Bold",
      line: 30,
      tracking: 2,
      family: "Arial",
      width: 140,
      ink: "#ddeeff",
    },
  ];
  for (const row of expected) {
    const { engine, root } = compile(row);
    const label = named(root, "label");
    assert.deepEqual(
      {
        size: label.fontSize,
        weight: label.fontStyle,
        line: label.lineHeight,
        tracking: label.letterSpacing,
        family: label.fontFamily,
        width: root.fixedWidth?.px,
        ink: engine.resolveTokenLiteral("color.ink"),
      },
      {
        size: row.size,
        weight: row.weight,
        line: { value: row.line, unit: "PIXELS" },
        tracking: row.tracking,
        family: row.family,
        width: row.width,
        ink: row.ink,
      },
      `${row.mode}/${row.brand}`,
    );
    assert.equal(
      label.textFill,
      "color/ink",
      "token identity is not replaced with a literal",
    );
    const stylesMatch = engine
      .buildTokensScript(null)
      .match(/^const TEXT_STYLES = (.+);$/m);
    assert.ok(stylesMatch, "actual token script carries derived typography");
    const styles = JSON.parse(stylesMatch[1]) as Array<{
      name: string;
      fontSize: number;
      fontStyle: string;
    }>;
    const control = styles.find((style) => style.name === "control");
    assert.ok(control);
    assert.equal(control.fontSize, row.size);
    assert.equal(control.fontStyle, row.weight);
  }
});

test("omitted context remains byte-identical to explicit light/default; authored literals never change", () => {
  const legacy = compile();
  const explicit = compile({ mode: "light", brand: "default" });
  assert.deepEqual(legacy.data, explicit.data);
  assert.equal(
    legacy.engine.buildTokensScript(null),
    explicit.engine.buildTokensScript(null),
  );
  assert.equal(
    legacy.engine.buildComponentScript(legacy.contract, legacy.contracts),
    explicit.engine.buildComponentScript(explicit.contract, explicit.contracts),
  );
  const selected = compile({ mode: "dark", brand: "alternate" });
  assert.deepEqual(
    named(selected.root, "literal"),
    named(legacy.root, "literal"),
  );
  assert.deepEqual(selected.root.lits, legacy.root.lits);
});

test("invalid requested mode or brand refuses instead of falling back", () => {
  for (const mode of ["", "Dark", "sepia", null, 0])
    assert.throws(() => makeEngine({ mode }), /FIGMA_CONTEXT_MODE_INVALID/);
  for (const brand of [
    "",
    "missing",
    "DEFAULT",
    "__proto__",
    "constructor",
    null,
    0,
  ])
    assert.throws(() => makeEngine({ brand }), /FIGMA_CONTEXT_BRAND_INVALID/);
  const noDark = structuredClone(tokens) as Record<string, unknown>;
  delete noDark.dark;
  assert.throws(
    () =>
      createFigmaEngine({
        tokens: noDark,
        icons: new Map(),
        mode: "dark",
      } as unknown as FigmaEngineInput),
    /FIGMA_CONTEXT_MODE_INVALID/,
  );
  const noDefault = structuredClone(tokens);
  delete (noDefault.brands as Record<string, unknown>).default;
  assert.throws(
    () => createFigmaEngine({ tokens: noDefault, icons: new Map() }),
    /FIGMA_CONTEXT_BRAND_INVALID/,
  );
});

test("selecting a context does not grant retained-runtime Figma admission", () => {
  const { contract, engine, contracts } = compile({
    mode: "dark",
    brand: "alternate",
  });
  const revision = `sha256:${"1".repeat(64)}`;
  contract.bindings.code.runtime = {
    version: 1,
    kind: "custom-element",
    artifactRevision: revision,
    interfaceRevision: revision,
    bindingRevision: revision,
  };
  assert.throws(
    () => engine.compileComponentData(contract, contracts),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
  assert.throws(
    () => engine.buildComponentScript(contract, contracts),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
});
