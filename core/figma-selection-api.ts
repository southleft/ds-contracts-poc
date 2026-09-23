/** Retained, non-executable selection semantics. Native nodes corroborate the
 * relationship; they do not demonstrate React interaction. No source anatomy,
 * paint, item text or panel content is retained in this envelope. */
import {
  ContractSchema,
  PropSchema,
  SelectionSchema,
  slotFigmaProperty,
  walkAnatomy,
  type Contract,
  type Part,
} from "../scripts/contract-schema.js";
import { selectionErrors } from "../packages/core/src/selection.js";
import { canonicalJson } from "./contract-provenance.js";
import type { DumpNode, DumpSet } from "../extract/figma/types.js";

type Selection = NonNullable<Contract["selection"]>;
export type SelectionIdentity =
  | { version: 1; role: "list" }
  | { version: 1; role: "item"; key: string }
  | { version: 1; role: "panel"; value: string };
export interface FigmaSelectionApi {
  version: 1;
  selection: Selection;
  value: Contract["props"][number];
  items: Contract["props"][number];
  keyField: string;
  itemComponentId: string;
  keys: string[];
  listLabel: string;
  panelSlots: Array<{ part: string; name: string; property: string }>;
  unsupported?: string;
}
const fail = (why: string): never => {
  throw Error("FIGMA_SELECTION_METADATA_INVALID:" + why);
};
const projectionFail = (why: string): never => {
  throw Error("FIGMA_SELECTION_PROJECTION_UNSUPPORTED:" + why);
};
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const exact = (x: Record<string, unknown>, keys: string[]) =>
  same(Object.keys(x).sort(), [...keys].sort());
const listName = "dscSelectionList";
const itemName = (i: number) => `dscSelectionItem${i}`;
const panelName = (i: number) => `dscSelectionPanel${i}`;
const reserved = (name: string) =>
  /^dscSelection(?:List|Item\d+|Panel\d+)$/.test(name);

export function figmaSelectionApi(c: Contract): FigmaSelectionApi | undefined {
  const s = c.selection;
  if (!s) return;
  const rows = walkAnatomy(c),
    item = rows.find((r) => r.name === s.itemPart)!.part,
    list = rows.find((r) => r.name === s.listPart)!.part;
  const panelSlots = s.panels.flatMap((p) => {
    const slot = rows.find((r) => r.name === p.part)!.part.slot;
    return slot
      ? [{ part: p.part, name: slot.name, property: slotFigmaProperty(slot) }]
      : [];
  });
  const unsupported =
    c.props.length !== 2 ||
    c.states.length ||
    c.events?.length ||
    c.bindings.figma.statePreviews ||
    c.bindings.figma.absentVariants?.length ||
    c.semantics.element !== "div" ||
    c.semantics.role ||
    c.semantics.roleByProp ||
    !list.attrs?.["aria-label"] ||
    Object.keys(list.attrs ?? {}).some(
      (k) => k !== "aria-label" && k !== "role",
    ) ||
    s.panels.some((p) => {
      const slot = rows.find((r) => r.name === p.part)!.part.slot;
      return (
        slot &&
        (Object.keys(slot).some((k) => !["name", "bindings"].includes(k)) ||
          Object.keys(slot.bindings?.figma ?? {}).some((k) => k !== "property"))
      );
    });
  return {
    version: 1,
    selection: structuredClone(s),
    value: structuredClone(c.props.find((p) => p.name === s.valueProp)!),
    items: structuredClone(
      c.props.find((p) => p.name === item.repeat!.itemsProp)!,
    ),
    keyField: item.repeat!.keyField!,
    itemComponentId: item.component!.id,
    keys: item
      .repeat!.sample.map((r) => String(r[item.repeat!.keyField!]))
      .sort(),
    listLabel: list.attrs?.["aria-label"] ?? "",
    panelSlots,
    ...(unsupported
      ? {
          unsupported:
            "only one finite selection, a literal list label, two inputs, and unconstrained panel slots can return",
        }
      : {}),
  };
}

function parse(raw: unknown): FigmaSelectionApi {
  if (
    !record(raw) ||
    !exact(raw, [
      "version",
      "selection",
      "value",
      "items",
      "keyField",
      "itemComponentId",
      "keys",
      "listLabel",
      "panelSlots",
      ...(Object.hasOwn(raw, "unsupported") ? ["unsupported"] : []),
    ]) ||
    raw.version !== 1
  )
    return fail("unsupported envelope");
  if (raw.unsupported !== undefined)
    return projectionFail(String(raw.unsupported));
  const s = SelectionSchema.safeParse(raw.selection),
    value = PropSchema.safeParse(raw.value),
    items = PropSchema.safeParse(raw.items);
  if (
    !s.success ||
    !value.success ||
    !items.success ||
    !same(s.data, raw.selection) ||
    !same(value.data, raw.value) ||
    !same(items.data, raw.items)
  )
    return fail("invalid API fragment");
  if (
    typeof raw.keyField !== "string" ||
    typeof raw.itemComponentId !== "string" ||
    typeof raw.listLabel !== "string" ||
    !raw.listLabel.trim() ||
    !Array.isArray(raw.keys) ||
    !raw.keys.length ||
    raw.keys.some((k) => typeof k !== "string" || !k) ||
    new Set(raw.keys).size !== raw.keys.length ||
    !Array.isArray(raw.panelSlots) ||
    raw.panelSlots.some(
      (p) =>
        !record(p) ||
        !exact(p, ["part", "name", "property"]) ||
        ["part", "name", "property"].some(
          (k) => typeof p[k] !== "string" || !p[k],
        ),
    )
  )
    return fail("invalid relationship identity");
  const v = value.data,
    a = items.data;
  if (
    typeof v.type !== "object" ||
    !("enum" in v.type) ||
    v.bindings.figma.kind !== "VARIANT" ||
    !v.bindings.figma.property ||
    v.required ||
    v.bindings.code.values ||
    v.name !== s.data.valueProp ||
    !v.type.enum.includes(v.default as string) ||
    !same([...v.type.enum].sort(), [...raw.keys].sort()) ||
    typeof a.type !== "object" ||
    !("arrayOf" in a.type) ||
    a.type.arrayOf[raw.keyField] !== "text" ||
    a.bindings.figma.kind !== "NONE" ||
    a.default !== undefined ||
    a.required ||
    new Set(s.data.panels.map((p) => p.part)).size !== s.data.panels.length ||
    !same(s.data.panels.map((p) => p.value).sort(), [...raw.keys].sort()) ||
    new Set(raw.panelSlots.map((p) => (p as any).part)).size !==
      raw.panelSlots.length ||
    raw.panelSlots.some(
      (p) => !s.data.panels.some((q) => q.part === (p as any).part),
    )
  )
    return fail("incomplete finite relationship");
  return raw as unknown as FigmaSelectionApi;
}
function identity(raw: unknown): SelectionIdentity {
  if (
    !record(raw) ||
    raw.version !== 1 ||
    !["list", "item", "panel"].includes(String(raw.role)) ||
    !exact(raw, [
      "version",
      "role",
      ...(raw.role === "item"
        ? ["key"]
        : raw.role === "panel"
          ? ["value"]
          : []),
    ]) ||
    (raw.role === "item" && typeof raw.key !== "string") ||
    (raw.role === "panel" && typeof raw.value !== "string")
  )
    return fail("invalid node identity");
  return raw as SelectionIdentity;
}
const walk = (
  node: DumpNode,
  fn: (node: DumpNode, parent?: DumpNode, path?: string[]) => void,
  parent?: DumpNode,
  path: string[] = [],
) => {
  fn(node, parent, path);
  for (const child of node.children ?? [])
    walk(child, fn, node, [...path, node.name]);
};
export interface SelectionRead {
  api: FigmaSelectionApi;
  normalized: DumpSet;
  order: string[];
  itemMainKey: string;
  itemContractIds: Array<string | undefined>;
}
/** Validate the original capture before giving uniquely named identities to the
 * ordinary inverse. Slot property keys stay original; only private layer names
 * normalize. The restored slot binding uses the corroborated original key. */
export function readFigmaSelectionApi(set: DumpSet): SelectionRead | undefined {
  if (set.selectionApi === undefined) {
    for (const variant of set.variants)
      walk(variant, (n) => {
        if (n.selectionIdentity !== undefined) fail("orphan node identity");
      });
    return;
  }
  const api = parse(set.selectionApi),
    s = api.selection,
    value = api.value,
    property = value.bindings.figma.property!;
  if (!same(set.semantics, { element: "div" }))
    return fail("root semantics changed");
  const labels = (value.type as { enum: string[] }).enum.map(
    (v) => value.bindings.figma.values?.[v] ?? v,
  );
  const def = set.propertyDefinitions?.[property];
  if (
    new Set(labels).size !== labels.length ||
    labels.some((v) => !v.trim() || v.trim() !== v || /[,=\r\n]/.test(v)) ||
    set.propNames?.[property] !== value.name ||
    def?.type !== "VARIANT" ||
    def.defaultValue !==
      (value.bindings.figma.values?.[String(value.default)] ?? value.default) ||
    !same([...(def.variantOptions ?? [])].sort(), [...labels].sort()) ||
    Object.values(set.propertyDefinitions ?? {}).filter(
      (p) => p.type === "VARIANT",
    ).length !== 1 ||
    set.variants.length !== labels.length
  )
    return fail("native domain changed");
  const normalized = structuredClone(set),
    seen = new Set<string>();
  let order: string[] | undefined, itemMainKey: string | undefined;
  const itemContractIds: Array<string | undefined> = [];
  for (const variant of normalized.variants) {
    const label = variant.variantProperties?.[property],
      active = (value.type as { enum: string[] }).enum.find(
        (k) => (value.bindings.figma.values?.[k] ?? k) === label,
      );
    if (
      !active ||
      seen.has(active) ||
      !same(variant.variantProperties, { [property]: label }) ||
      variant.name !== `${property}=${label}`
    )
      return fail("missing or duplicate native variant");
    seen.add(active);
    let list: DumpNode | undefined;
    const foundItems: Array<{
        node: DumpNode;
        parent?: DumpNode;
        key: string;
      }> = [],
      panels: Array<{ node: DumpNode; value: string }> = [];
    const parents = new Map<DumpNode, DumpNode | undefined>();
    walk(variant, (node, parent) => {
      parents.set(node, parent);
      if (node.selectionIdentity === undefined) {
        if (reserved(node.name)) fail("reserved layer name collision");
        return;
      }
      const id = identity(node.selectionIdentity);
      for (
        let ancestor: DumpNode | undefined = node;
        ancestor;
        ancestor = parents.get(ancestor)
      )
        if (ancestor.hidden) fail("hidden relationship node or ancestor");
      if (id.role === "list") {
        if (list || node.type !== "FRAME") fail("missing or duplicate list");
        list = node;
        node.name = listName;
      }
      if (id.role === "item") {
        if (node.type !== "INSTANCE" || !api.keys.includes(id.key))
          fail("item identity changed");
        const key = node.instanceSetKey ?? node.instanceKey;
        if (
          typeof key !== "string" ||
          !key ||
          (itemMainKey !== undefined && itemMainKey !== key)
        )
          fail("item main identity changed");
        itemMainKey = key;
        itemContractIds.push(node.instanceContractId);
        foundItems.push({ node, parent, key: id.key });
        node.name = itemName(api.keys.indexOf(id.key));
      }
      if (id.role === "panel") {
        const index = s.panels.findIndex((p) => p.value === id.value);
        if (
          index < 0 ||
          id.value !== active ||
          !["FRAME", "INSTANCE", "SLOT"].includes(node.type)
        )
          fail("panel relationship changed");
        const slot = api.panelSlots.find(
          (p) => p.part === s.panels[index].part,
        );
        if (slot) {
          if (
            node.type !== "SLOT" ||
            !node.slotKey ||
            node.slotKey.split("#")[0] !== slot.property ||
            node.name !== slot.property ||
            set.propertyDefinitions?.[node.slotKey]?.type !== "SLOT"
          )
            fail("slot identity changed");
        } else if (node.type === "SLOT") fail("unrepresented panel slot");
        panels.push({ node, value: id.value });
        node.name = panelName(index);
      }
    });
    if (
      !list ||
      foundItems.length !== api.keys.length ||
      new Set(foundItems.map((i) => i.key)).size !== api.keys.length ||
      foundItems.some((i) => i.parent !== list) ||
      list.children?.length !== foundItems.length ||
      panels.length !== 1
    )
      return fail("incomplete native relationship");
    if (
      panels.some(
        (p) => list === p.node || foundItems.some((i) => i.node === p.node),
      )
    )
      return fail("overlapping relationship");
    // Every state must draw the same ordered records. Uniform designer reorder
    // is retained; a state-specific reorder cannot become one React collection.
    const current = foundItems.map((i) => i.key);
    if (order && !same(order, current))
      return fail("variant-dependent item order");
    order = current;
  }
  return {
    api,
    normalized,
    order: order!,
    itemMainKey: itemMainKey!,
    itemContractIds,
  };
}

/** Fold only the ordinary inverse's corroborated item instances. All styles,
 * component inputs and panel content come from that inverse, never the source. */
export function restoreFigmaSelectionApi(
  contract: Record<string, unknown>,
  read: SelectionRead,
  dependencies?: ReadonlyMap<string, unknown>,
): void {
  const { api, order } = read,
    s = api.selection;
  const c = contract as unknown as Contract;
  const byId = new Map<string, Contract>();
  for (const [id, raw] of dependencies ?? []) {
    const p = ContractSchema.safeParse(raw);
    if (p.success) byId.set(id, p.data);
  }
  const child = byId.get(api.itemComponentId);
  if (!child) return projectionFail("full item dependency required");
  const anchor = child.bindings.figma.anchors.componentSetKey;
  if (
    (anchor && anchor !== read.itemMainKey) ||
    read.itemContractIds.some((id) => id !== undefined && id !== child.id) ||
    (!anchor && read.itemContractIds.some((id) => id !== child.id))
  )
    return projectionFail("actual native item dependency is not corroborated");
  const rows = walkAnatomy(c),
    find = (name: string) => {
      const all = rows.filter((r) => r.name === name);
      if (all.length !== 1)
        return projectionFail("ambiguous projected part " + name);
      return all[0];
    };
  const list = find(listName),
    props = c.props,
    projectedValue = props.find((p) => p.name === api.value.name);
  if (
    props.length !== 1 ||
    !projectedValue ||
    !same(projectedValue.type, api.value.type) ||
    projectedValue.default !== api.value.default ||
    projectedValue.bindings.figma.property !== api.value.bindings.figma.property
  )
    return projectionFail("projected domain changed");
  const sample: Array<Record<string, string | number | boolean>> = [],
    shapes: Part[] = [];
  const fields = (api.items.type as { arrayOf: Record<string, unknown> })
    .arrayOf;
  for (const key of order) {
    const row = find(itemName(api.keys.indexOf(key))),
      part = structuredClone(row.part),
      ref = part.component;
    if (
      !ref ||
      ref.id !== api.itemComponentId ||
      row.path.slice(0, -1).join("/") !== list.path.join("/")
    )
      return projectionFail("item dependency or containment changed");
    if (
      Object.keys(part).some((k) => k !== "component") ||
      Object.keys(ref).some((k) => !["id", "props"].includes(k))
    )
      return projectionFail(
        "item overrides require an explicit repeated representation",
      );
    const inputs = { ...(ref.props ?? {}) },
      selected = inputs[s.selected.prop];
    const expected = {
      prop: api.value.name,
      map: Object.fromEntries(
        api.keys.map((v) => [v, v === key ? s.selected.on : s.selected.off]),
      ),
    };
    // A singleton domain may collapse the mapping to its only scalar.
    if (
      !same(selected, expected) &&
      !(api.keys.length === 1 && selected === s.selected.on)
    )
      return projectionFail("selected appearance changed");
    delete inputs[s.selected.prop];
    const rec: Record<string, string | number | boolean> = {
      [api.keyField]: key,
    };
    for (const field of Object.keys(fields)) {
      if (field === api.keyField) continue;
      const v = inputs[field];
      if (!["string", "number", "boolean"].includes(typeof v))
        return projectionFail(
          "missing or state-dependent record field " + field,
        );
      rec[field] = v as string | number | boolean;
      delete inputs[field];
    }
    if (s.disabledField && rec[s.disabledField] !== false)
      return projectionFail("undrawn disabled panel");
    for (const p of child.props)
      if (Object.hasOwn(inputs, p.name) && inputs[p.name] === p.default)
        delete inputs[p.name];
    ref.props = inputs;
    if (!Object.keys(inputs).length) delete ref.props;
    shapes.push(part);
    sample.push(rec);
  }
  if (shapes.some((p) => !same(p, shapes[0])))
    return projectionFail("items differ outside their record inputs");
  if (Object.keys(list.part.parts ?? {}).length !== order.length)
    return projectionFail("unrepresented list content");
  const desiredNames = [s.listPart, s.itemPart, ...s.panels.map((p) => p.part)];
  if (
    new Set(desiredNames).size !== desiredNames.length ||
    rows.some((r) => desiredNames.includes(r.name) && !reserved(r.name))
  )
    return projectionFail("retained part name collision");
  // Rename parts in place without discarding sibling content or observed style.
  const rename = (from: string, to: string) => {
    const row = find(from);
    let parts = c.anatomy;
    for (const segment of row.path.slice(0, -1)) parts = parts[segment].parts!;
    const out = Object.fromEntries(
      Object.entries(parts).map(([k, v]) => [k === from ? to : k, v]),
    );
    for (const k of Object.keys(parts)) delete parts[k];
    Object.assign(parts, out);
  };
  for (let i = 0; i < s.panels.length; i++) {
    const row = find(panelName(i));
    if (
      !same(row.part.visibleWhen, {
        prop: api.value.name,
        equals: s.panels[i].value,
      }) &&
      api.keys.length !== 1
    )
      return projectionFail("panel visibility changed");
    row.part.visibleWhen = { prop: api.value.name, equals: s.panels[i].value };
    const slot = api.panelSlots.find((p) => p.part === s.panels[i].part);
    if (slot) {
      if (!row.part.slot) return projectionFail("slot was not reconstructed");
      row.part.slot.name = slot.name;
      row.part.slot.bindings = { figma: { property: slot.property } };
    }
    rename(panelName(i), s.panels[i].part);
  }
  const item = shapes[0];
  item.repeat = { itemsProp: api.items.name, keyField: api.keyField, sample };
  list.part.parts = { [s.itemPart]: item };
  list.part.attrs = { ...(list.part.attrs ?? {}), "aria-label": api.listLabel };
  rename(listName, s.listPart);
  c.props = [structuredClone(api.items), structuredClone(api.value)];
  c.selection = structuredClone(s);
  const parsed = ContractSchema.safeParse(c);
  if (!parsed.success) return projectionFail(parsed.error.message);
  const errors = selectionErrors(parsed.data, byId);
  if (errors.length) return projectionFail(errors.join("; "));
}
