import type { RecipeEnvelope } from "../envelope.js";
import {
  TABLE_DENSITIES,
  TABLE_ROW_STATES,
  collapseTableRecipe,
  type TableColorParameter,
  type TableNumberParameter,
  type TableRecipeInstance,
} from "../recipes/table.js";
import type { RecipeSelection } from "../recipe.js";
import {
  assertSafeOutputFiles,
  buildCssTokenNameMap,
  cssTokenName,
  parseFontFamilyStack,
  quoteFontFamilyStack,
} from "../output-safety.js";

export interface EmittedTableFile {
  path: string;
  contents: string;
}
export interface TableOutputBundle {
  react: EmittedTableFile[];
  webComponent: EmittedTableFile[];
}

const collectLeaves = (
  value: unknown,
  leaves = new Map<string, string | number>(),
): Map<string, string | number> => {
  if (Array.isArray(value)) {
    for (const child of value) collectLeaves(child, leaves);
  } else if (value !== null && typeof value !== "object") {
    return leaves;
  } else {
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      const prior = leaves.get(record.variable);
      if (prior !== undefined && prior !== record.fallback)
        throw new TypeError(
          `table output: token ${record.variable} has conflicting fallbacks`,
        );
      leaves.set(record.variable, record.fallback);
      return leaves;
    }
    for (const child of Object.values(record)) collectLeaves(child, leaves);
  }
  return leaves;
};
const token = (
  parameter: TableNumberParameter | TableColorParameter,
): string => `var(${cssTokenName(parameter.variable)})`;
const fontFamily = (font: TableRecipeInstance["tokens"]["typography"]["body"]) => {
  for (const candidate of font.fallbackChain)
    parseFontFamilyStack(candidate.family);
  return quoteFontFamilyStack(
    font.fallbackChain.map((candidate) => candidate.family),
  );
};

const stylesheet = (instance: TableRecipeInstance): string => {
  const leaves = collectLeaves(instance.tokens);
  buildCssTokenNameMap([...leaves.keys()]);
  const lines = [
    "/* Experimental table@1 output. Generated; do not edit. */",
    ":root, :host {",
    ...[...leaves]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([identity, fallback]) =>
          `  ${cssTokenName(identity)}: ${typeof fallback === "number" ? `${fallback}px` : fallback};`,
      ),
    "}",
    ".recipe-table { display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; }",
    ".recipe-table__header { display:flex; flex-direction:row; }",
    ".recipe-table__body { display:flex; flex-direction:column; }",
    ".recipe-table__row { display:flex; flex-direction:row; }",
    ".recipe-table__cell { display:flex; align-items:center; box-sizing:border-box; }",
    `.recipe-table { background:${token(instance.tokens.surface)}; color:${token(instance.tokens.text)}; border:solid ${token(instance.tokens.frameBorderWidth)} ${token(instance.tokens.frameBorder)}; border-radius:${token(instance.tokens.radius)}; }`,
    `.recipe-table__header { background:${token(instance.tokens.headerBackground)}; }`,
    `.recipe-table__cell { border-bottom:solid ${token(instance.tokens.cellRuleWidth)} ${token(instance.tokens.cellRule)}; }`,
    `.recipe-table__cell[data-kind="header"] { font-family:${fontFamily(instance.tokens.typography.header)}; }`,
    `.recipe-table__cell[data-kind="body"] { font-family:${fontFamily(instance.tokens.typography.body)}; }`,
  ];
  for (const densityName of TABLE_DENSITIES) {
    const density = instance.tokens.densities[densityName];
    lines.push(
      `.recipe-table[data-density="${densityName}"] .recipe-table__cell { padding:${token(density.paddingY)} ${token(density.paddingX)}; font-size:${token(density.fontSize)}; min-width:${token(density.minWidth!)}; }`,
    );
  }
  for (const state of TABLE_ROW_STATES)
    lines.push(
      `.recipe-table__row[data-state="${state}"] { background:${token(instance.tokens.rowStates[state].background)}; }`,
    );
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const reactSource = (instance: TableRecipeInstance): string => `import {
  useCallback, useId, useMemo, useState,
  type KeyboardEvent,
} from "react";

export interface TableColumn { id: string; label: string; align?: "left" | "right"; }
export interface TableRow { id: string; cells: [string, string, string]; }
export interface TableProps {
  density?: "compact" | "comfortable";
  columns?: TableColumn[];
  rows?: TableRow[];
  selectedRowId?: string | null;
  defaultSelectedRowId?: string | null;
  onRowSelect?: (rowId: string) => void;
}
const DEFAULT_COLUMNS = ${JSON.stringify(instance.content.columns)};
const DEFAULT_ROWS = ${JSON.stringify(instance.content.rows.map((row) => ({ id: row.id, cells: row.cells })))};
export function Table({
  density = "comfortable",
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
  selectedRowId,
  defaultSelectedRowId = ${JSON.stringify(instance.content.selectedRowId)},
  onRowSelect,
}: TableProps) {
  const generatedId = useId();
  const id = \`table-\${generatedId.replaceAll(":", "")}\`;
  const [localSelected, setLocalSelected] = useState<string | null>(defaultSelectedRowId);
  const selected = selectedRowId === undefined ? localSelected : selectedRowId;
  const selectedIndex = useMemo(
    () => rows.findIndex((row) => row.id === selected),
    [rows, selected],
  );
  const select = useCallback((rowId: string) => {
    if (selectedRowId === undefined) setLocalSelected(rowId);
    onRowSelect?.(rowId);
  }, [onRowSelect, selectedRowId]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      select(rows[Math.min(rows.length - 1, current + 1)]!.id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      select(rows[Math.max(0, current - 1)]!.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(rows[0]!.id);
    } else if (event.key === "End") {
      event.preventDefault();
      select(rows[rows.length - 1]!.id);
    }
  }, [rows, select, selectedIndex]);
  return <div id={id} className="recipe-table" role="table" data-density={density} tabIndex={0} onKeyDown={onKeyDown}>
    <div className="recipe-table__header" role="rowgroup">
      <div className="recipe-table__row" role="row" data-state="default">
        {columns.map((column) =>
          <div key={column.id} className="recipe-table__cell" role="columnheader" data-kind="header" data-column={column.id}>{column.label}</div>
        )}
      </div>
    </div>
    <div className="recipe-table__body" role="rowgroup">
      {rows.map((row) =>
        <div key={row.id} className="recipe-table__row" role="row" data-state={row.id === selected ? "selected" : "default"}
          aria-selected={row.id === selected || undefined} onClick={() => select(row.id)}>
          {row.cells.map((cell, index) =>
            <div key={columns[index]?.id ?? String(index)} className="recipe-table__cell" role="cell" data-kind="body">{cell}</div>
          )}
        </div>
      )}
    </div>
  </div>;
}
`;

const webComponentSource = (
  instance: TableRecipeInstance,
  css: string,
): string => `const STYLES = ${JSON.stringify(css)};
const DEFAULT_COLUMNS = ${JSON.stringify(instance.content.columns)};
const DEFAULT_ROWS = ${JSON.stringify(instance.content.rows.map((row) => ({ id: row.id, cells: row.cells })))};
let nextId = 0;
export class RecipeTableElement extends HTMLElement {
  static observedAttributes = ["density","selected-row-id","columns","rows"];
  constructor() {
    super();
    this.controlId = this.id || \`recipe-table-\${++nextId}\`;
    const root = this.attachShadow({mode:"open"});
    this.styleNode = document.createElement("style"); this.styleNode.textContent = STYLES;
    this.rootNode = document.createElement("div"); this.rootNode.className = "recipe-table"; this.rootNode.setAttribute("role","table"); this.rootNode.tabIndex = 0;
    this.headerNode = document.createElement("div"); this.headerNode.className = "recipe-table__header"; this.headerNode.setAttribute("role","rowgroup");
    this.bodyNode = document.createElement("div"); this.bodyNode.className = "recipe-table__body"; this.bodyNode.setAttribute("role","rowgroup");
    this.rootNode.append(this.headerNode, this.bodyNode); root.append(this.styleNode, this.rootNode);
    this.rootNode.addEventListener("keydown", event => this.onKeyDown(event));
  }
  connectedCallback() { if (this.id) this.controlId = this.id; this.patch(); }
  attributeChangedCallback(name, oldValue, newValue) { if (oldValue !== newValue && this.rootNode) this.patch(); }
  get columns() { try { const parsed = JSON.parse(this.getAttribute("columns") || "null"); return Array.isArray(parsed) ? parsed : DEFAULT_COLUMNS; } catch { return DEFAULT_COLUMNS; } }
  get rows() { try { const parsed = JSON.parse(this.getAttribute("rows") || "null"); return Array.isArray(parsed) ? parsed : DEFAULT_ROWS; } catch { return DEFAULT_ROWS; } }
  get selectedRowId() { return this.getAttribute("selected-row-id") || ${JSON.stringify(instance.content.selectedRowId)}; }
  set selectedRowId(value) { if (value) this.setAttribute("selected-row-id", String(value)); else this.removeAttribute("selected-row-id"); }
  emit(name, detail) { this.dispatchEvent(new CustomEvent(name,{detail,bubbles:true,composed:true})); }
  select(rowId) { this.selectedRowId = rowId; this.emit("row-select",{rowId}); this.patch(); }
  onKeyDown(event) {
    const rows = this.rows; if (!rows.length) return;
    const current = Math.max(0, rows.findIndex(row => row.id === this.selectedRowId));
    if (event.key === "ArrowDown") { event.preventDefault(); this.select(rows[Math.min(rows.length - 1, current + 1)].id); }
    else if (event.key === "ArrowUp") { event.preventDefault(); this.select(rows[Math.max(0, current - 1)].id); }
    else if (event.key === "Home") { event.preventDefault(); this.select(rows[0].id); }
    else if (event.key === "End") { event.preventDefault(); this.select(rows[rows.length - 1].id); }
  }
  patch() {
    const columns = this.columns; const rows = this.rows; const selected = this.selectedRowId;
    this.rootNode.id = this.controlId;
    this.rootNode.dataset.density = ["compact","comfortable"].includes(this.getAttribute("density")) ? this.getAttribute("density") : "comfortable";
    this.headerNode.replaceChildren();
    const headerRow = document.createElement("div"); headerRow.className = "recipe-table__row"; headerRow.setAttribute("role","row"); headerRow.dataset.state = "default";
    columns.forEach(column => { const cell = document.createElement("div"); cell.className = "recipe-table__cell"; cell.setAttribute("role","columnheader"); cell.dataset.kind = "header"; cell.dataset.column = column.id; cell.textContent = column.label; headerRow.append(cell); });
    this.headerNode.append(headerRow);
    this.bodyNode.replaceChildren();
    rows.forEach(row => {
      const rowNode = document.createElement("div"); rowNode.className = "recipe-table__row"; rowNode.setAttribute("role","row");
      rowNode.dataset.state = row.id === selected ? "selected" : "default";
      if (row.id === selected) rowNode.setAttribute("aria-selected","true");
      rowNode.addEventListener("click", () => this.select(row.id));
      row.cells.forEach((value, index) => { const cell = document.createElement("div"); cell.className = "recipe-table__cell"; cell.setAttribute("role","cell"); cell.dataset.kind = "body"; cell.textContent = value; if (columns[index]) cell.dataset.column = columns[index].id; rowNode.append(cell); });
      this.bodyNode.append(rowNode);
    });
  }
}
export function define(tagName = "recipe-table") { if (!customElements.get(tagName)) customElements.define(tagName,RecipeTableElement); }
define();
`;

export function emitTableOutputs(
  envelope: RecipeEnvelope,
  selection: RecipeSelection,
): TableOutputBundle {
  const instance = collapseTableRecipe(envelope, selection);
  const css = stylesheet(instance);
  const provenance = `${JSON.stringify(
    {
      artifactVersion: "table-font-token-provenance-v1",
      fonts: instance.tokens.typography,
      source: instance.provenance.source,
    },
    null,
    2,
  )}\n`;
  const bundle = {
    react: [
      { path: "react/Table.tsx", contents: reactSource(instance) },
      { path: "react/table.css", contents: css },
      { path: "react/table-provenance.json", contents: provenance },
    ],
    webComponent: [
      {
        path: "web-component/recipe-table.js",
        contents: webComponentSource(instance, css),
      },
      { path: "web-component/recipe-table.css", contents: css },
      {
        path: "web-component/table-provenance.json",
        contents: provenance,
      },
    ],
  };
  assertSafeOutputFiles(bundle.react, "react");
  assertSafeOutputFiles(bundle.webComponent, "web-component");
  return bundle;
}
