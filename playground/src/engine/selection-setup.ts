import {
  ContractSchema,
  isSupportedOmittedCodeBinding,
  walkAnatomy,
  type Contract,
  type Part,
} from "../../../scripts/contract-schema.js";
import { selectionErrors } from "../../../packages/core/src/selection.js";
import { contractApiNames } from "../../../packages/core/src/prop-collision.js";

export interface SelectionSetup {
  itemPart: string;
  keyField: string;
  listLabel: string;
  valueProp: string;
  valueCode: string;
  initialCode: string;
  callbackCode: string;
  selectedProp: string;
  selectedOn: string;
  selectedOff: string;
  disabledField?: string;
  panelContainer: string;
  initialKey: string;
  orientation: "horizontal" | "vertical";
  direction: "ltr" | "rtl";
  activation: "automatic" | "manual";
  items: Array<{
    key: string;
    panel:
      | { kind: "existing"; part: string }
      | { kind: "slot"; part: string; slot: string };
    focusable: boolean;
  }>;
}
export function selectionSetupParts(contract: Contract) {
  return walkAnatomy(contract);
}
const own = (object: object, key: string) => Object.hasOwn(object, key);
const safeName = (value: string) =>
  isSupportedOmittedCodeBinding(value) &&
  !["constructor", "prototype"].includes(value);
function fail(message: string): never {
  throw Error(message);
}

/** Author a reviewed relationship on a clone. No identity, behavior or missing
 * panel content is inferred from labels, names or the current active paint. */
export function prepareSelectionSetup(
  source: Contract,
  scope: Map<string, Contract>,
  input: SelectionSetup,
): { contract: Contract; changes: string[] } {
  if (source.selection)
    fail(
      "Selection is already configured. Edit the existing relationship in the contract.",
    );
  const next = structuredClone(source),
    rows = walkAnatomy(next);
  const row = (name: string) => {
    const found = rows.filter((r) => r.name === name);
    if (found.length !== 1)
      fail(`Choose one existing part: ${name || "(none)"}.`);
    return found[0];
  };
  const item = row(input.itemPart),
    repeat = item.part.repeat;
  if (!repeat || !item.part.component || item.path.length < 2)
    fail("Choose an existing repeated component.");
  const list = row(item.path.at(-2)!);
  const records = next.props.find((p) => p.name === repeat.itemsProp);
  if (
    !records ||
    typeof records.type !== "object" ||
    !("arrayOf" in records.type)
  )
    fail("The repeat must use a declared collection.");
  const fields = records.type.arrayOf;
  if (
    !safeName(input.keyField) ||
    input.keyField === input.selectedProp ||
    input.keyField === input.disabledField
  )
    fail("Choose a separate camelCase identity field.");
  if (
    repeat.keyField
      ? input.keyField !== repeat.keyField
      : own(fields, input.keyField)
  )
    fail("An existing record field cannot be replaced with new identities.");
  if (input.items.length !== repeat.sample.length || !input.items.length)
    fail("Map every observed item exactly once.");
  const keys = input.items.map((item) => item.key);
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !key.trim() ||
        ["__proto__", "constructor", "prototype"].includes(key),
    ) ||
    new Set(keys).size !== keys.length
  )
    fail("Every item needs a distinct, nonempty stable key.");
  if (!keys.includes(input.initialKey))
    fail("Choose the initially selected item.");
  if (
    repeat.keyField &&
    repeat.sample.some(
      (record, index) => record[repeat.keyField!] !== keys[index],
    )
  )
    fail("Existing item identities must stay unchanged.");
  if (
    !safeName(input.valueProp) ||
    !safeName(input.valueCode) ||
    !safeName(input.initialCode)
  )
    fail(
      "Selection property and React input names must be distinct camelCase identifiers.",
    );
  if (next.props.some((p) => p.name === input.valueProp))
    fail(
      "The selection property must be new; existing properties are preserved.",
    );
  const apiNames = new Set(contractApiNames(next)),
    newNames = [input.valueCode, input.initialCode, input.callbackCode];
  if (
    new Set(newNames).size !== newNames.length ||
    newNames.some((name) => apiNames.has(name))
  )
    fail("New React input and callback names must be distinct and unused.");
  newNames.forEach((name) => apiNames.add(name));
  if (!input.listLabel.trim()) fail("Give the item list an accessible label.");
  if (list.part.attrs?.["aria-labelledby"])
    fail(
      "This list already uses an external accessible label. Preserve it by editing the relationship in the contract.",
    );
  if (own(item.part.component.props ?? {}, input.selectedProp))
    fail(
      "Selected appearance is fixed on the child reference. Resolve that competing input first.",
    );
  const dep = scope.get(item.part.component.id),
    selected = dep?.props.find((p) => p.name === input.selectedProp);
  if (
    !selected ||
    typeof selected.type !== "object" ||
    !("enum" in selected.type) ||
    !selected.type.enum.includes(input.selectedOn) ||
    !selected.type.enum.includes(input.selectedOff) ||
    input.selectedOn === input.selectedOff
  )
    fail("Map selected and unselected appearance to distinct child variants.");
  if (
    repeat.sample.some(
      (record) =>
        own(record, input.selectedProp) &&
        ![input.selectedOn, input.selectedOff].includes(
          String(record[input.selectedProp]),
        ),
    )
  )
    fail(
      "An observed appearance uses another state. Resolve it before assigning selection control.",
    );
  const container = row(input.panelContainer).part;
  if (
    container.component ||
    container.repeat ||
    container.slot ||
    container.content ||
    container.text !== undefined ||
    container.icon ||
    container.shape ||
    container.meter
  )
    fail("Choose an ordinary container for the panels.");
  const partNames = new Set(rows.map((r) => r.name)),
    panels: NonNullable<Contract["selection"]>["panels"] = [];
  const changes = [
    `Store stable identities in ${input.keyField}: ${keys.join(", ")}.`,
    `Label the item list “${input.listLabel.trim()}”.`,
    `Add ${input.valueCode}, ${input.initialCode} and ${input.callbackCode} to the React API.`,
    `Selection controls ${input.selectedProp}: ${input.selectedOn} for the selected item, ${input.selectedOff} otherwise.`,
    ...(input.disabledField
      ? [
          `Use ${input.disabledField} to exclude disabled items from navigation.`,
        ]
      : []),
    `Start with ${input.initialKey}; ${input.activation} activation, ${input.orientation} navigation, ${input.direction}.`,
  ];
  for (const [index, mapping] of input.items.entries()) {
    let panel: Part;
    if (mapping.panel.kind === "existing") {
      const existing = row(mapping.panel.part);
      if (
        existing.path.slice(0, -1).join("/") !==
        row(input.panelContainer).path.join("/")
      )
        fail(
          "Existing panels must be direct children of the chosen panel container.",
        );
      if (existing.part.visibleWhen)
        fail(
          "An existing panel has a visibility rule. Preserve or resolve it before configuring selection.",
        );
      panel = existing.part;
      changes.push(
        `Item ${index + 1} → ${mapping.key}: retain the existing ${mapping.panel.part} content.`,
      );
    } else {
      if (
        !safeName(mapping.panel.part) ||
        !safeName(mapping.panel.slot) ||
        partNames.has(mapping.panel.part)
      )
        fail(
          "New panels need unused camelCase part names and valid content-slot names.",
        );
      if (apiNames.has(mapping.panel.slot))
        fail("Each new content slot needs a distinct, unused React name.");
      apiNames.add(mapping.panel.slot);
      partNames.add(mapping.panel.part);
      panel = { element: "div", slot: { name: mapping.panel.slot } };
      (container.parts ??= {})[mapping.panel.part] = panel;
      changes.push(
        `Item ${index + 1} → ${mapping.key}: add empty ${mapping.panel.slot} content supplied by the consuming app; no content is captured or invented.`,
      );
    }
    panel.visibleWhen = { prop: input.valueProp, equals: mapping.key };
    panels.push({
      value: mapping.key,
      part: mapping.panel.part,
      focusable: mapping.focusable,
    });
    changes.push(
      `${mapping.panel.part} ${mapping.focusable ? "can" : "cannot"} receive keyboard focus.`,
    );
  }
  if (own(fields, input.selectedProp)) {
    delete fields[input.selectedProp];
    for (const record of repeat.sample) delete record[input.selectedProp];
    changes.push(
      `${input.selectedProp} becomes selection-controlled; remove its per-item appearance flags.`,
    );
  }
  fields[input.keyField] = "text";
  repeat.keyField = input.keyField;
  repeat.sample.forEach((record, index) => {
    record[input.keyField] = keys[index];
  });
  list.part.attrs = {
    ...list.part.attrs,
    "aria-label": input.listLabel.trim(),
  };
  next.props.push({
    name: input.valueProp,
    type: { enum: keys },
    default: input.initialKey,
    bindings: {
      code: { prop: input.valueCode, initial: { prop: input.initialCode } },
      figma: {
        kind: "VARIANT",
        property: input.valueProp,
        values: Object.fromEntries(keys.map((key) => [key, key])),
      },
    },
  });
  next.selection = {
    pattern: "tabs",
    valueProp: input.valueProp,
    listPart: list.name,
    itemPart: item.name,
    selected: {
      prop: input.selectedProp,
      on: input.selectedOn,
      off: input.selectedOff,
    },
    ...(input.disabledField ? { disabledField: input.disabledField } : {}),
    panels,
    orientation: input.orientation,
    direction: input.direction,
    activation: input.activation,
    bindings: { code: { prop: input.callbackCode } },
  };
  const parsed = ContractSchema.safeParse(next);
  if (!parsed.success)
    fail(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  const contracts = new Map(scope);
  contracts.set(next.id, parsed.data);
  const errors = selectionErrors(parsed.data, contracts);
  if (errors.length) fail(errors.join("\n"));
  return { contract: parsed.data, changes };
}
