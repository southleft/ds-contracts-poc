import { factId, type RecipeEnvelope } from "./envelope.js";
import type { ComponentSetNode, IRNode } from "./figma-ir.js";
import { canonicalJson } from "./normalize.js";
import {
  buttonParameterValue,
  collapseButtonRecipe,
  type ButtonRecipeInstance,
} from "./recipes/button.js";
import {
  collapseInputFieldRecipe,
  type InputFieldRecipeInstance,
} from "./recipes/input-field.js";
import {
  collapseComboboxRecipe,
  type ComboboxRecipeInstance,
} from "./recipes/combobox.js";
import {
  collapseTableRecipe,
  type TableRecipeInstance,
} from "./recipes/table.js";

export type FactDisposition = "carried" | "extension" | "receipt";

export interface MeasuredFactLanding {
  fact: string;
  disposition: FactDisposition;
  landing: string;
  measured: boolean;
}

export interface ButtonAccountingReport {
  factsCompared: number;
  measuredLandings: number;
  carried: number;
  extensions: number;
  receipts: number;
  rows: MeasuredFactLanding[];
  failures: string[];
}

export type InputFieldAccountingReport = ButtonAccountingReport;
export type ComboboxAccountingReport = ButtonAccountingReport;
export type TableAccountingReport = ButtonAccountingReport;

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

const tokenVariables = (
  value: unknown,
  out = new Set<string>(),
): Set<string> => {
  if (Array.isArray(value)) {
    for (const child of value) tokenVariables(child, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "variable" && typeof child === "string") out.add(child);
      else tokenVariables(child, out);
    }
  }
  return out;
};

const extensionHas = (
  envelope: RecipeEnvelope,
  channel: string,
  id: string,
): boolean =>
  envelope.extensions.some(
    (extension) =>
      extension.id === id &&
      extension.absorbs.some((fact) => fact.channel === channel),
  );

const atLanding = (value: unknown, landing: string): unknown =>
  landing.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);

const parameterSemantics = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(parameterSemantics);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.kind === "token" || record.kind === "literal") {
    return buttonParameterValue(
      value as Parameters<typeof buttonParameterValue>[0],
    );
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      parameterSemantics(child),
    ]),
  );
};

export function auditButtonAccounting(
  source: ButtonRecipeInstance,
  envelope: RecipeEnvelope,
): ButtonAccountingReport {
  const failures: string[] = [];
  if (envelope.ir.kind !== "component-set") {
    return {
      factsCompared: source.inputFacts.length,
      measuredLandings: 0,
      carried: 0,
      extensions: 0,
      receipts: 0,
      rows: [],
      failures: ["root IR is not a component-set"],
    };
  }
  const root = envelope.ir as ComponentSetNode;
  const irBindings = new Set<string>();
  walk(root, (node) => {
    for (const binding of node.bindings ?? []) irBindings.add(binding.variable);
  });
  const expectedTokens = tokenVariables(source.tokens);
  const hasParameterFacts = source.inputFacts.some((fact) =>
    fact.channel.startsWith("parameter:"),
  );
  const recovered = hasParameterFacts
    ? collapseButtonRecipe(envelope, source.provenance.selection)
    : undefined;

  const measures: Record<string, Omit<MeasuredFactLanding, "fact">> = {
    "activation-behavior": {
      disposition: "extension",
      landing: "extensions[button/activation]",
      measured: extensionHas(
        envelope,
        "activation-behavior",
        "button/activation",
      ),
    },
    "aria-disabled": {
      disposition: "extension",
      landing: "extensions[button/aria-disabled]",
      measured: extensionHas(envelope, "aria-disabled", "button/aria-disabled"),
    },
    axes: {
      disposition: "carried",
      landing: "ir.variantAxes + complete 144-cell matrix",
      measured:
        root.variantAxes.length === 4 &&
        root.children.length === 144 &&
        root.children.every(
          (component) => Object.keys(component.variantProperties).length === 4,
        ),
    },
    label: {
      disposition: "carried",
      landing: "ir component children[role=button/label].characters",
      measured: root.children.every((component) => {
        const labels = component.children.filter(
          (child) => child.role === "button/label",
        );
        return (
          labels.length === 1 &&
          labels[0]?.kind === "text" &&
          labels[0].characters === source.label.default
        );
      }),
    },
    "recipe-selection": {
      disposition: "extension",
      landing: "provenance.selection + extensions[button/recipe-selection]",
      measured:
        source.provenance.selection.candidates.length === 1 &&
        source.provenance.selection.manualCost.value > 0 &&
        extensionHas(envelope, "recipe-selection", "button/recipe-selection"),
    },
    slots: {
      disposition: "carried",
      landing:
        "ir instance roles button/slot/leading + button/slot/trailing + loading replacement",
      measured:
        root.children.some((component) =>
          component.children.some(
            (child) =>
              child.kind === "instance" &&
              child.role === "button/slot/leading" &&
              child.componentRef === source.slots.leading.componentRef,
          ),
        ) &&
        root.children.some((component) =>
          component.children.some(
            (child) =>
              child.kind === "instance" &&
              child.role === "button/slot/trailing" &&
              child.componentRef === source.slots.trailing.componentRef,
          ),
        ) &&
        root.children.some((component) =>
          component.children.some(
            (child) =>
              child.kind === "instance" &&
              child.role === "button/loading-indicator" &&
              child.componentRef === source.loading.indicatorComponentRef,
          ),
        ),
    },
    tokens: {
      disposition: "carried",
      landing: "ir bindings matched by variable name and literal fallback",
      measured:
        expectedTokens.size > 0 &&
        expectedTokens.size === irBindings.size &&
        [...expectedTokens].every((variable) => irBindings.has(variable)),
    },
    "transition-timing-function": {
      disposition: "receipt",
      landing: "receipts[transition-timing-function]",
      measured: envelope.receipts.some(
        (receipt) =>
          receipt.fact.channel === "transition-timing-function" &&
          receipt.reason === "no-figma-primitive" &&
          receipt.evidence.includes("docs/32"),
      ),
    },
  };

  const rows: MeasuredFactLanding[] = [];
  const seen = new Set<string>();
  for (const fact of source.inputFacts) {
    const id = factId(fact);
    if (seen.has(id)) failures.push(`${id}: duplicated source fact`);
    seen.add(id);
    const landing = fact.channel.startsWith("parameter:")
      ? fact.channel.slice("parameter:".length)
      : undefined;
    const dynamicMeasure = landing
      ? {
          disposition: "carried" as const,
          landing,
          measured:
            atLanding(source, landing) !== undefined &&
            recovered !== undefined &&
            canonicalJson(parameterSemantics(atLanding(source, landing))) ===
              canonicalJson(parameterSemantics(atLanding(recovered, landing))),
        }
      : undefined;
    const measure = dynamicMeasure ?? measures[fact.channel];
    if (!measure) {
      failures.push(`${id}: no independent measurement`);
      continue;
    }
    rows.push({ fact: id, ...measure });
    if (!measure.measured) {
      failures.push(
        `${id}: claimed ${measure.disposition.toUpperCase()} has no measured landing at ${measure.landing}`,
      );
    }

    const declaredCarried = envelope.accounting.carried.some(
      (candidate) => factId(candidate) === id,
    );
    const declaredExtension = envelope.extensions.some((extension) =>
      extension.absorbs.some((candidate) => factId(candidate) === id),
    );
    const declaredReceipt = envelope.receipts.some(
      (receipt) => factId(receipt.fact) === id,
    );
    const actual = [
      declaredCarried && "carried",
      declaredExtension && "extension",
      declaredReceipt && "receipt",
    ].filter(Boolean);
    if (actual.length !== 1 || actual[0] !== measure.disposition) {
      failures.push(
        `${id}: declared landing ${actual.join("+") || "none"} disagrees with independently measured ${measure.disposition}`,
      );
    }
  }

  if (rows.length === 0) failures.push("factsCompared is zero");
  const measuredLandings = rows.filter((row) => row.measured).length;
  if (measuredLandings === 0) failures.push("measuredLandings is zero");
  return {
    factsCompared: rows.length,
    measuredLandings,
    carried: rows.filter((row) => row.disposition === "carried").length,
    extensions: rows.filter((row) => row.disposition === "extension").length,
    receipts: rows.filter((row) => row.disposition === "receipt").length,
    rows,
    failures,
  };
}

export function auditInputFieldAccounting(
  source: InputFieldRecipeInstance,
  envelope: RecipeEnvelope,
): InputFieldAccountingReport {
  const failures: string[] = [];
  if (envelope.ir.kind !== "component-set") {
    return {
      factsCompared: source.inputFacts.length,
      measuredLandings: 0,
      carried: 0,
      extensions: 0,
      receipts: 0,
      rows: [],
      failures: ["root IR is not a component-set"],
    };
  }
  const root = envelope.ir;
  const bindings = new Set<string>();
  walk(root, (node) => {
    for (const binding of node.bindings ?? []) bindings.add(binding.variable);
  });
  const expectedTokens = tokenVariables(source.tokens);
  const codeOnlyPositionTokens =
    source.structure.labelPlacement === "floating"
      ? new Set(
          Object.values(source.tokens.sizes).flatMap((size) => [
            size.labelInsetX.variable,
            size.labelInactiveOffsetY.variable,
            size.labelFloatingOffsetY.variable,
          ]),
        )
      : new Set<string>();
  const expectedDrawableTokens = new Set(
    [...expectedTokens].filter(
      (variable) => !codeOnlyPositionTokens.has(variable),
    ),
  );
  const recovered = source.inputFacts.some((fact) =>
    fact.channel.startsWith("parameter:"),
  )
    ? collapseInputFieldRecipe(envelope, source.provenance.selection)
    : undefined;
  const allComponents = root.children;
  const everyRole = (role: string, kind?: IRNode["kind"]): boolean =>
    allComponents.every((component) => {
      const matches: IRNode[] = [];
      walk(component, (node) => {
        if (node.role === role && (kind === undefined || node.kind === kind)) {
          matches.push(node);
        }
      });
      return matches.length === 1;
    });
  const anyRole = (role: string): boolean => {
    let found = false;
    walk(root, (node) => {
      if (node.role === role) found = true;
    });
    return found;
  };
  const measures: Record<string, Omit<MeasuredFactLanding, "fact">> = {
    "adornment-payload": {
      disposition: "carried",
      landing:
        "IR adornment instance payload content/typography/fills/geometry/alignment/accessibility/source",
      measured: (() => {
        let count = 0;
        let valid = true;
        walk(root, (node) => {
          if (
            node.kind === "instance" &&
            node.role?.startsWith("input-field/slot/")
          ) {
            count += 1;
            valid =
              valid &&
              node.payload !== undefined &&
              node.payload.fills.length > 0 &&
              node.payload.intrinsicSize.width > 0 &&
              node.payload.intrinsicSize.height > 0 &&
              (node.payload.content.kind === "instance" ||
                node.payload.content.text.length > 0);
          }
        });
        return count > 0 && valid;
      })(),
    },
    axes: {
      disposition: "carried",
      landing: "ir.variantAxes + complete 128-cell matrix",
      measured:
        root.variantAxes.length === 5 &&
        root.children.length === 128 &&
        root.children.every(
          (component) => Object.keys(component.variantProperties).length === 5,
        ),
    },
    "designer-edit-surface": {
      disposition: "carried",
      landing:
        "five Figma variant axes, five text roles, two instance roles, fixed root/fill descendants",
      measured:
        root.variantAxes.length ===
          source.designerEditSurface.variantProperties.length &&
        source.designerEditSurface.textProperties.length === 5 &&
        anyRole("input-field/slot/leading") &&
        anyRole("input-field/slot/trailing") &&
        root.children.every(
          (component) =>
            component.layout.width.mode === "fixed" &&
            component.layout.height.mode === "hug",
        ),
    },
    "input-content": {
      disposition: "carried",
      landing:
        "Content axis selects exactly one input-field/content/placeholder or /value role",
      measured:
        anyRole("input-field/content/placeholder") &&
        anyRole("input-field/content/value") &&
        root.children.every((component) => {
          const visible: IRNode[] = [];
          const surface = component.children.find(
            (node) => node.role === "input-field/surface",
          );
          if (surface) {
            walk(surface, (node) => {
              if (node.role?.startsWith("input-field/content/")) {
                visible.push(node);
              }
            });
          }
          return visible.length === 1;
        }),
    },
    "font-provenance": {
      disposition: "carried",
      landing:
        "every IR text node records requested/source/fallback/resolved font facts",
      measured: (() => {
        let count = 0;
        let valid = true;
        walk(root, (node) => {
          if (node.kind === "text") {
            count += 1;
            valid =
              valid &&
              node.type.fontProvenance !== undefined &&
              node.type.fontProvenance.requestSource.length > 0 &&
              node.type.fontProvenance.fallbackChain.length > 0;
          }
        });
        return count > 0 && valid;
      })(),
    },
    label: {
      disposition: "carried",
      landing: "one input-field/label text node per variant",
      measured: everyRole("input-field/label", "text"),
    },
    messages: {
      disposition: "carried",
      landing:
        "one helper or error message role per variant, selected by State",
      measured: root.children.every((component) => {
        const state = component.variantProperties.State;
        const role =
          state === "error"
            ? "input-field/message/error"
            : "input-field/message/helper";
        let count = 0;
        walk(component, (node) => {
          if (node.role === role && node.kind === "text") count += 1;
        });
        return count === 1;
      }),
    },
    "required-indicator": {
      disposition: "carried",
      landing: "Required axis controls the input-field/required-indicator role",
      measured: root.children.every((component) => {
        let count = 0;
        walk(component, (node) => {
          if (node.role === "input-field/required-indicator") count += 1;
        });
        return (
          count === (component.variantProperties.Required === "true" ? 1 : 0)
        );
      }),
    },
    slots: {
      disposition: "carried",
      landing:
        "Adornments axis controls leading/trailing instance roles with explicit refs",
      measured:
        anyRole("input-field/slot/leading") &&
        anyRole("input-field/slot/trailing") &&
        allComponents.every((component) => {
          let valid = true;
          walk(component, (node) => {
            if (
              node.kind === "instance" &&
              node.role?.startsWith("input-field/slot/")
            ) {
              valid = valid && node.payload !== undefined;
            }
          });
          return valid;
        }),
    },
    tokens: {
      disposition: "carried",
      landing:
        "all Figma-bindable numeric/color parameters have IR bindings; x/y identities are separately typed code-only writer-plan receipts",
      measured:
        expectedDrawableTokens.size > 0 &&
        [...expectedDrawableTokens].every((variable) =>
          bindings.has(variable),
        ) &&
        [...bindings].every((variable) => expectedTokens.has(variable)),
    },
    "aria-describedby": {
      disposition: "extension",
      landing: "extensions[input-field/aria-describedby]",
      measured: extensionHas(
        envelope,
        "aria-describedby",
        "input-field/aria-describedby",
      ),
    },
    "aria-invalid": {
      disposition: "extension",
      landing: "extensions[input-field/aria-invalid]",
      measured: extensionHas(
        envelope,
        "aria-invalid",
        "input-field/aria-invalid",
      ),
    },
    "input-events": {
      disposition: "extension",
      landing: "extensions[input-field/events]",
      measured: extensionHas(envelope, "input-events", "input-field/events"),
    },
    "label-input-association": {
      disposition: "extension",
      landing: "extensions[input-field/label-input-association]",
      measured: extensionHas(
        envelope,
        "label-input-association",
        "input-field/label-input-association",
      ),
    },
    "native-required-disabled": {
      disposition: "extension",
      landing: "extensions[input-field/native-required-disabled]",
      measured: extensionHas(
        envelope,
        "native-required-disabled",
        "input-field/native-required-disabled",
      ),
    },
    "recipe-selection": {
      disposition: "extension",
      landing:
        "provenance.selection + extensions[input-field/recipe-selection]",
      measured:
        source.provenance.selection.candidates.length === 1 &&
        source.provenance.selection.manualCost.value > 0 &&
        extensionHas(
          envelope,
          "recipe-selection",
          "input-field/recipe-selection",
        ),
    },
    "transition-timing-function": {
      disposition: "receipt",
      landing: "receipts[transition-timing-function]",
      measured: envelope.receipts.some(
        (receipt) =>
          receipt.fact.channel === "transition-timing-function" &&
          receipt.reason === "no-figma-primitive" &&
          receipt.evidence.includes("docs/32"),
      ),
    },
  };

  const rows: MeasuredFactLanding[] = [];
  const seen = new Set<string>();
  for (const fact of source.inputFacts) {
    const id = factId(fact);
    if (seen.has(id)) failures.push(`${id}: duplicated source fact`);
    seen.add(id);
    const landing = fact.channel.startsWith("parameter:")
      ? fact.channel.slice("parameter:".length)
      : undefined;
    const measure = landing
      ? {
          disposition: "carried" as const,
          landing,
          measured:
            recovered !== undefined &&
            atLanding(source, landing) !== undefined &&
            canonicalJson(atLanding(source, landing)) ===
              canonicalJson(atLanding(recovered, landing)),
        }
      : measures[fact.channel];
    if (!measure) {
      failures.push(`${id}: no independent measurement`);
      continue;
    }
    rows.push({ fact: id, ...measure });
    if (!measure.measured) {
      failures.push(
        `${id}: claimed ${measure.disposition.toUpperCase()} has no measured landing at ${measure.landing}`,
      );
    }
    const declared = [
      envelope.accounting.carried.some(
        (candidate) => factId(candidate) === id,
      ) && "carried",
      envelope.extensions.some((extension) =>
        extension.absorbs.some((candidate) => factId(candidate) === id),
      ) && "extension",
      envelope.receipts.some((receipt) => factId(receipt.fact) === id) &&
        "receipt",
    ].filter(Boolean);
    if (declared.length !== 1 || declared[0] !== measure.disposition) {
      failures.push(
        `${id}: declared landing ${declared.join("+") || "none"} disagrees with independently measured ${measure.disposition}`,
      );
    }
  }
  if (rows.length === 0) failures.push("factsCompared is zero");
  const measuredLandings = rows.filter((row) => row.measured).length;
  if (measuredLandings === 0) failures.push("measuredLandings is zero");
  return {
    factsCompared: rows.length,
    measuredLandings,
    carried: rows.filter((row) => row.disposition === "carried").length,
    extensions: rows.filter((row) => row.disposition === "extension").length,
    receipts: rows.filter((row) => row.disposition === "receipt").length,
    rows,
    failures,
  };
}

export function auditComboboxAccounting(
  source: ComboboxRecipeInstance,
  envelope: RecipeEnvelope,
): ComboboxAccountingReport {
  const failures: string[] = [];
  const recovered = collapseComboboxRecipe(
    envelope,
    source.provenance.selection,
  );
  const rows: MeasuredFactLanding[] = [];
  const seen = new Set<string>();
  const baseMeasures: Record<string, Omit<MeasuredFactLanding, "fact">> = {
    structure: {
      disposition: "carried",
      landing: "combobox/set 64 variants + absolute overlay/listbox",
      measured:
        envelope.ir.kind === "frame" &&
        envelope.ir.children.some(
          (node) =>
            node.kind === "component-set" &&
            node.role === "combobox/set" &&
            node.children.length === 64,
        ),
    },
    options: {
      disposition: "carried",
      landing: "four repeated option instances with typed properties",
      measured:
        canonicalJson(source.content.options) ===
        canonicalJson(recovered.content.options),
    },
    tokens: {
      disposition: "carried",
      landing: "bound primitive IR fields",
      measured:
        canonicalJson(source.tokens) === canonicalJson(recovered.tokens),
    },
    "designer-edit-surface": {
      disposition: "carried",
      landing: "declared axes, text, swaps, collection, and resize policy",
      measured:
        canonicalJson(source.designerEditSurface) ===
        canonicalJson(recovered.designerEditSurface),
    },
    "aria-model": {
      disposition: "extension",
      landing: "extensions[combobox/aria]",
      measured: extensionHas(envelope, "aria-model", "combobox/aria"),
    },
    events: {
      disposition: "extension",
      landing: "extensions[combobox/events]",
      measured: extensionHas(envelope, "events", "combobox/events"),
    },
    keyboard: {
      disposition: "extension",
      landing: "extensions[combobox/keyboard]",
      measured: extensionHas(envelope, "keyboard", "combobox/keyboard"),
    },
    "focus-retention": {
      disposition: "extension",
      landing: "extensions[combobox/focus-retention]",
      measured: extensionHas(
        envelope,
        "focus-retention",
        "combobox/focus-retention",
      ),
    },
    "recipe-selection": {
      disposition: "extension",
      landing: "provenance.selection + extensions[combobox/recipe-selection]",
      measured:
        source.provenance.selection.manualCost.value > 0 &&
        extensionHas(envelope, "recipe-selection", "combobox/recipe-selection"),
    },
  };
  for (const fact of source.inputFacts) {
    const id = factId(fact);
    if (seen.has(id)) failures.push(`${id}: duplicated source occurrence`);
    seen.add(id);
    const measure = fact.channel.startsWith("parameter:")
      ? {
          disposition: "carried" as const,
          landing: fact.channel.slice("parameter:".length),
          measured:
            canonicalJson(
              atLanding(source, fact.channel.slice("parameter:".length)),
            ) ===
            canonicalJson(
              atLanding(recovered, fact.channel.slice("parameter:".length)),
            ),
        }
      : fact.channel.startsWith("extension:")
        ? {
            disposition: "extension" as const,
            landing: `extensions[${fact.channel.slice("extension:".length)}]`,
            measured: envelope.extensions.some(
              (extension) =>
                extension.id === fact.channel.slice("extension:".length) &&
                extension.absorbs.some((candidate) => factId(candidate) === id),
            ),
          }
        : fact.channel.startsWith("refusal:")
          ? {
              disposition: "receipt" as const,
              landing: `receipts[${fact.channel.slice("refusal:".length)}]`,
              measured: envelope.receipts.some(
                (receipt) =>
                  factId(receipt.fact) === id &&
                  receipt.reason === "refused-by-recipe",
              ),
            }
          : baseMeasures[fact.channel];
    if (!measure) {
      failures.push(`${id}: no independent landing measurement`);
      continue;
    }
    rows.push({ fact: id, ...measure });
    if (!measure.measured)
      failures.push(
        `${id}: claimed ${measure.disposition} has no measured landing at ${measure.landing}`,
      );
    const declared = [
      envelope.accounting.carried.some(
        (candidate) => factId(candidate) === id,
      ) && "carried",
      envelope.extensions.some((extension) =>
        extension.absorbs.some((candidate) => factId(candidate) === id),
      ) && "extension",
      envelope.receipts.some((receipt) => factId(receipt.fact) === id) &&
        "receipt",
    ].filter(Boolean);
    if (declared.length !== 1 || declared[0] !== measure.disposition)
      failures.push(
        `${id}: declared ${declared.join("+") || "none"} disagrees with ${measure.disposition}`,
      );
  }
  const measuredLandings = rows.filter((row) => row.measured).length;
  if (rows.length === 0 || measuredLandings === 0)
    failures.push("combobox accounting denominator is zero");
  return {
    factsCompared: rows.length,
    measuredLandings,
    carried: rows.filter((row) => row.disposition === "carried").length,
    extensions: rows.filter((row) => row.disposition === "extension").length,
    receipts: rows.filter((row) => row.disposition === "receipt").length,
    rows,
    failures,
  };
}

export function auditTableAccounting(
  source: TableRecipeInstance,
  envelope: RecipeEnvelope,
): TableAccountingReport {
  const failures: string[] = [];
  const recovered = collapseTableRecipe(
    envelope,
    source.provenance.selection,
  );
  const rows: MeasuredFactLanding[] = [];
  const seen = new Set<string>();
  const baseMeasures: Record<string, Omit<MeasuredFactLanding, "fact">> = {
    structure: {
      disposition: "carried",
      landing: "table/set 2 variants + row-set 4 + cell-set 4",
      measured:
        envelope.ir.kind === "frame" &&
        envelope.ir.children.some(
          (node) =>
            node.kind === "component-set" &&
            node.role === "table/set" &&
            node.children.length === 2,
        ) &&
        envelope.ir.children.some(
          (node) =>
            node.kind === "component-set" &&
            node.role === "table/row-set" &&
            node.children.length === 4,
        ) &&
        envelope.ir.children.some(
          (node) =>
            node.kind === "component-set" &&
            node.role === "table/cell-set" &&
            node.children.length === 4,
        ),
    },
    columns: {
      disposition: "carried",
      landing: "declared three-column axis recovered from header instances",
      measured:
        canonicalJson(source.content.columns) ===
        canonicalJson(recovered.content.columns),
    },
    rows: {
      disposition: "carried",
      landing: "two body row instances with typed cell properties",
      measured:
        canonicalJson(source.content.rows) ===
        canonicalJson(recovered.content.rows),
    },
    tokens: {
      disposition: "carried",
      landing: "bound primitive IR fields",
      measured:
        canonicalJson(source.tokens) === canonicalJson(recovered.tokens),
    },
    "designer-edit-surface": {
      disposition: "carried",
      landing: "declared axes, column axis, row collection, and resize policy",
      measured:
        canonicalJson(source.designerEditSurface) ===
        canonicalJson(recovered.designerEditSurface),
    },
    "aria-model": {
      disposition: "extension",
      landing: "extensions[table/aria]",
      measured: extensionHas(envelope, "aria-model", "table/aria"),
    },
    events: {
      disposition: "extension",
      landing: "extensions[table/events]",
      measured: extensionHas(envelope, "events", "table/events"),
    },
    keyboard: {
      disposition: "extension",
      landing: "extensions[table/keyboard]",
      measured: extensionHas(envelope, "keyboard", "table/keyboard"),
    },
    "recipe-selection": {
      disposition: "extension",
      landing: "provenance.selection + extensions[table/recipe-selection]",
      measured:
        source.provenance.selection.manualCost.value > 0 &&
        extensionHas(envelope, "recipe-selection", "table/recipe-selection"),
    },
  };
  for (const fact of source.inputFacts) {
    const id = factId(fact);
    if (seen.has(id)) failures.push(`${id}: duplicated source occurrence`);
    seen.add(id);
    const measure = fact.channel.startsWith("parameter:")
      ? {
          disposition: "carried" as const,
          landing: fact.channel.slice("parameter:".length),
          measured:
            canonicalJson(
              atLanding(source, fact.channel.slice("parameter:".length)),
            ) ===
            canonicalJson(
              atLanding(recovered, fact.channel.slice("parameter:".length)),
            ),
        }
      : fact.channel.startsWith("extension:")
        ? {
            disposition: "extension" as const,
            landing: `extensions[${fact.channel.slice("extension:".length)}]`,
            measured: envelope.extensions.some(
              (extension) =>
                extension.id === fact.channel.slice("extension:".length) &&
                extension.absorbs.some((candidate) => factId(candidate) === id),
            ),
          }
        : fact.channel.startsWith("refusal:")
          ? {
              disposition: "receipt" as const,
              landing: `receipts[${fact.channel.slice("refusal:".length)}]`,
              measured: envelope.receipts.some(
                (receipt) =>
                  factId(receipt.fact) === id &&
                  receipt.reason === "refused-by-recipe",
              ),
            }
          : baseMeasures[fact.channel];
    if (!measure) {
      failures.push(`${id}: no independent landing measurement`);
      continue;
    }
    rows.push({ fact: id, ...measure });
    if (!measure.measured)
      failures.push(
        `${id}: claimed ${measure.disposition} has no measured landing at ${measure.landing}`,
      );
    const declared = [
      envelope.accounting.carried.some(
        (candidate) => factId(candidate) === id,
      ) && "carried",
      envelope.extensions.some((extension) =>
        extension.absorbs.some((candidate) => factId(candidate) === id),
      ) && "extension",
      envelope.receipts.some((receipt) => factId(receipt.fact) === id) &&
        "receipt",
    ].filter(Boolean);
    if (declared.length !== 1 || declared[0] !== measure.disposition)
      failures.push(
        `${id}: declared ${declared.join("+") || "none"} disagrees with ${measure.disposition}`,
      );
  }
  const measuredLandings = rows.filter((row) => row.measured).length;
  if (rows.length === 0 || measuredLandings === 0)
    failures.push("table accounting denominator is zero");
  return {
    factsCompared: rows.length,
    measuredLandings,
    carried: rows.filter((row) => row.disposition === "carried").length,
    extensions: rows.filter((row) => row.disposition === "extension").length,
    receipts: rows.filter((row) => row.disposition === "receipt").length,
    rows,
    failures,
  };
}
