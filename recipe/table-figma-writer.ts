import { canonicalJson } from "./normalize.js";
import type { RecipeEnvelope } from "./envelope.js";
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";
import {
  TABLE_CELL_KINDS,
  TABLE_DENSITIES,
  TABLE_ROW_STATES,
} from "./recipes/table.js";

export const TABLE_FIGMA_NAMESPACE = "ds.contracts.table.recipe.v1";
export const TABLE_FIGMA_WRITER_VERSION = 1;
export const TABLE_FIGMA_RUN_SUFFIX = "table-v30";
export const FORBIDDEN_TABLE_V1_RUN_IDENTITY = "83a27edf-82d19508-table-v1";
export const FORBIDDEN_TABLE_V2_RUN_IDENTITY = "cc811f47-82d19508-table-v2";
export const FORBIDDEN_TABLE_V3_RUN_IDENTITY = "cc811f47-82d19508-table-v3";
export const FORBIDDEN_TABLE_V4_RUN_IDENTITY = "cc811f47-82d19508-table-v4";
export const FORBIDDEN_TABLE_V5_RUN_IDENTITY = "cc811f47-82d19508-table-v5";
export const FORBIDDEN_TABLE_V6_RUN_IDENTITY = "cc811f47-82d19508-table-v6";
export const FORBIDDEN_TABLE_V7_RUN_IDENTITY = "cc811f47-82d19508-table-v7";
export const FORBIDDEN_TABLE_V8_RUN_IDENTITY = "cc811f47-82d19508-table-v8";
export const FORBIDDEN_TABLE_V9_RUN_IDENTITY = "cc811f47-82d19508-table-v9";
export const FORBIDDEN_TABLE_V10_RUN_IDENTITY = "cc811f47-82d19508-table-v10";
export const FORBIDDEN_TABLE_V11_RUN_IDENTITY = "cc811f47-82d19508-table-v11";
export const FORBIDDEN_TABLE_V12_RUN_IDENTITY = "cc811f47-82d19508-table-v12";
export const FORBIDDEN_TABLE_V13_RUN_IDENTITY = "cc811f47-82d19508-table-v13";
export const FORBIDDEN_TABLE_V14_RUN_IDENTITY = "cc811f47-82d19508-table-v14";
export const FORBIDDEN_TABLE_V15_RUN_IDENTITY = "cc811f47-82d19508-table-v15";
export const FORBIDDEN_TABLE_V16_RUN_IDENTITY = "cc811f47-82d19508-table-v16";
export const FORBIDDEN_TABLE_V17_RUN_IDENTITY = "cc811f47-82d19508-table-v17";
export const FORBIDDEN_TABLE_V18_RUN_IDENTITY = "cc811f47-82d19508-table-v18";
export const FORBIDDEN_TABLE_V19_RUN_IDENTITY = "cc811f47-82d19508-table-v19";
export const FORBIDDEN_TABLE_V20_RUN_IDENTITY = "cc811f47-82d19508-table-v20";
export const FORBIDDEN_TABLE_V21_RUN_IDENTITY = "cc811f47-82d19508-table-v21";
export const FORBIDDEN_TABLE_V22_RUN_IDENTITY = "cc811f47-82d19508-table-v22";
export const FORBIDDEN_TABLE_V23_RUN_IDENTITY = "cc811f47-82d19508-table-v23";
export const FORBIDDEN_TABLE_V24_RUN_IDENTITY = "cc811f47-82d19508-table-v24";
export const TABLE_FIGMA_VARIANTS_PER_SOURCE = 10;
export const TABLE_FIGMA_VARIANT_COUNT = 20;
export const TABLE_FIGMA_INSTANCES_PER_SOURCE = 22;
export const FORBIDDEN_INPUT_NAMESPACE = "ds.contracts.input.recipe.v5";
export const FORBIDDEN_INPUT_RUN_IDENTITY = "4a074b24-e8503dd5-input-v5";
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_NAMESPACE = "ds.contracts.combobox.recipe.v1";
export const FORBIDDEN_COMBOBOX_RUN_IDENTITY = "70c24cbd-d27f2e85-combobox-v1";
export const FORBIDDEN_COMBOBOX_PAGE_ID = "163:35981";

type TableAxisName = "Density";
type TableCell = [number];
type RowAxisName = "Density" | "State";
type RowCell = [number, number];
type CellAxisName = "Density" | "Kind";
type CellVariant = [number, number];

interface VariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface TableFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface TableFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  tableAxes: Record<TableAxisName, string[]>;
  rowAxes: Record<RowAxisName, string[]>;
  cellAxes: Record<CellAxisName, string[]>;
  tableCells: TableCell[];
  rowCells: RowCell[];
  cellCells: CellVariant[];
  tableSet: ComponentSetNode;
  rowSet: ComponentSetNode;
  cellSet: ComponentSetNode;
  variables: VariablePlan[];
  cellDefaults: {
    Label: string;
    Column: string;
    Align: "left" | "right";
  };
  rowDefaults: {
    "Cell 0": string;
    "Cell 1": string;
    "Cell 2": string;
  };
  comparedIrFacts: number;
  instanceCount: number;
}

export interface TableFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: TableFigmaSourcePlan[];
  code: string;
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walk(child, visit);
  }
};

const atPath = (value: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return (current as Record<string | number, unknown>)[key];
  }, value);

const variableType = (
  binding: VariableBinding,
  value: unknown,
): "COLOR" | "FLOAT" => {
  if (
    typeof value === "string" &&
    /^#[0-9a-f]{8}$/.test(value) &&
    binding.field.endsWith("color")
  ) {
    return "COLOR";
  }
  if (typeof value === "number") return "FLOAT";
  throw new TypeError(
    `table live writer: unsupported binding ${binding.field}=${JSON.stringify(value)}`,
  );
};

const countComparedFacts = (root: IRNode): number => {
  let count = 0;
  walk(root, (node) => {
    count += Object.keys(node).filter((key) => key !== "label").length;
  });
  return count;
};

const countInstances = (root: IRNode): number => {
  let count = 0;
  walk(root, (node) => {
    if (node.kind === "instance") count += 1;
  });
  return count;
};

const cellDefaultsFromInstance = (
  node: IRNode,
): TableFigmaSourcePlan["cellDefaults"] | undefined => {
  if (node.kind !== "instance" || node.componentRef !== "table@1/cell")
    return undefined;
  const label = node.properties.Label;
  const column = node.properties.Column;
  const align = node.properties.Align;
  if (
    typeof label !== "string" ||
    typeof column !== "string" ||
    (align !== "left" && align !== "right")
  ) {
    throw new TypeError(
      "table live writer: cell instance missing source Label/Column/Align",
    );
  }
  return { Label: label, Column: column, Align: align };
};

const rowDefaultsFromInstance = (
  node: IRNode,
): TableFigmaSourcePlan["rowDefaults"] | undefined => {
  if (node.kind !== "instance" || node.componentRef !== "table@1/row")
    return undefined;
  const cell0 = node.properties["Cell 0"];
  const cell1 = node.properties["Cell 1"];
  const cell2 = node.properties["Cell 2"];
  if (
    typeof cell0 !== "string" ||
    typeof cell1 !== "string" ||
    typeof cell2 !== "string"
  ) {
    throw new TypeError(
      "table live writer: row instance missing source Cell 0/1/2",
    );
  }
  return { "Cell 0": cell0, "Cell 1": cell1, "Cell 2": cell2 };
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind !== "frame") {
    throw new TypeError("table live writer requires table/library frame");
  }
  const found = root.children.filter((child) => child.role === role);
  if (found.length !== 1 || found[0]!.kind !== "component-set") {
    throw new TypeError(`table live writer: required ${role} set`);
  }
  return found[0];
};

const axisValues = (
  set: ComponentSetNode,
  name: string,
): string[] | undefined => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  return axis ? [...axis.values] : undefined;
};

const planSource = (input: TableFigmaWriterInput): TableFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "table" ||
    input.envelope.recipe.version !== 1
  ) {
    throw new TypeError("table live writer requires table@1");
  }
  const tableSet = requireSet(input.envelope.ir, "table/set");
  const rowSet = requireSet(input.envelope.ir, "table/row-set");
  const cellSet = requireSet(input.envelope.ir, "table/cell-set");
  const tableAxes = {
    Density: axisValues(tableSet, "Density"),
  };
  const rowAxes = {
    Density: axisValues(rowSet, "Density"),
    State: axisValues(rowSet, "State"),
  };
  const cellAxes = {
    Density: axisValues(cellSet, "Density"),
    Kind: axisValues(cellSet, "Kind"),
  };
  if (canonicalJson(tableAxes.Density) !== canonicalJson(TABLE_DENSITIES)) {
    throw new TypeError("table live writer: incomplete Density axis");
  }
  if (
    canonicalJson(rowAxes.Density) !== canonicalJson(TABLE_DENSITIES) ||
    canonicalJson(rowAxes.State) !== canonicalJson(TABLE_ROW_STATES)
  ) {
    throw new TypeError("table live writer: incomplete row axes");
  }
  if (
    canonicalJson(cellAxes.Density) !== canonicalJson(TABLE_DENSITIES) ||
    canonicalJson(cellAxes.Kind) !== canonicalJson(TABLE_CELL_KINDS)
  ) {
    throw new TypeError("table live writer: incomplete cell axes");
  }
  const completeTable = tableAxes as Record<TableAxisName, string[]>;
  const completeRow = rowAxes as Record<RowAxisName, string[]>;
  const completeCell = cellAxes as Record<CellAxisName, string[]>;
  const tableCells = tableSet.children.map(
    (component) =>
      ["Density"].map((name) =>
        completeTable[name as TableAxisName].indexOf(
          component.variantProperties[name]!,
        ),
      ) as TableCell,
  );
  const rowCells = rowSet.children.map(
    (component) =>
      (["Density", "State"] as const).map((name) =>
        completeRow[name].indexOf(component.variantProperties[name]!),
      ) as RowCell,
  );
  const cellCells = cellSet.children.map(
    (component) =>
      (["Density", "Kind"] as const).map((name) =>
        completeCell[name].indexOf(component.variantProperties[name]!),
      ) as CellVariant,
  );
  if (
    tableCells.length !== TABLE_DENSITIES.length ||
    rowCells.length !== TABLE_DENSITIES.length * TABLE_ROW_STATES.length ||
    cellCells.length !== TABLE_DENSITIES.length * TABLE_CELL_KINDS.length ||
    tableCells.some((cell) => cell.some((index) => index < 0)) ||
    rowCells.some((cell) => cell.some((index) => index < 0)) ||
    cellCells.some((cell) => cell.some((index) => index < 0))
  ) {
    throw new TypeError(
      `table live writer requires 2+4+4 cells; found ${tableCells.length}+${rowCells.length}+${cellCells.length}`,
    );
  }
  const registry = new Map<string, VariablePlan>();
  walk(input.envelope.ir, (node) => {
    if (
      node.kind === "instance" &&
      node.componentRef !== "table@1/cell" &&
      node.componentRef !== "table@1/row"
    ) {
      throw new TypeError(
        `table live writer: unknown instance ${node.componentRef}`,
      );
    }
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value)) {
        throw new TypeError(
          `table live writer: conflicting fallback for ${binding.variable}`,
        );
      }
      registry.set(key, {
        identity: binding.variable,
        name: sanitizeFigmaVariableName(binding.variable, type),
        type,
        value: value as string | number,
      });
    }
  });
  buildFigmaVariableNameMap(
    [...registry.values()].map(({ identity, type }) => ({
      tokenIdentity: identity,
      type,
    })),
  );
  if (registry.size === 0) {
    throw new TypeError("table live writer: zero planned variables");
  }
  const cellOccurrences: TableFigmaSourcePlan["cellDefaults"][] = [];
  const rowOccurrences: TableFigmaSourcePlan["rowDefaults"][] = [];
  walk(tableSet, (node) => {
    const cell = cellDefaultsFromInstance(node);
    if (cell) cellOccurrences.push(cell);
    const row = rowDefaultsFromInstance(node);
    if (row) rowOccurrences.push(row);
  });
  walk(rowSet, (node) => {
    const cell = cellDefaultsFromInstance(node);
    if (cell) cellOccurrences.push(cell);
  });
  if (cellOccurrences.length === 0) {
    throw new TypeError(
      "table live writer: no cell instances carrying source Label/Column/Align",
    );
  }
  if (rowOccurrences.length === 0) {
    throw new TypeError(
      "table live writer: no row instances carrying source Cell 0/1/2",
    );
  }
  const instanceCount = countInstances(input.envelope.ir);
  if (instanceCount !== TABLE_FIGMA_INSTANCES_PER_SOURCE) {
    throw new TypeError(
      `table live writer requires ${TABLE_FIGMA_INSTANCES_PER_SOURCE} instances; found ${instanceCount}`,
    );
  }
  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    tableAxes: completeTable,
    rowAxes: completeRow,
    cellAxes: completeCell,
    tableCells,
    rowCells,
    cellCells,
    tableSet,
    rowSet,
    cellSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    cellDefaults: cellOccurrences[0]!,
    rowDefaults: rowOccurrences[0]!,
    comparedIrFacts: countComparedFacts(input.envelope.ir),
    instanceCount,
  };
};

export function validateTableFigmaSourcePlans(
  plans: readonly TableFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length !== 2)
    failures.push(`expected 2 source plans, found ${plans.length}`);
  if (
    new Set(plans.map((plan) => plan.adapterIdentity)).size !== plans.length
  ) {
    failures.push("adapter identity collision");
  }
  for (const source of plans) {
    if (source.tableCells.length !== TABLE_DENSITIES.length) {
      failures.push(`${source.adapterIdentity}: expected 2 table cells`);
    }
    if (
      source.rowCells.length !==
      TABLE_DENSITIES.length * TABLE_ROW_STATES.length
    ) {
      failures.push(`${source.adapterIdentity}: expected 4 row cells`);
    }
    if (
      source.cellCells.length !==
      TABLE_DENSITIES.length * TABLE_CELL_KINDS.length
    ) {
      failures.push(`${source.adapterIdentity}: expected 4 cell cells`);
    }
    if (source.instanceCount !== TABLE_FIGMA_INSTANCES_PER_SOURCE) {
      failures.push(
        `${source.adapterIdentity}: expected ${TABLE_FIGMA_INSTANCES_PER_SOURCE} instances`,
      );
    }
    if (source.variables.length === 0) {
      failures.push(`${source.adapterIdentity}: variables denominator is zero`);
    }
    if (source.comparedIrFacts <= 0) {
      failures.push(
        `${source.adapterIdentity}: compared facts denominator is zero`,
      );
    }
    if (
      typeof source.cellDefaults.Label !== "string" ||
      typeof source.cellDefaults.Column !== "string" ||
      (source.cellDefaults.Align !== "left" &&
        source.cellDefaults.Align !== "right")
    ) {
      failures.push(
        `${source.adapterIdentity}: cell defaults missing source Label/Column/Align`,
      );
    }
    if (
      typeof source.rowDefaults["Cell 0"] !== "string" ||
      typeof source.rowDefaults["Cell 1"] !== "string" ||
      typeof source.rowDefaults["Cell 2"] !== "string"
    ) {
      failures.push(
        `${source.adapterIdentity}: row defaults missing source Cell 0/1/2`,
      );
    }
    const roles = new Set<string>();
    walk(source.tableSet, (node) => {
      if (node.role) roles.add(node.role);
    });
    walk(source.rowSet, (node) => {
      if (node.role) roles.add(node.role);
    });
    walk(source.cellSet, (node) => {
      if (node.role) roles.add(node.role);
    });
    for (const role of [
      "table/header",
      "table/body",
      "table/cell/label",
      "table/header-cell-instance/0",
      "table/row-instance/0",
      "table/cell-instance/0",
    ]) {
      if (!roles.has(role)) {
        failures.push(`${source.adapterIdentity}: missing ${role}`);
      }
    }
  }
  return failures;
}

const writerRuntime = (namespace: string, version: number): string =>
  String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = ${JSON.stringify(namespace)};
const WRITER_VERSION=${JSON.stringify(String(version))};
const PAGE_OWNER="recipe/table/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("TABLE-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("TABLE-COMBOBOX-IDENTITY-REUSE");
if(PLAN.runIdentity==="83a27edf-82d19508-table-v1")throw new Error("TABLE-V1-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v2")throw new Error("TABLE-V2-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v3")throw new Error("TABLE-V3-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v4")throw new Error("TABLE-V4-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v5")throw new Error("TABLE-V5-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v6")throw new Error("TABLE-V6-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v7")throw new Error("TABLE-V7-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v8")throw new Error("TABLE-V8-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v9")throw new Error("TABLE-V9-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v10")throw new Error("TABLE-V10-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v11")throw new Error("TABLE-V11-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v12")throw new Error("TABLE-V12-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v13")throw new Error("TABLE-V13-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v14")throw new Error("TABLE-V14-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v15")throw new Error("TABLE-V15-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v16")throw new Error("TABLE-V16-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v17")throw new Error("TABLE-V17-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v18")throw new Error("TABLE-V18-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v19")throw new Error("TABLE-V19-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v20")throw new Error("TABLE-V20-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v21")throw new Error("TABLE-V21-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v22")throw new Error("TABLE-V22-IDENTITY-REUSE");
if(PLAN.runIdentity==="cc811f47-82d19508-table-v23")throw new Error("TABLE-V23-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(!page){page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);}
else if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("TABLE-PAGE-OWNERSHIP-COLLISION:"+page.id);
if(page.id==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&font.fontName.style===candidate.style)).find(Boolean);
  if(!found)throw new Error("TABLE-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("TABLE-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("TABLE-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const source of PLAN.sources){
  const oldSections=page.children.filter(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  for(const old of oldSections){
    const collectionId=getSharedData(old,"variableCollectionId");
    if(collectionId){const collection=await figma.variables.getVariableCollectionByIdAsync(collectionId);if(collection&&!collection.remote){if(getSharedData(collection,"collectionOwner")!==PAGE_OWNER+"/variable-collection"||getSharedData(collection,"runIdentity")!==PLAN.runIdentity)throw new Error("TABLE-VARIABLE-COLLECTION-OWNERSHIP-COLLISION:"+collection.id);collection.remove();}}
    old.remove();
  }
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Table / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("TABLE-VARIABLE-COLLECTION-COLLISION:"+collectionName);
  const collection=figma.variables.createVariableCollection(collectionName);
  setSharedData(collection,"collectionOwner",PAGE_OWNER+"/variable-collection");
  setSharedData(collection,"runIdentity",PLAN.runIdentity);
  setSharedData(collection,"adapterIdentity",source.adapterIdentity);
  collection.renameMode(collection.modes[0].modeId,"Default");
  collection.hiddenFromPublishing=true;
  setSharedData(section,"variableCollectionId",collection.id);
  const modeId=collection.modes[0].modeId,variables=new Map();
  for(const planned of source.variables){
    const variable=figma.variables.createVariable(planned.name,collection,planned.type);
    variable.scopes=["ALL_SCOPES"];
    variable.setValueForMode(modeId,planned.type==="COLOR"?rgba(planned.value):planned.value);
    variable.setVariableCodeSyntax("WEB","var(--"+planned.identity.replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase()+")");
    variables.set(planned.type+":"+planned.identity,variable);
  }
  const boundPaint=(hex,binding)=>{
    const base=paint(hex);
    if(!binding)return base;
    const variable=variables.get("COLOR:"+binding.variable);
    if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
    return figma.variables.setBoundVariableForPaint(base,"color",variable);
  };
  const bindFloat=(node,field,binding)=>{
    if(!binding)return;
    const variable=variables.get("FLOAT:"+binding.variable);
    if(!variable)throw new Error("MISSING-FLOAT-VARIABLE:"+binding.variable);
    node.setBoundVariable(field,variable);
  };
  const bindingFor=(ir,field)=>(ir.bindings||[]).find(binding=>binding.field===field);
  const tag=(node,ir,ownershipKey)=>{
    setSharedData(node,"runIdentity",PLAN.runIdentity);
    setSharedData(node,"adapterIdentity",source.adapterIdentity);
    setSharedData(node,"recipeHash",source.recipeHash);
    setSharedData(node,"envelopeHash",source.envelopeHash);
    setSharedData(node,"ownershipKey",ownershipKey);
  };
  const applyPaints=(node,ir)=>{
    if(ir.fills)node.fills=ir.fills.map((entry,index)=>boundPaint(entry.color,bindingFor(ir,"fills."+index+".color")));
    if(ir.strokes){
      node.strokes=ir.strokes.map((entry,index)=>boundPaint(entry.paint.color,bindingFor(ir,"strokes."+index+".paint.color")));
      if(ir.strokes[0]){
        node.strokeWeight=ir.strokes[0].weight;node.strokeAlign=ir.strokes[0].align.toUpperCase();
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    if(ir.effects){
      node.effects=ir.effects.map((effect,index)=>{
        const base=effect.kind==="drop-shadow"||effect.kind==="inner-shadow"?{type:effect.kind==="drop-shadow"?"DROP_SHADOW":"INNER_SHADOW",color:rgba(effect.color),offset:{x:effect.offsetX,y:effect.offsetY},radius:effect.blur,spread:effect.spread,visible:true,blendMode:"NORMAL"}:{type:effect.kind==="layer-blur"?"LAYER_BLUR":"BACKGROUND_BLUR",radius:effect.blur,visible:true};
        const binding=bindingFor(ir,"effects."+index+".color");
        if(!binding||!("color" in base))return base;
        return figma.variables.setBoundVariableForEffect(base,"color",variables.get("COLOR:"+binding.variable));
      });
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    void "TABLE-WRITER-MIN-WIDTH-ZERO-UNSET";
    if(layout.minWidth!==undefined)node.minWidth=layout.minWidth===0?null:layout.minWidth;
    if(layout.minHeight!==undefined)node.minHeight=layout.minHeight===0?null:layout.minHeight;
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
    if(layout.minWidth)bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));
    if(layout.minHeight)bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));
  };
  const deferredFill=[];
  const autoLayoutParent=node=>!!node.parent&&"layoutMode" in node.parent&&node.parent.layoutMode!=="NONE";
  void "TABLE-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    // Figma refuses FILL on a node whose parent is not an auto-layout frame, and
    // a set's variants are parented to the SECTION until combineAsVariants runs.
    // Defer those and apply them once the set exists and has its layout.
    const wantsFill=width.mode==="fill"||height.mode==="fill";
    if(wantsFill&&!autoLayoutParent(node)){
      // Record the width the node has while it is still content-sized. A set
      // that HUGS children which FILL it is degenerate -- Figma resolves it to
      // its own default (100px) and the content spills out. The set is sized to
      // the widest variant's own content, which is measured here, not invented.
      void "TABLE-WRITER-RECORD-CONTENT-WIDTH-BEFORE-FILL";
      deferredFill.push([node,ir,node.width]);
    }
    else{
    if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
    else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
    else node.layoutSizingHorizontal="FIXED";
    if(height.mode==="fill")node.layoutSizingVertical="FILL";
    else if(height.mode==="hug")node.layoutSizingVertical="HUG";
    else node.layoutSizingVertical="FIXED";
    }
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applySetLayout=(set,ir)=>{
    applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);
  };
  const firstSegment=name=>name.split(" :: ",1)[0];
  const sceneRole=name=>{const role=firstSegment(name);return role.includes("=")?"":role;};
  const propertyKey=(instance,name)=>Object.keys(instance.componentProperties||{}).find(key=>key.split("#")[0]===name);
  void "TABLE-WRITER-FIRST-SEGMENT-BIND";
  const cellByKey=new Map();
  const rowByKey=new Map();
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("TABLE-FONT-PROVENANCE-ABSENT:"+ir.role);const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();label.textAutoResize=ir.width.mode==="fill"?"HEIGHT":"WIDTH_AND_HEIGHT";label.blendMode="NORMAL";node=label;
    }else if(ir.kind==="instance"){
      if(ir.componentRef==="table@1/cell"){
        const key=(ir.properties.Density||"")+"|"+(ir.properties.Kind||"");
        const main=cellByKey.get(key);if(!main)throw new Error("TABLE-CELL-MAIN-ABSENT:"+key);
        node=main.createInstance();
        const updates={};
        for(const name of ["Label","Column","Align"]){
          const property=propertyKey(node,name);if(!property)throw new Error("TABLE-CELL-PROPERTY-ABSENT:"+name);
          const value=ir.properties[name];
          if(typeof value!=="string")throw new Error("TABLE-CELL-SOURCE-ABSENT:"+name);
          updates[property]=value;
        }
        node.setProperties(updates);
      }else if(ir.componentRef==="table@1/row"){
        const key=(ir.properties.Density||"")+"|"+(ir.properties.State||"");
        const main=rowByKey.get(key);if(!main)throw new Error("TABLE-ROW-MAIN-ABSENT:"+key);
        node=main.createInstance();
        const updates={};
        for(const name of ["Cell 0","Cell 1","Cell 2"]){
          const property=propertyKey(node,name);if(!property)throw new Error("TABLE-ROW-PROPERTY-ABSENT:"+name);
          const value=ir.properties[name];
          if(typeof value!=="string")throw new Error("TABLE-ROW-SOURCE-ABSENT:"+name);
          updates[property]=value;
        }
        node.setProperties(updates);
      }else throw new Error("TABLE-UNKNOWN-INSTANCE:"+ir.componentRef);
      node.name=ir.label||ir.role;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    const hiddenFillContent=(ir.kind==="text"&&ir.width&&ir.width.mode==="fill"&&ir.visible===false);void "TABLE-WRITER-HIDDEN-FILL-OCCUPANCY";
    node.visible=hiddenFillContent||ir.visible!==false;node.opacity=hiddenFillContent?0:(ir.opacity===undefined?1:ir.opacity);
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(ir.layout&&ir.layout.positioning==="absolute"){if(!ir.layout.offset||!ir.layout.constraints)throw new Error("TABLE-ABSOLUTE-DECLARATION-INCOMPLETE:"+ir.role);node.layoutPositioning="ABSOLUTE";node.x=ir.layout.offset.x;node.y=ir.layout.offset.y;const constraintValue=value=>({left:"MIN",right:"MAX",top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"})[value];node.constraints={horizontal:constraintValue(ir.layout.constraints.horizontal),vertical:constraintValue(ir.layout.constraints.vertical)};}
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("TABLE-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintSet=async(setIr,kind)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");component.description="recipe-role:"+(ir.role||"");tag(component,ir,kind+"/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      for(const [childIndex,child] of ir.children.entries())await render(child,component,kind+"/children/"+componentIndex+"/children/"+childIndex);
      applySizing(component,ir);
      if(kind==="table"&&component.layoutMode!=="VERTICAL")throw new Error("TABLE-FAKE-LAYOUT:"+component.name);
      if(kind==="row"&&component.layoutMode!=="HORIZONTAL")throw new Error("TABLE-FAKE-LAYOUT:"+component.name);
      if(kind==="cell"&&component.layoutMode!=="HORIZONTAL")throw new Error("TABLE-FAKE-LAYOUT:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    void "TABLE-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
    set.name=setIr.role+" :: "+(setIr.label||source.sourceName);
    set.description="Experimental table@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    void "TABLE-WRITER-APPLY-DEFERRED-FILL";
    void "TABLE-WRITER-SET-FIXED-WHEN-CHILDREN-FILL";
    const setFillChildren=deferredFill.filter(([node])=>node.parent===set);
    if(setFillChildren.length>0){
      const widest=Math.max(...setFillChildren.map(([,,contentWidth])=>contentWidth));
      if(!(widest>0))throw new Error("TABLE-SET-CONTENT-WIDTH-UNMEASURED");
      set.resizeWithoutConstraints(widest+set.paddingLeft+set.paddingRight,Math.max(set.height,1));
      set.counterAxisSizingMode="FIXED";
    }
    while(deferredFill.length>0){
      const [node,ir]=deferredFill.shift();
      if(!autoLayoutParent(node))throw new Error("TABLE-FILL-PARENT-NOT-AUTOLAYOUT:"+(ir.role||node.name));
      const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
      if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
      else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
      else node.layoutSizingHorizontal="FIXED";
      if(height.mode==="fill")node.layoutSizingVertical="FILL";
      else if(height.mode==="hug")node.layoutSizingVertical="HUG";
      else node.layoutSizingVertical="FIXED";
    }
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey",kind);
    return set;
  };
  const cellSet=await mintSet(source.cellSet,"cell");
  void "TABLE-WRITER-CELL-PROPERTIES";
  const cellLabelProperty=cellSet.addComponentProperty("Label","TEXT",source.cellDefaults.Label);
  cellSet.addComponentProperty("Column","TEXT",source.cellDefaults.Column);
  cellSet.addComponentProperty("Align","TEXT",source.cellDefaults.Align);
  for(const component of cellSet.children){
    for(const descendant of component.findAllWithCriteria({types:["TEXT"]})){
      if(sceneRole(descendant.name)==="table/cell/label")descendant.componentPropertyReferences={characters:cellLabelProperty};
    }
    const props=Object.fromEntries(component.name.split(", ").map(part=>{const index=part.indexOf("=");return [part.slice(0,index),part.slice(index+1)];}));
    cellByKey.set((props.Density||"")+"|"+(props.Kind||""),component);
  }
  const rowSet=await mintSet(source.rowSet,"row");
  void "TABLE-WRITER-ROW-PROPERTIES";
  const rowCell0Property=rowSet.addComponentProperty("Cell 0","TEXT",source.rowDefaults["Cell 0"]);
  const rowCell1Property=rowSet.addComponentProperty("Cell 1","TEXT",source.rowDefaults["Cell 1"]);
  const rowCell2Property=rowSet.addComponentProperty("Cell 2","TEXT",source.rowDefaults["Cell 2"]);
  void "TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS";
  const instanceSublayer=node=>{for(let current=node.parent;current;current=current.parent)if(current.type==="INSTANCE")return true;return false;};
  for(const component of rowSet.children){
    for(const descendant of component.findAllWithCriteria({types:["INSTANCE"]})){
      const role=sceneRole(descendant.name);
      const cellProperty=role==="table/cell-instance/0"?rowCell0Property:role==="table/cell-instance/1"?rowCell1Property:role==="table/cell-instance/2"?rowCell2Property:null;
      if(!cellProperty)continue;
      const labels=descendant.findAllWithCriteria({types:["TEXT"]}).filter(node=>sceneRole(node.name)==="table/cell/label");
      if(labels.length!==1)throw new Error("TABLE-ROW-CELL-LABEL-ABSENT:"+role);
      const template=labels[0];
      const owned=figma.createText();
      await figma.loadFontAsync(template.fontName);
      owned.fontName=template.fontName;
      owned.characters=template.characters;
      owned.fontSize=template.fontSize;
      owned.lineHeight=template.lineHeight;
      owned.textAlignHorizontal=template.textAlignHorizontal;
      owned.textAlignVertical=template.textAlignVertical;
      owned.textAutoResize=template.textAutoResize;
      owned.blendMode="NORMAL";
      owned.visible=false;
      owned.name="table/row/owned-cell-label/"+role.slice("table/cell-instance/".length);
      component.appendChild(owned);
      if(instanceSublayer(owned))throw new Error("TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER:"+role);
      if(owned.characters.trim().length===0)throw new Error("TABLE-ROW-OWNED-TEXT-ABSENT:"+role);
      owned.componentPropertyReferences={characters:cellProperty};
    }
    const props=Object.fromEntries(component.name.split(", ").map(part=>{const index=part.indexOf("=");return [part.slice(0,index),part.slice(index+1)];}));
    rowByKey.set((props.Density||"")+"|"+(props.State||""),component);
  }
  const tableSet=await mintSet(source.tableSet,"table");
  cellSet.x=80;cellSet.y=96;rowSet.x=80;rowSet.y=cellSet.y+cellSet.height+96;tableSet.x=80;tableSet.y=rowSet.y+rowSet.height+96;
  section.resizeWithoutConstraints(Math.max(cellSet.width,rowSet.width,tableSet.width)+160,tableSet.y+tableSet.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,tableSetId:tableSet.id,rowSetId:rowSet.id,cellSetId:cellSet.id,collectionId:collection.id,variableCount:variables.size,variantCount:tableSet.children.length+rowSet.children.length+cellSet.children.length,tableCells:source.tableCells.length,rowCells:source.rowCells.length,cellCells:source.cellCells.length,instanceCount:source.instanceCount,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function emitTableFigmaWriter(
  inputs: readonly TableFigmaWriterInput[],
): TableFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateTableFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));
  const runIdentity =
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
    `-${TABLE_FIGMA_RUN_SUFFIX}`;
  if (
    TABLE_FIGMA_NAMESPACE === FORBIDDEN_INPUT_NAMESPACE ||
    TABLE_FIGMA_NAMESPACE === FORBIDDEN_COMBOBOX_NAMESPACE ||
    runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_COMBOBOX_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V1_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V2_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V3_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V4_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V5_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V6_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V7_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V8_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V9_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V10_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V11_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V12_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V13_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V14_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V15_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V16_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V17_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V18_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V19_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V20_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V21_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V22_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V23_RUN_IDENTITY ||
    runIdentity === FORBIDDEN_TABLE_V24_RUN_IDENTITY
  ) {
    throw new TypeError(
      "table writer must not reuse Input, Combobox, or Table v1–v23 identity",
    );
  }
  const pageName = `Recipe Pivot / Table / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map(({ tableSet, rowSet, cellSet, ...source }) => ({
      ...source,
      tableSet,
      rowSet,
      cellSet,
    })),
  };
  const runtime = writerRuntime(
    TABLE_FIGMA_NAMESPACE,
    TABLE_FIGMA_WRITER_VERSION,
  );
  if (
    runtime.includes("node.letterSpacing") ||
    runtime.includes("node.textCase") ||
    runtime.includes("node.textDecoration")
  ) {
    throw new TypeError("table writer invented TEXT extras compile omits");
  }
  if (
    runtime.includes("figma.combineAsVariants") === false ||
    runtime.includes("figma_arrange_component_set")
  ) {
    throw new TypeError(
      "table writer must mint sets without arranging Input or Combobox",
    );
  }
  if (
    runtime.includes("componentPropertyReferences={[labelKey]") ||
    /componentPropertyReferences=\{\[/.test(runtime) ||
    runtime.includes("labels[0].componentPropertyReferences")
  ) {
    throw new TypeError(
      "table writer must bind row Cell N on original row TEXT characters, not a Label# key or instance-sublayer TEXT",
    );
  }
  if (
    runtime.includes("TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS") === false ||
    runtime.includes("TABLE-ROW-OWNED-TEXT-ABSENT") === false ||
    runtime.includes("TABLE-ROW-CELL-LABEL-ABSENT") === false ||
    runtime.includes(
      "TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER",
    ) === false
  ) {
    throw new TypeError("table writer missing row owned-TEXT characters bind");
  }
  if (
    runtime.includes("TABLE-WRITER-MIN-WIDTH-ZERO-UNSET") === false ||
    runtime.includes(
      "node.minWidth=layout.minWidth===0?null:layout.minWidth",
    ) === false
  ) {
    throw new TypeError(
      "table writer must unset host minWidth 0 with null rather than assigning 0",
    );
  }
  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  if (
    code.includes(FORBIDDEN_INPUT_PAGE_ID) &&
    !runtime.includes("TABLE-MUST-NOT-WRITE-INPUT-PAGE")
  ) {
    throw new TypeError("table writer must not target the Input page");
  }
  return {
    pageName,
    runIdentity,
    namespace: TABLE_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
