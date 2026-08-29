import { ARCHETYPE_REQUIRED_FACTS } from "../packages/core/src/required-facts.js";
import type {
  ComponentNode,
  ComponentSetNode,
  FrameNode,
  IRNode,
  TextNode,
} from "./figma-ir.js";

export interface RecipeRequiredFactLanding {
  requiredFactId: string;
  status: "measured" | "missing";
  landing: string;
}

const mappings = [
  {
    id: "button/row-layout",
    landing: "every component variant layout.mode === horizontal",
    measure: (root: ComponentSetNode) =>
      root.children.every(
        (component) => component.layout.mode === "horizontal",
      ),
  },
  {
    id: "button/padding-inline",
    landing:
      "every component variant carries positive left/right padding and bindings",
    measure: (root: ComponentSetNode) =>
      root.children.every(
        (component) =>
          component.layout.padding.left > 0 &&
          component.layout.padding.right > 0 &&
          component.bindings?.some(
            (binding) => binding.field === "layout.padding.left",
          ) &&
          component.bindings.some(
            (binding) => binding.field === "layout.padding.right",
          ),
      ),
  },
  {
    id: "button/surface-ink",
    landing: "every component variant carries a fill and stroke paint",
    measure: (root: ComponentSetNode) =>
      root.children.every(
        (component) =>
          component.fills.length > 0 && (component.strokes?.length ?? 0) > 0,
      ),
  },
  {
    id: "button/radius",
    landing: "every component variant carries four bound corner radii",
    measure: (root: ComponentSetNode) =>
      root.children.every(
        (component) =>
          component.cornerRadius !== undefined &&
          (component.bindings?.filter((binding) =>
            binding.field.startsWith("cornerRadius."),
          ).length ?? 0) === 4,
      ),
  },
  {
    id: "button/type-fact",
    landing: "every label carries bound font-size and line-height facts",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const label = component.children.find(
          (child) => child.role === "button/label",
        );
        return (
          label?.kind === "text" &&
          label.bindings?.some(
            (binding) => binding.field === "type.fontSize",
          ) &&
          label.bindings.some(
            (binding) => binding.field === "type.lineHeight.value",
          )
        );
      }),
  },
] as const;

export const assertCompleteRequiredFactMapping = (
  archetype: string,
  seeded: Set<string>,
  mapped: readonly { id: string }[],
): void => {
  const mappedIds = new Set(mapped.map((mapping) => mapping.id));
  const missing = [...seeded].filter((id) => !mappedIds.has(id));
  const invented = [...mappedIds].filter((id) => !seeded.has(id));
  if (missing.length > 0 || invented.length > 0) {
    throw new Error(
      `${archetype} required-fact adapter is not total; unmapped=${missing.join(",") || "none"}; invented=${invented.join(",") || "none"}`,
    );
  }
};

export function measureButtonRequiredFacts(
  root: ComponentSetNode,
): RecipeRequiredFactLanding[] {
  const seeded = new Set(
    [
      ...ARCHETYPE_REQUIRED_FACTS.button.required,
      ...ARCHETYPE_REQUIRED_FACTS.button.expected,
    ].map((fact) => fact.id),
  );
  assertCompleteRequiredFactMapping("button@1", seeded, mappings);
  return mappings.map((mapping) => {
    if (!seeded.has(mapping.id)) {
      throw new Error(
        `button@1 required-fact seed ${mapping.id} no longer exists in packages/core/src/required-facts.ts`,
      );
    }
    return {
      requiredFactId: mapping.id,
      status: mapping.measure(root) ? "measured" : "missing",
      landing: mapping.landing,
    };
  });
}

const inputSurface = (component: ComponentNode): FrameNode | undefined => {
  const node = component.children.find(
    (child) => child.role === "input-field/surface",
  );
  return node?.kind === "frame" ? node : undefined;
};

const inputContent = (component: ComponentNode): TextNode | undefined => {
  const surface = inputSurface(component);
  const node = surface?.children.find(
    (child) =>
      child.role === "input-field/content/placeholder" ||
      child.role === "input-field/content/value",
  );
  return node?.kind === "text" ? node : undefined;
};

const inputMappings = [
  {
    id: "input/box-grammar",
    landing: "every input-field/surface carries a fill and inside stroke",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const surface = inputSurface(component);
        return (
          surface !== undefined &&
          surface.fills.length > 0 &&
          (surface.strokes?.length ?? 0) > 0
        );
      }),
  },
  {
    id: "input/padding-inline",
    landing:
      "every input-field/surface carries positive left/right auto-layout padding with bindings",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const surface = inputSurface(component);
        return (
          surface !== undefined &&
          surface.layout.padding.left > 0 &&
          surface.layout.padding.right > 0 &&
          surface.bindings?.some(
            (binding) => binding.field === "layout.padding.left",
          ) &&
          surface.bindings.some(
            (binding) => binding.field === "layout.padding.right",
          )
        );
      }),
  },
  {
    id: "input/type-fact",
    landing:
      "every visible placeholder/value node carries bound font-size and line-height",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const content = inputContent(component);
        return (
          content !== undefined &&
          content.bindings?.some(
            (binding) => binding.field === "type.fontSize",
          ) &&
          content.bindings.some(
            (binding) => binding.field === "type.lineHeight.value",
          )
        );
      }),
  },
  {
    id: "input/width-rule",
    landing:
      "every variant has fixed root width/minimum and a fill-container input surface",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const surface = inputSurface(component);
        return (
          component.layout.width.mode === "fixed" &&
          (component.layout.minWidth ?? 0) > 0 &&
          surface?.layout.width.mode === "fill"
        );
      }),
  },
  {
    id: "input/height",
    landing:
      "every input-field/surface has positive fixed height/minimum with a token binding",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        const surface = inputSurface(component);
        return (
          surface?.layout.height.mode === "fixed" &&
          surface.layout.height.value > 0 &&
          (surface.layout.minHeight ?? 0) > 0 &&
          surface.bindings?.some(
            (binding) => binding.field === "layout.height.value",
          )
        );
      }),
  },
] as const;

const inputRecipeMappings = [
  {
    id: "input/adornment-payload",
    landing:
      "every present adornment instance carries typed content, visual fields, accessibility semantics, and source provenance",
    measure: (root: ComponentSetNode) =>
      root.children.every((component) => {
        let valid = true;
        const visit = (node: IRNode): void => {
          if (
            node.kind === "instance" &&
            node.role?.startsWith("input-field/slot/")
          ) {
            valid =
              valid &&
              node.payload !== undefined &&
              node.payload.fills.length > 0 &&
              node.payload.intrinsicSize.width > 0 &&
              node.payload.intrinsicSize.height > 0 &&
              node.payload.source.length > 0 &&
              (node.payload.content.kind === "instance" ||
                node.payload.content.text.length > 0);
          }
          if (
            node.kind === "frame" ||
            node.kind === "component" ||
            node.kind === "component-set"
          ) {
            for (const child of node.children) visit(child);
          }
        };
        visit(component);
        return valid;
      }),
  },
  {
    id: "input/font-provenance",
    landing:
      "every Input text node carries requested/source/fallback/resolved font provenance",
    measure: (root: ComponentSetNode) => {
      let count = 0;
      let valid = true;
      const visit = (node: IRNode): void => {
        if (node.kind === "text") {
          count += 1;
          valid =
            valid &&
            node.type.fontProvenance !== undefined &&
            node.type.fontProvenance.requestSource.length > 0 &&
            node.type.fontProvenance.fallbackChain.length > 0;
        }
        if (
          node.kind === "frame" ||
          node.kind === "component" ||
          node.kind === "component-set"
        ) {
          for (const child of node.children) visit(child);
        }
      };
      visit(root);
      return count > 0 && valid;
    },
  },
] as const;

export function measureInputFieldRequiredFacts(
  root: ComponentSetNode,
): RecipeRequiredFactLanding[] {
  const seeded = new Set(
    [
      ...ARCHETYPE_REQUIRED_FACTS["input / field"].required,
      ...ARCHETYPE_REQUIRED_FACTS["input / field"].expected,
    ].map((fact) => fact.id),
  );
  assertCompleteRequiredFactMapping("input-field@1", seeded, inputMappings);
  return [...inputMappings, ...inputRecipeMappings].map((mapping) => {
    if (
      inputMappings.some((upstream) => upstream.id === mapping.id) &&
      !seeded.has(mapping.id)
    ) {
      throw new Error(
        `input-field@1 required-fact seed ${mapping.id} no longer exists in packages/core/src/required-facts.ts`,
      );
    }
    return {
      requiredFactId: mapping.id,
      status: mapping.measure(root) ? "measured" : "missing",
      landing: mapping.landing,
    };
  });
}

const comboboxSet = (root: FrameNode): ComponentSetNode | undefined => {
  const node = root.children.find((child) => child.role === "combobox/set");
  return node?.kind === "component-set" ? node : undefined;
};

const comboboxMappings = [
  {
    id: "select/box-grammar",
    landing: "every combobox/trigger carries a fill and stroke",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        const trigger = component.children.find(
          (child) => child.role === "combobox/trigger",
        );
        return (
          trigger?.kind === "frame" &&
          trigger.fills.length > 0 &&
          (trigger.strokes?.length ?? 0) > 0
        );
      }) === true,
  },
  {
    id: "select/padding-inline",
    landing:
      "every trigger carries positive bound left/right auto-layout padding",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        const trigger = component.children.find(
          (child) => child.role === "combobox/trigger",
        );
        return (
          trigger?.kind === "frame" &&
          trigger.layout.padding.left > 0 &&
          trigger.layout.padding.right > 0 &&
          trigger.bindings?.some(
            (binding) => binding.field === "layout.padding.left",
          ) &&
          trigger.bindings.some(
            (binding) => binding.field === "layout.padding.right",
          )
        );
      }) === true,
  },
  {
    id: "select/width-rule",
    landing:
      "every variant has fixed root width and a fill-width trigger/overlay",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        const trigger = component.children.find(
          (child) => child.role === "combobox/trigger",
        );
        const overlay = component.children.find(
          (child) => child.role === "combobox/overlay",
        );
        return (
          component.layout.width.mode === "fixed" &&
          trigger?.kind === "frame" &&
          trigger.layout.width.mode === "fill" &&
          (overlay === undefined ||
            (overlay.kind === "frame" && overlay.layout.width.mode === "fixed"))
        );
      }) === true,
  },
  {
    id: "select/chevron",
    landing: "every trigger carries a popup-indicator instance",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        let found = false;
        const visit = (node: IRNode): void => {
          if (
            node.kind === "instance" &&
            node.role === "combobox/control/popup"
          )
            found = true;
          if (
            node.kind === "frame" ||
            node.kind === "component" ||
            node.kind === "component-set"
          )
            for (const child of node.children) visit(child);
        };
        visit(component);
        return found;
      }) === true,
  },
  {
    id: "select/height",
    landing: "every trigger has positive fixed height and binding",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        const trigger = component.children.find(
          (child) => child.role === "combobox/trigger",
        );
        return (
          trigger?.kind === "frame" &&
          trigger.layout.height.mode === "fixed" &&
          trigger.layout.height.value > 0 &&
          trigger.bindings?.some(
            (binding) => binding.field === "layout.height.value",
          )
        );
      }) === true,
  },
] as const;

const comboboxRecipeMappings = [
  {
    id: "select/detached-listbox",
    landing:
      "every open variant has one explicitly anchored absolute overlay/listbox",
    measure: (root: FrameNode) =>
      comboboxSet(root)?.children.every((component) => {
        const open = component.variantProperties.Open === "true";
        const overlay = component.children.find(
          (child) => child.role === "combobox/overlay",
        );
        return open
          ? overlay?.kind === "frame" &&
              overlay.layout.positioning === "absolute" &&
              overlay.layout.offset !== undefined &&
              overlay.children.some(
                (child) => child.role === "combobox/listbox",
              )
          : overlay === undefined;
      }) === true,
  },
  {
    id: "select/option-instance-repetition",
    landing: "open options cells repeat four instances of combobox@1/option",
    measure: (root: FrameNode) => {
      const set = comboboxSet(root);
      if (!set) return false;
      const cells = set.children.filter(
        (component) =>
          component.variantProperties.Open === "true" &&
          component.variantProperties.Content === "options" &&
          component.variantProperties["Field state"] !== "loading",
      );
      return (
        cells.length > 0 &&
        cells.every((component) => {
          let count = 0;
          const visit = (node: IRNode): void => {
            if (
              node.kind === "instance" &&
              node.componentRef === "combobox@1/option"
            )
              count += 1;
            if (
              node.kind === "frame" ||
              node.kind === "component" ||
              node.kind === "component-set"
            )
              for (const child of node.children) visit(child);
          };
          visit(component);
          return count === 4;
        })
      );
    },
  },
] as const;

export function measureComboboxRequiredFacts(
  root: FrameNode,
): RecipeRequiredFactLanding[] {
  const seeded = new Set(
    [
      ...ARCHETYPE_REQUIRED_FACTS["select / combobox"].required,
      ...ARCHETYPE_REQUIRED_FACTS["select / combobox"].expected,
    ].map((fact) => fact.id),
  );
  assertCompleteRequiredFactMapping("combobox@1", seeded, comboboxMappings);
  return [...comboboxMappings, ...comboboxRecipeMappings].map((mapping) => ({
    requiredFactId: mapping.id,
    status: mapping.measure(root) ? "measured" : "missing",
    landing: mapping.landing,
  }));
}

const tableSet = (root: FrameNode): ComponentSetNode | undefined => {
  const node = root.children.find((child) => child.role === "table/set");
  return node?.kind === "component-set" ? node : undefined;
};
const tableRowSet = (root: FrameNode): ComponentSetNode | undefined => {
  const node = root.children.find((child) => child.role === "table/row-set");
  return node?.kind === "component-set" ? node : undefined;
};
const tableCellSet = (root: FrameNode): ComponentSetNode | undefined => {
  const node = root.children.find((child) => child.role === "table/cell-set");
  return node?.kind === "component-set" ? node : undefined;
};

const tableMappings = [
  {
    id: "table/column-stack",
    landing: "every table variant is a vertical header-plus-body stack",
    measure: (root: FrameNode) =>
      tableSet(root)?.children.every(
        (component) =>
          component.layout.mode === "vertical" &&
          component.children.some((child) => child.role === "table/body"),
      ) === true,
  },
  {
    id: "table/cell-padding",
    landing:
      "every table/cell carries positive bound padding on all four sides",
    measure: (root: FrameNode) =>
      tableCellSet(root)?.children.every(
        (component) =>
          component.layout.padding.left > 0 &&
          component.layout.padding.right > 0 &&
          component.layout.padding.top > 0 &&
          component.layout.padding.bottom > 0 &&
          component.bindings?.some(
            (binding) => binding.field === "layout.padding.left",
          ) &&
          component.bindings.some(
            (binding) => binding.field === "layout.padding.right",
          ),
      ) === true,
  },
  {
    id: "table/row-rule",
    landing:
      "the table frame or every cell carries a named top/bottom stroke",
    measure: (root: FrameNode) => {
      const frameRule =
        tableSet(root)?.children.some(
          (component) => (component.strokes?.[0]?.weight ?? 0) > 0,
        ) === true;
      const cellRule =
        tableCellSet(root)?.children.some(
          (component) => (component.strokes?.[0]?.weight ?? 0) > 0,
        ) === true;
      return frameRule || cellRule;
    },
  },
  {
    id: "table/header-type",
    landing: "every header cell label uses a non-Regular font style",
    measure: (root: FrameNode) =>
      tableCellSet(root)?.children
        .filter((component) => component.variantProperties.Kind === "header")
        .every((component) => {
          const label = component.children.find(
            (child) => child.role === "table/cell/label",
          );
          return (
            label?.kind === "text" &&
            label.type.fontStyle !== "Regular" &&
            label.type.fontProvenance !== undefined
          );
        }) === true,
  },
] as const;

const tableRecipeMappings = [
  {
    id: "table/cell-instance-repetition",
    landing: "every row template instantiates three table@1/cell instances",
    measure: (root: FrameNode) =>
      tableRowSet(root)?.children.every((component) => {
        const cells = component.children.filter(
          (child) =>
            child.kind === "instance" && child.componentRef === "table@1/cell",
        );
        return cells.length === 3;
      }) === true,
  },
] as const;

export function measureTableRequiredFacts(
  root: FrameNode,
): RecipeRequiredFactLanding[] {
  const seeded = new Set(
    [
      ...ARCHETYPE_REQUIRED_FACTS["table / data-grid"].required,
      ...ARCHETYPE_REQUIRED_FACTS["table / data-grid"].expected,
    ].map((fact) => fact.id),
  );
  assertCompleteRequiredFactMapping("table@1", seeded, tableMappings);
  return [...tableMappings, ...tableRecipeMappings].map((mapping) => ({
    requiredFactId: mapping.id,
    status: mapping.measure(root) ? "measured" : "missing",
    landing: mapping.landing,
  }));
}
