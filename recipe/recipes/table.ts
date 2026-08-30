import * as z from "zod";

import {
  ENVELOPE_VERSION,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type CodeOnlyExtension,
  type FactRef,
  type LossReceipt,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  ColorSchema,
  type ComponentNode,
  type ComponentSetNode,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity, hashRecipeEnvelope } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
  type RecipeSelection,
} from "../recipe.js";

export const TABLE_RECIPE_REF = {
  id: "table",
  version: 1,
} as const satisfies RecipeRef;

export const TABLE_DENSITIES = ["compact", "comfortable"] as const;
export const TABLE_ROW_STATES = ["default", "selected"] as const;
export const TABLE_CELL_KINDS = ["header", "body"] as const;
export const TABLE_COLUMN_COUNT = 3;
export const TABLE_BODY_ROW_COUNT = 2;

export type TableDensity = (typeof TABLE_DENSITIES)[number];
export type TableRowState = (typeof TABLE_ROW_STATES)[number];
export type TableCellKind = (typeof TABLE_CELL_KINDS)[number];

export interface TableNumberParameter {
  variable: string;
  fallback: number;
}
export interface TableColorParameter {
  variable: string;
  fallback: string;
}
export interface TableFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}
export interface TableColumn {
  id: string;
  label: string;
  align: "left" | "right";
}
export interface TableRow {
  id: string;
  state: TableRowState;
  cells: [string, string, string];
}
interface DensityTokens {
  paddingX: TableNumberParameter;
  paddingY: TableNumberParameter;
  fontSize: TableNumberParameter;
  /**
   * Optional. A cell min-width is a real constraint some sources simply do not
   * have -- MUI Table cells have none. Figma agrees that "no min-width" is not
   * a bindable zero: assigning `minWidth = 0` stores `null` AND drops the bound
   * variable, so a bound zero is not expressible (measured live at table live
   * v24; the writer has unset zero as null since v5,
   * `table-figma-writer.ts:610,615`). A source without a min-width therefore
   * declares no token rather than synthesising a variable for a constraint it
   * does not have.
   */
  minWidth?: TableNumberParameter;
}
interface RowStateTokens {
  background: TableColorParameter;
}

export interface TableRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "table";
    header: "rowgroup";
    body: "rowgroup";
    row: "row";
    headerCell: "columnheader";
    bodyCell: "cell";
    columnAxis: "declared";
  };
  axes: {
    density: {
      name: "Density";
      values: TableDensity[];
      default: TableDensity;
    };
    rowState: {
      name: "State";
      values: TableRowState[];
      default: TableRowState;
    };
    cellKind: {
      name: "Kind";
      values: TableCellKind[];
      default: TableCellKind;
    };
  };
  content: {
    columns: TableColumn[];
    rows: TableRow[];
    selectedRowId: string;
  };
  designerEditSurface: {
    textProperties: string[];
    variantProperties: string[];
    instanceSwapProperties: string[];
    columnAxis: {
      count: typeof TABLE_COLUMN_COUNT;
      editableProperties: ["Label", "Column", "Align"];
    };
    rowCollection: {
      componentRef: "table@1/row";
      repeatedAs: "instances";
      editableProperties: ["State", "Cell 0", "Cell 1", "Cell 2"];
    };
    cellTemplate: {
      componentRef: "table@1/cell";
      repeatedAs: "instances";
      editableProperties: ["Label", "Column", "Kind"];
    };
    resize: {
      root: "hug-contents";
      row: "hug-contents";
      cell: "hug-contents";
    };
    structuralEdits: "refuse";
  };
  publicApi: {
    controlled: string[];
    uncontrolled: string[];
    events: string[];
    keyboard: string[];
  };
  tokens: {
    densities: Record<TableDensity, DensityTokens>;
    rowStates: Record<TableRowState, RowStateTokens>;
    surface: TableColorParameter;
    headerBackground: TableColorParameter;
    text: TableColorParameter;
    frameBorder: TableColorParameter;
    frameBorderWidth: TableNumberParameter;
    cellRule: TableColorParameter;
    cellRuleWidth: TableNumberParameter;
    radius: TableNumberParameter;
    typography: {
      header: TableFontSpec;
      body: TableFontSpec;
    };
  };
  inputFacts: FactRef[];
  accounting: { carried: FactRef[] };
  extensions: CodeOnlyExtension[];
  receipts: LossReceipt[];
  provenance: {
    source: string;
    tool: "table@1";
    generatedAt: string;
    selection: RecipeSelection;
  };
}

const valueList = (actual: readonly string[], expected: readonly string[]) =>
  canonicalJson(actual) === canonicalJson(expected);
const numberParameter = (
  value: unknown,
  allowZero = false,
): value is TableNumberParameter =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TableNumberParameter).variable === "string" &&
  (value as TableNumberParameter).variable.length > 0 &&
  Number.isFinite((value as TableNumberParameter).fallback) &&
  (allowZero
    ? (value as TableNumberParameter).fallback >= 0
    : (value as TableNumberParameter).fallback > 0);
const colorParameter = (value: unknown): value is TableColorParameter =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TableColorParameter).variable === "string" &&
  (value as TableColorParameter).variable.length > 0 &&
  ColorSchema.safeParse((value as TableColorParameter).fallback).success;

export const TableRecipeInstanceSchema = z
  .custom<TableRecipeInstance>(
    (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value),
    "table@1 instance must be an object",
  )
  .superRefine((instance, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (!instance.identity?.id || !instance.identity?.name)
      fail("identity is required");
    if (
      instance.semantic?.root !== "table" ||
      instance.semantic.header !== "rowgroup" ||
      instance.semantic.body !== "rowgroup" ||
      instance.semantic.row !== "row" ||
      instance.semantic.headerCell !== "columnheader" ||
      instance.semantic.bodyCell !== "cell" ||
      instance.semantic.columnAxis !== "declared"
    )
      fail(
        "invalid ARIA/data model: table@1 requires a declared column axis and table/row/cell roles",
      );
    if (!valueList(instance.axes?.density?.values ?? [], TABLE_DENSITIES))
      fail("Density axis is not table@1");
    if (!valueList(instance.axes?.rowState?.values ?? [], TABLE_ROW_STATES))
      fail("State axis is not table@1");
    if (!valueList(instance.axes?.cellKind?.values ?? [], TABLE_CELL_KINDS))
      fail("Kind axis is not table@1");
    if (
      !Array.isArray(instance.content?.columns) ||
      instance.content.columns.length !== TABLE_COLUMN_COUNT ||
      new Set(instance.content.columns.map((column) => column.id)).size !==
        TABLE_COLUMN_COUNT
    )
      fail("table@1 requires three columns with unique ids");
    if (
      !Array.isArray(instance.content?.rows) ||
      instance.content.rows.length !== TABLE_BODY_ROW_COUNT ||
      new Set(instance.content.rows.map((row) => row.id)).size !==
        TABLE_BODY_ROW_COUNT
    )
      fail("table@1 requires two body rows with unique ids");
    if (
      !instance.content?.rows?.some(
        (row) => row.id === instance.content.selectedRowId,
      )
    )
      fail("selectedRowId must name one body row");
    if (
      !instance.content.rows.some(
        (row) =>
          row.id === instance.content.selectedRowId && row.state === "selected",
      )
    )
      fail("selected row must carry State=selected");
    for (const density of TABLE_DENSITIES) {
      const tokens = instance.tokens?.densities?.[density];
      if (
        !numberParameter(tokens?.paddingX) ||
        !numberParameter(tokens?.paddingY) ||
        !numberParameter(tokens?.fontSize) ||
        (tokens?.minWidth !== undefined &&
          !numberParameter(tokens?.minWidth, true))
      )
        fail(`${density} density token is invalid`);
    }
    for (const state of TABLE_ROW_STATES)
      if (!colorParameter(instance.tokens?.rowStates?.[state]?.background))
        fail(`${state} row color is invalid`);
    const colors = [
      instance.tokens?.surface,
      instance.tokens?.headerBackground,
      instance.tokens?.text,
      instance.tokens?.frameBorder,
      instance.tokens?.cellRule,
    ];
    if (colors.some((value) => !colorParameter(value)))
      fail("color token is invalid");
    if (
      !numberParameter(instance.tokens?.frameBorderWidth, true) ||
      !numberParameter(instance.tokens?.cellRuleWidth, true) ||
      !numberParameter(instance.tokens?.radius, true)
    )
      fail("border or radius token is invalid");
    if (
      !instance.tokens?.typography?.header ||
      !instance.tokens.typography.body
    )
      fail("typography tokens are required");
    if (!Array.isArray(instance.inputFacts)) fail("inputFacts are required");
    if (!Array.isArray(instance.accounting?.carried))
      fail("accounting is required");
    if (
      !Array.isArray(instance.extensions) ||
      !Array.isArray(instance.receipts)
    )
      fail("extensions and receipts are required");
    const selection = RecipeSelectionSchema.safeParse(
      instance.provenance?.selection,
    );
    if (!selection.success) fail("reviewed recipe selection is required");
  });

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const sortFacts = (facts: readonly FactRef[]): FactRef[] =>
  [...facts].sort((left, right) => compareText(factId(left), factId(right)));

export function normalizeTableRecipeInstance(
  input: unknown,
): TableRecipeInstance {
  const candidate = structuredClone(input) as TableRecipeInstance;
  requireExactRecipeSelection(
    candidate?.provenance?.selection,
    TABLE_RECIPE_REF,
  );
  const parsed = TableRecipeInstanceSchema.parse(candidate);
  return {
    ...parsed,
    inputFacts: sortFacts(parsed.inputFacts),
    accounting: { carried: sortFacts(parsed.accounting.carried) },
    extensions: [...parsed.extensions]
      .map((extension) => ({
        ...extension,
        absorbs: sortFacts(extension.absorbs),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
    receipts: [...parsed.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: TableNumberParameter | TableColorParameter,
): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable: parameter.variable,
});
const corners = (value: number) => ({
  topLeft: value,
  topRight: value,
  bottomRight: value,
  bottomLeft: value,
});
const fontFacts = (font: TableFontSpec, size: TableNumberParameter) => ({
  fontFamily: font.resolvedFamily,
  fontStyle: font.resolvedStyle,
  fontProvenance: font,
  fontSize: size.fallback,
  lineHeight: { unit: "auto" as const },
});
const text = (
  role: string,
  characters: string,
  font: TableFontSpec,
  size: TableNumberParameter,
  color: TableColorParameter,
): TextNode => ({
  kind: "text",
  role,
  label: role,
  characters,
  type: fontFacts(font, size),
  align: "left",
  verticalAlign: "center",
  fills: [solid(color.fallback)],
  width: hug,
  height: hug,
  bindings: [bind("type.fontSize", size), bind("fills.0.color", color)],
});
const cellInstance = (
  role: string,
  density: TableDensity,
  kind: TableCellKind,
  column: TableColumn,
  label: string,
) => ({
  kind: "instance" as const,
  role,
  label,
  componentRef: "table@1/cell",
  properties: {
    Density: density,
    Kind: kind,
    Label: label,
    Column: column.id,
    Align: column.align,
  },
  width: hug,
  height: hug,
});
const rowInstance = (role: string, density: TableDensity, row: TableRow) => ({
  kind: "instance" as const,
  role,
  label: row.id,
  componentRef: "table@1/row",
  properties: {
    Density: density,
    State: row.state,
    "Cell 0": row.cells[0],
    "Cell 1": row.cells[1],
    "Cell 2": row.cells[2],
  },
  width: hug,
  height: hug,
});

const cellComponent = (
  instance: TableRecipeInstance,
  densityName: TableDensity,
  kind: TableCellKind,
): ComponentNode => {
  const density = instance.tokens.densities[densityName];
  const font =
    kind === "header"
      ? instance.tokens.typography.header
      : instance.tokens.typography.body;
  // The cell component set exposes a single `Label` TEXT component property and
  // every variant's label TEXT is bound to it (`table-figma-writer.ts`, the
  // `Label` property added on the cell set and referenced by every
  // `table/cell/label` descendant). A shared Figma component property has ONE
  // default, so variants cannot carry different characters while bound to it --
  // Figma renders the property default on all of them. Measured live at table
  // live v24: all four minted cell variants read `characters: "Name"` while
  // compile expected `"Ada Lovelace"` on the two body variants.
  //
  // The cell set is a template whose text is a property, so the label default is
  // shared across kinds. No fact is lost: the body sample values still live on
  // the row set, which carries `Cell 0/1/2` per row occurrence. Typography still
  // differs per kind through `font` above.
  const label = instance.content.columns[0]!.label;
  const strokes = [
    {
      weight: instance.tokens.cellRuleWidth.fallback,
      align: "inside" as const,
      paint: solid(instance.tokens.cellRule.fallback),
    },
  ];
  const bindings: VariableBinding[] = [
    bind("layout.padding.left", density.paddingX),
    bind("layout.padding.right", density.paddingX),
    bind("layout.padding.top", density.paddingY),
    bind("layout.padding.bottom", density.paddingY),
    ...(density.minWidth === undefined
      ? []
      : [bind("layout.minWidth", density.minWidth)]),
    bind("strokes.0.paint.color", instance.tokens.cellRule),
    bind("strokes.0.weight", instance.tokens.cellRuleWidth),
  ];
  return {
    kind: "component",
    role: `table/cell/${densityName}/${kind}`,
    label: `Density=${densityName}, Kind=${kind}`,
    variantProperties: { Density: densityName, Kind: kind },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: {
        top: density.paddingY.fallback,
        right: density.paddingX.fallback,
        bottom: density.paddingY.fallback,
        left: density.paddingX.fallback,
      },
      width: hug,
      height: hug,
      ...(density.minWidth === undefined
        ? {}
        : { minWidth: density.minWidth.fallback }),
    },
    fills: [],
    strokes,
    bindings,
    children: [
      text(
        "table/cell/label",
        label,
        font,
        density.fontSize,
        instance.tokens.text,
      ),
    ],
  };
};

const rowComponent = (
  instance: TableRecipeInstance,
  densityName: TableDensity,
  state: TableRowState,
): ComponentNode => {
  const colors = instance.tokens.rowStates[state];
  const row =
    instance.content.rows.find((candidate) => candidate.state === state) ??
    instance.content.rows[0]!;
  return {
    kind: "component",
    role: `table/row/${densityName}/${state}`,
    label: `Density=${densityName}, State=${state}`,
    variantProperties: { Density: densityName, State: state },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [solid(colors.background.fallback)],
    bindings: [bind("fills.0.color", colors.background)],
    children: instance.content.columns.map((column, index) =>
      cellInstance(
        `table/cell-instance/${index}`,
        densityName,
        "body",
        column,
        row.cells[index]!,
      ),
    ),
  };
};

const tableVariant = (
  instance: TableRecipeInstance,
  densityName: TableDensity,
): ComponentNode => {
  const frameStrokes = [
    {
      weight: instance.tokens.frameBorderWidth.fallback,
      align: "inside" as const,
      paint: solid(instance.tokens.frameBorder.fallback),
    },
  ];
  const radius = instance.tokens.radius.fallback;
  const bindings: VariableBinding[] = [
    bind("fills.0.color", instance.tokens.surface),
    bind("strokes.0.paint.color", instance.tokens.frameBorder),
    bind("strokes.0.weight", instance.tokens.frameBorderWidth),
    ...(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).map(
      (corner) => bind(`cornerRadius.${corner}`, instance.tokens.radius),
    ),
  ];
  const header: FrameNode = {
    kind: "frame",
    role: "table/header",
    label: "Header",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [solid(instance.tokens.headerBackground.fallback)],
    bindings: [bind("fills.0.color", instance.tokens.headerBackground)],
    children: instance.content.columns.map((column, index) =>
      cellInstance(
        `table/header-cell-instance/${index}`,
        densityName,
        "header",
        column,
        column.label,
      ),
    ),
  };
  const body: FrameNode = {
    kind: "frame",
    role: "table/body",
    label: "Body",
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: instance.content.rows.map((row, index) =>
      rowInstance(`table/row-instance/${index}`, densityName, row),
    ),
  };
  return {
    kind: "component",
    role: `table/variant/${densityName}`,
    label: `Density=${densityName}`,
    variantProperties: { Density: densityName },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [solid(instance.tokens.surface.fallback)],
    strokes: frameStrokes,
    cornerRadius: corners(radius),
    bindings,
    children: [header, body],
  };
};

export function compileTableIr(instance: TableRecipeInstance): FrameNode {
  const tableSet: ComponentSetNode = {
    kind: "component-set",
    role: "table/set",
    label: instance.identity.name,
    variantAxes: [{ name: "Density", values: [...TABLE_DENSITIES] }],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 24,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: TABLE_DENSITIES.map((density) => tableVariant(instance, density)),
  };
  const rowSet: ComponentSetNode = {
    kind: "component-set",
    role: "table/row-set",
    label: "Table row",
    variantAxes: [
      { name: "Density", values: [...TABLE_DENSITIES] },
      { name: "State", values: [...TABLE_ROW_STATES] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: TABLE_DENSITIES.flatMap((density) =>
      TABLE_ROW_STATES.map((state) => rowComponent(instance, density, state)),
    ),
  };
  const cellSet: ComponentSetNode = {
    kind: "component-set",
    role: "table/cell-set",
    label: "Table cell",
    variantAxes: [
      { name: "Density", values: [...TABLE_DENSITIES] },
      { name: "Kind", values: [...TABLE_CELL_KINDS] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: TABLE_DENSITIES.flatMap((density) =>
      TABLE_CELL_KINDS.map((kind) => cellComponent(instance, density, kind)),
    ),
  };
  return {
    kind: "frame",
    role: "table/library",
    label: `${instance.identity.name} / recipe library`,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 48,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: [tableSet, rowSet, cellSet],
  };
}

export function compileTableRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeTableRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      TABLE_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "table / data-grid",
    recipe: TABLE_RECIPE_REF,
    ir: compileTableIr(instance),
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
    provenance: instance.provenance,
  } as const;
  return RecipeEnvelopeSchema.parse({
    ...unsigned,
    integrity: deriveRecipeIntegrity(unsigned),
  });
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
};
const direct = <Kind extends IRNode["kind"]>(
  parent: { role?: string; children: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found = parent.children.filter((node) => node.role === role);
  if (found.length !== 1 || found[0]!.kind !== kind)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `${parent.role ?? "root"}: required ${role} must appear exactly once as ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const setByRole = (root: FrameNode, role: string): ComponentSetNode =>
  direct(root, role, "component-set");
const componentFor = (
  set: ComponentSetNode,
  properties: Record<string, string>,
): ComponentNode => {
  const found = set.children.filter((component) =>
    Object.entries(properties).every(
      ([name, value]) => component.variantProperties[name] === value,
    ),
  );
  if (found.length !== 1)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `${set.role}: expected exactly one component for ${JSON.stringify(properties)}`,
    ]);
  return found[0]!;
};
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): TableNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): TableColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (
  paint: { kind: string; color?: string } | undefined,
  role: string,
): string => {
  if (paint?.kind !== "solid" || !paint.color)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `${role}: visible solid paint is required`,
    ]);
  return paint.color;
};
const fontFrom = (node: TextNode): TableFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance;
};

const validateTableStructure = (root: FrameNode): void => {
  const tableSet = setByRole(root, "table/set");
  const rowSet = setByRole(root, "table/row-set");
  const cellSet = setByRole(root, "table/cell-set");

  // No dead axis. An axis whose values compile to identical content decides
  // nothing, and a designer can still click it -- which is worse than not
  // offering it. calendar@1 shipped exactly that this session (`OutsideDays`
  // show/hide were byte-identical), so the class is closed here too rather than
  // only where it happened to be found. Both table sources pass today; this
  // keeps them honest.
  for (const set of [tableSet, rowSet, cellSet]) {
    const rendered = new Set(
      set.children.map((child) => {
        const stripped = structuredClone(child) as unknown as Record<
          string,
          unknown
        >;
        delete stripped.role;
        delete stripped.label;
        delete stripped.variantProperties;
        return canonicalJson(stripped);
      }),
    );
    if (rendered.size < set.children.length)
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `${set.role}: dead axis — two or more variants compile to identical content`,
      ]);
  }
  if (tableSet.children.length !== TABLE_DENSITIES.length)
    throw new RecipeRefusal(TABLE_RECIPE_REF, ["table/set variant count"]);
  if (
    rowSet.children.length !==
    TABLE_DENSITIES.length * TABLE_ROW_STATES.length
  )
    throw new RecipeRefusal(TABLE_RECIPE_REF, ["table/row-set variant count"]);
  if (
    cellSet.children.length !==
    TABLE_DENSITIES.length * TABLE_CELL_KINDS.length
  )
    throw new RecipeRefusal(TABLE_RECIPE_REF, ["table/cell-set variant count"]);
  for (const table of tableSet.children) {
    if (table.layout.mode !== "vertical")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `${table.role}: table root must be a vertical column stack`,
      ]);
    const header = direct(table, "table/header", "frame");
    const body = direct(table, "table/body", "frame");
    if (header.layout.mode !== "horizontal")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        "header must be a horizontal row",
      ]);
    if (body.layout.mode !== "vertical")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        "body must be a vertical row stack",
      ]);
    if (header.children.length !== TABLE_COLUMN_COUNT)
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        "declared column axis must have three header cell instances",
      ]);
    if (body.children.length !== TABLE_BODY_ROW_COUNT)
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        "table@1 requires two body row instances",
      ]);
    for (const [index, child] of header.children.entries()) {
      if (
        child.kind !== "instance" ||
        child.componentRef !== "table@1/cell" ||
        child.properties.Kind !== "header"
      )
        throw new RecipeRefusal(TABLE_RECIPE_REF, [
          `non-instance repetition at header cell ${index}`,
        ]);
    }
    for (const [index, child] of body.children.entries()) {
      if (child.kind !== "instance" || child.componentRef !== "table@1/row")
        throw new RecipeRefusal(TABLE_RECIPE_REF, [
          `non-instance repetition at body row ${index}`,
        ]);
    }
  }
  for (const row of rowSet.children) {
    if (row.layout.mode !== "horizontal")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `${row.role}: row template must be horizontal`,
      ]);
    if (row.children.length !== TABLE_COLUMN_COUNT)
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `${row.role}: row template must instantiate three cells`,
      ]);
    for (const child of row.children) {
      if (child.kind !== "instance" || child.componentRef !== "table@1/cell")
        throw new RecipeRefusal(TABLE_RECIPE_REF, [
          `${row.role}: non-instance cell repetition`,
        ]);
    }
  }
  for (const cell of cellSet.children) {
    if (
      cell.layout.padding.left <= 0 ||
      cell.layout.padding.right <= 0 ||
      cell.layout.padding.top <= 0 ||
      cell.layout.padding.bottom <= 0
    )
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `${cell.role}: cell padding is required`,
      ]);
    direct(cell, "table/cell/label", "text");
  }
};

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (canonicalJson(left) === canonicalJson(right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const found = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (found) return found;
    }
    return path;
  }
  const l = left as Record<string, unknown>;
  const r = right as Record<string, unknown>;
  for (const key of [
    ...new Set([...Object.keys(l), ...Object.keys(r)]),
  ].sort()) {
    if (!(key in l) || !(key in r)) return `${path}.${key}`;
    const found = firstDifference(l[key], r[key], `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
};

/**
 * Measurement-only sibling of `firstDifference`. Same recursion and the same
 * notion of "different", but it collects every divergence instead of returning
 * on the first one. `firstDifference` and `collapseTableRecipe` keep their
 * refusal behaviour untouched: nothing in the live path calls this.
 *
 * Used by `recipe/table-tail-census.ts` to enumerate the remaining
 * extract-side teaching tail offline, from a persisted extract response,
 * without spending a live Figma cycle per gap.
 */
export interface TableIrDifference {
  path: string;
  reason: "absent-left" | "absent-right" | "type" | "value";
  left?: unknown;
  right?: unknown;
}

export const allDifferences = (
  left: unknown,
  right: unknown,
  path = "$",
  into: TableIrDifference[] = [],
): TableIrDifference[] => {
  if (canonicalJson(left) === canonicalJson(right)) return into;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    into.push({ path, reason: "value", left, right });
    return into;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      into.push({ path, reason: "type", left, right });
      return into;
    }
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= left.length) {
        into.push({
          path: `${path}[${index}]`,
          reason: "absent-left",
          right: right[index],
        });
        continue;
      }
      if (index >= right.length) {
        into.push({
          path: `${path}[${index}]`,
          reason: "absent-right",
          left: left[index],
        });
        continue;
      }
      allDifferences(left[index], right[index], `${path}[${index}]`, into);
    }
    return into;
  }
  const l = left as Record<string, unknown>;
  const r = right as Record<string, unknown>;
  for (const key of [
    ...new Set([...Object.keys(l), ...Object.keys(r)]),
  ].sort()) {
    if (!(key in l)) {
      into.push({
        path: `${path}.${key}`,
        reason: "absent-left",
        right: r[key],
      });
      continue;
    }
    if (!(key in r)) {
      into.push({
        path: `${path}.${key}`,
        reason: "absent-right",
        left: l[key],
      });
      continue;
    }
    allDifferences(l[key], r[key], `${path}.${key}`, into);
  }
  return into;
};

export function collapseTableRecipe(
  envelopeInput: unknown,
  selectionInput: unknown,
  /**
   * Measurement-only escape hatch used by `recipe/table-tail-census.ts`.
   * When a sink is supplied, the refusal is not thrown: every remaining
   * difference is collected into it and the derived instance is returned.
   * Two-argument callers -- every live and test caller -- are unaffected and
   * still refuse on the first difference.
   */
  differenceSink?: TableIrDifference[],
): TableRecipeInstance {
  requireExactRecipeSelection(selectionInput, TABLE_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (
    envelope.recipe.id !== "table" ||
    envelope.recipe.version !== 1 ||
    envelope.archetype !== "table / data-grid"
  )
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      "selected envelope is not table@1",
    ]);
  if (hashRecipeEnvelope(envelope) !== envelope.integrity.canonicalHash)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      "integrity.canonicalHash does not match the selected envelope",
    ]);
  if (envelope.ir.kind !== "frame")
    throw new RecipeRefusal(TABLE_RECIPE_REF, ["missing table/library frame"]);
  const root = envelope.ir;
  validateTableStructure(root);
  const tableSet = setByRole(root, "table/set");
  const rowSet = setByRole(root, "table/row-set");
  const cellSet = setByRole(root, "table/cell-set");
  const baseline = componentFor(tableSet, { Density: "comfortable" });
  const header = direct(baseline, "table/header", "frame");
  const body = direct(baseline, "table/body", "frame");
  const columns = header.children.map((child, index): TableColumn => {
    if (child.kind !== "instance")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `header cell ${index} is not an instance`,
      ]);
    if (
      typeof child.properties.Label !== "string" ||
      typeof child.properties.Column !== "string" ||
      (child.properties.Align !== "left" && child.properties.Align !== "right")
    )
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `invalid column axis at header cell ${index}`,
      ]);
    return {
      id: child.properties.Column,
      label: child.properties.Label,
      align: child.properties.Align,
    };
  });
  const rows = body.children.map((child, index): TableRow => {
    if (child.kind !== "instance")
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `body row ${index} is not an instance`,
      ]);
    if (
      typeof child.properties["Cell 0"] !== "string" ||
      typeof child.properties["Cell 1"] !== "string" ||
      typeof child.properties["Cell 2"] !== "string" ||
      (child.properties.State !== "default" &&
        child.properties.State !== "selected")
    )
      throw new RecipeRefusal(TABLE_RECIPE_REF, [
        `invalid ARIA/data model at row occurrence ${index}`,
      ]);
    return {
      id: typeof child.label === "string" ? child.label : `row-${index}`,
      state: child.properties.State,
      cells: [
        child.properties["Cell 0"],
        child.properties["Cell 1"],
        child.properties["Cell 2"],
      ],
    };
  });
  const selected = rows.find((row) => row.state === "selected");
  if (!selected)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      "selected row occurrence is missing",
    ]);
  const comfortableCell = componentFor(cellSet, {
    Density: "comfortable",
    Kind: "body",
  });
  const compactCell = componentFor(cellSet, {
    Density: "compact",
    Kind: "body",
  });
  const headerCell = componentFor(cellSet, {
    Density: "comfortable",
    Kind: "header",
  });
  const defaultRow = componentFor(rowSet, {
    Density: "comfortable",
    State: "default",
  });
  const selectedRow = componentFor(rowSet, {
    Density: "comfortable",
    State: "selected",
  });
  const headerLabel = direct(headerCell, "table/cell/label", "text");
  const bodyLabel = direct(comfortableCell, "table/cell/label", "text");
  const densityFrom = (cell: ComponentNode): DensityTokens => ({
    paddingX: numberFrom(cell, "layout.padding.left", cell.layout.padding.left),
    paddingY: numberFrom(cell, "layout.padding.top", cell.layout.padding.top),
    fontSize: numberFrom(
      direct(cell, "table/cell/label", "text"),
      "type.fontSize",
      direct(cell, "table/cell/label", "text").type.fontSize,
    ),
    // Absent when the source declares no min-width. Recovering a binding that
    // is not on the node would invent one; see DensityTokens.minWidth.
    ...((cell.bindings ?? []).some((entry) => entry.field === "layout.minWidth")
      ? {
          minWidth: numberFrom(
            cell,
            "layout.minWidth",
            cell.layout.minWidth ?? 0,
          ),
        }
      : {}),
  });
  const instance = normalizeTableRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: {
      root: "table",
      header: "rowgroup",
      body: "rowgroup",
      row: "row",
      headerCell: "columnheader",
      bodyCell: "cell",
      columnAxis: "declared",
    },
    axes: {
      density: {
        name: "Density",
        values: [...TABLE_DENSITIES],
        default: "comfortable",
      },
      rowState: {
        name: "State",
        values: [...TABLE_ROW_STATES],
        default: "default",
      },
      cellKind: {
        name: "Kind",
        values: [...TABLE_CELL_KINDS],
        default: "body",
      },
    },
    content: {
      columns,
      rows,
      selectedRowId: selected.id,
    },
    designerEditSurface: {
      textProperties: ["Label", "Column", "Cell 0", "Cell 1", "Cell 2"],
      variantProperties: ["Density", "State", "Kind"],
      instanceSwapProperties: [],
      columnAxis: {
        count: TABLE_COLUMN_COUNT,
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
    },
    publicApi: {
      controlled: ["selectedRowId"],
      uncontrolled: ["defaultSelectedRowId"],
      events: ["onRowSelect"],
      keyboard: ["ArrowDown", "ArrowUp", "Home", "End"],
    },
    tokens: {
      densities: {
        compact: densityFrom(compactCell),
        comfortable: densityFrom(comfortableCell),
      },
      rowStates: {
        default: {
          background: colorFrom(
            defaultRow,
            "fills.0.color",
            solidColor(defaultRow.fills[0], defaultRow.role!),
          ),
        },
        selected: {
          background: colorFrom(
            selectedRow,
            "fills.0.color",
            solidColor(selectedRow.fills[0], selectedRow.role!),
          ),
        },
      },
      surface: colorFrom(
        baseline,
        "fills.0.color",
        solidColor(baseline.fills[0], baseline.role!),
      ),
      headerBackground: colorFrom(
        header,
        "fills.0.color",
        solidColor(header.fills[0], header.role!),
      ),
      text: colorFrom(
        bodyLabel,
        "fills.0.color",
        solidColor(bodyLabel.fills[0], bodyLabel.role!),
      ),
      frameBorder: colorFrom(
        baseline,
        "strokes.0.paint.color",
        baseline.strokes?.[0]?.paint.kind === "solid"
          ? baseline.strokes[0].paint.color
          : "#00000000",
      ),
      frameBorderWidth: numberFrom(
        baseline,
        "strokes.0.weight",
        baseline.strokes?.[0]?.weight ?? 0,
      ),
      cellRule: colorFrom(
        comfortableCell,
        "strokes.0.paint.color",
        comfortableCell.strokes?.[0]?.paint.kind === "solid"
          ? comfortableCell.strokes[0].paint.color
          : "#00000000",
      ),
      cellRuleWidth: numberFrom(
        comfortableCell,
        "strokes.0.weight",
        comfortableCell.strokes?.[0]?.weight ?? 0,
      ),
      radius: numberFrom(
        baseline,
        "cornerRadius.topLeft",
        baseline.cornerRadius?.topLeft ?? 0,
      ),
      typography: {
        header: fontFrom(headerLabel),
        body: fontFrom(bodyLabel),
      },
    },
    inputFacts: [
      ...envelope.accounting.carried,
      ...envelope.extensions.flatMap((extension) => extension.absorbs),
      ...envelope.receipts.map((receipt) => receipt.fact),
    ],
    accounting: envelope.accounting,
    extensions: envelope.extensions,
    receipts: envelope.receipts,
    provenance: envelope.provenance,
  });
  const recompiled = compileTableRecipe(instance);
  if (differenceSink) {
    allDifferences(recompiled.ir, envelope.ir, "$", differenceSink);
    return instance;
  }
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(TABLE_RECIPE_REF, [
      `unsupported structural edit at ${difference}; table@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const tableRecipe: Recipe<TableRecipeInstance> = {
  ref: TABLE_RECIPE_REF,
  normalize: normalizeTableRecipeInstance,
  compile: compileTableRecipe,
  collapse: collapseTableRecipe,
};
