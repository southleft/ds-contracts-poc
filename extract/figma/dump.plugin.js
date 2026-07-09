// Design-side ANATOMY dump — the canonical node-tree capture (dump v1).
//
// Transport-agnostic Plugin API script (same boundary as extract/figma-dump.js
// and parity/extract-figma.plugin.js): run it through any console/plugin-runner
// bridge that executes Plugin API code in the open file, then save the returned
// JSON and feed it to `npm run extract:figma -- <dump.json>`.
//
// Where extract/figma-dump.js reads only the API surface, this script reads the
// DRAWN STRUCTURE — the facts propose.ts inverts into a contract's anatomy:
//
//   name / type        node identity ("track", FRAME) — part names come from here
//   layout             auto-layout: mode/primary/counter (direction/justify/align),
//                      literal spacing + padding [top,right,bottom,left], sizing modes
//   bound              variable bindings: Plugin-API field → variable name
//                      (slash-form, e.g. paddingLeft: "space/inset-x/sm")
//   cornerRadius       literal uniform radius (bound radii appear in `bound`)
//   fill / stroke      first visible solid paint: { var: name } when bound,
//                      { hex: "rrggbb" } when raw, plus { alpha } when the
//                      paint's effective opacity < 1 (dump v1.1) — raw paints
//                      are REPORTED by propose.ts, never silently tokenized
//   strokeWeight       literal stroke weight (bound weights appear in `bound`)
//   fillWidth          layoutSizingHorizontal === 'FILL' — canvas projection of
//                      grow (row parents) / align:stretch (column parents)
//   text               characters, fontSize, fontStyle, named TextStyle (token
//                      identity: "badge" ← font.badge.size), bound fill var
//   propRefs           componentPropertyReferences with property-id suffixes
//                      stripped: characters→TEXT, mainComponent→INSTANCE_SWAP,
//                      visible→BOOLEAN ("Show X" optional-part convention)
//   instanceOf         INSTANCE nodes: the main component's owning set name
//   componentProperties INSTANCE nodes (dump v1.1, additive): applied property
//                      values, so nested component refs keep their fixed props
//
// NOT captured in v1 (declared limits, noted by propose.ts): INSTANCE_SWAP
// preferredValues (→ slot `accepts`), property definitions/defaults, element
// semantics, events. Read-only — mutates nothing.

// Target set names. Empty array = every local set/component except the Slot
// utility. For the shipped fixtures this was ['Badge', 'Switch', 'Card'].
const TARGET_SETS = ['Badge', 'Switch', 'Card'];

await figma.loadAllPagesAsync();

const rgbToHex = (c) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return h(c.r) + h(c.g) + h(c.b);
};

const varNameById = async (id) => {
  const v = await figma.variables.getVariableByIdAsync(id);
  return v ? v.name : null;
};

// First visible solid paint → { var } | { hex } | null, with the paint's
// effective opacity as `alpha` when < 1 (dump v1.1 — 5%-black fills are a
// real kit idiom; without alpha they mint opaque black).
const dumpPaint = async (paints) => {
  if (!Array.isArray(paints)) return null; // figma.mixed
  const p = paints.find((x) => x.visible !== false && x.type === 'SOLID');
  if (!p) return null;
  const alpha = typeof p.opacity === 'number' ? p.opacity : 1;
  const withAlpha = (paint) => (alpha < 1 ? Object.assign(paint, { alpha }) : paint);
  const alias = p.boundVariables && p.boundVariables.color;
  if (alias) {
    const name = await varNameById(alias.id);
    if (name) return withAlpha({ var: name });
  }
  return withAlpha({ hex: rgbToHex(p.color) });
};

async function dumpNode(node) {
  const out = { name: node.name, type: node.type };

  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    out.layout = {
      mode: node.layoutMode,
      primary: node.primaryAxisAlignItems,
      counter: node.counterAxisAlignItems,
      spacing: node.itemSpacing,
      padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
      primarySizing: node.primaryAxisSizingMode,
      counterSizing: node.counterAxisSizingMode,
    };
  }
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius !== 0) {
    out.cornerRadius = node.cornerRadius;
  }

  // Direct variable bindings (paint bindings ride fill/stroke/text instead).
  const bound = {};
  for (const [field, alias] of Object.entries(node.boundVariables || {})) {
    if (Array.isArray(alias) || !alias || !alias.id) continue; // fills/strokes/characters
    const name = await varNameById(alias.id);
    if (name) bound[field] = name;
  }
  if (Object.keys(bound).length > 0) out.bound = bound;

  if (node.type !== 'TEXT') {
    const fill = 'fills' in node ? await dumpPaint(node.fills) : null;
    if (fill) out.fill = fill;
  }
  const stroke = 'strokes' in node ? await dumpPaint(node.strokes) : null;
  if (stroke) {
    out.stroke = stroke;
    if (typeof node.strokeWeight === 'number') out.strokeWeight = node.strokeWeight;
  }
  if ('layoutSizingHorizontal' in node && node.layoutSizingHorizontal === 'FILL') {
    out.fillWidth = true;
  }
  // dump v1.1: hidden nodes are captured, not skipped — visibility-bound
  // parts recover their boolean default from this (REST mapper parity).
  if (node.visible === false) out.hidden = true;
  // dump v1.2: NODE opacity (distinct from paint alpha) — the disabled-variant
  // wash-out channel (Eventz roots at opacity 0.4). Omitted when 1.
  if ('opacity' in node && typeof node.opacity === 'number' && node.opacity < 1) {
    out.opacity = Math.round(node.opacity * 10000) / 10000;
  }

  if (node.type === 'TEXT') {
    const text = {
      characters: node.characters,
      fontSize: typeof node.fontSize === 'number' ? node.fontSize : null,
      fontStyle: node.fontName === figma.mixed ? null : node.fontName.style,
    };
    if (node.textStyleId && node.textStyleId !== figma.mixed) {
      const style = await figma.getStyleByIdAsync(node.textStyleId);
      if (style) text.style = style.name;
    }
    const fill = await dumpPaint(node.fills);
    if (fill && fill.var) text.fillVar = fill.var;
    out.text = text;
    if (fill) out.fill = fill;
  }

  const propRefs = {};
  for (const [kind, key] of Object.entries(node.componentPropertyReferences || {})) {
    if (key) propRefs[kind] = key.split('#')[0];
  }
  if (Object.keys(propRefs).length > 0) out.propRefs = propRefs;

  if (node.type === 'INSTANCE') {
    const main = await node.getMainComponentAsync();
    if (main) {
      out.instanceOf =
        main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : main.name;
    }
    // dump v1.1: applied property values, so component refs keep fixed props.
    try {
      const props = {};
      for (const [key, def] of Object.entries(node.componentProperties || {})) {
        if (def.type === 'INSTANCE_SWAP') continue; // slots ride propRefs instead
        props[key.split('#')[0]] = def.value;
      }
      if (Object.keys(props).length > 0) out.componentProperties = props;
    } catch (e) {
      // componentProperties can throw on detached/broken instances — dump v1
      // fixtures shipped without this field, so absence is always tolerated.
    }
  }

  if ('children' in node && node.type !== 'INSTANCE') {
    out.children = [];
    for (const child of node.children) out.children.push(await dumpNode(child));
  }
  return out;
}

const dumps = {
  _provenance: {
    fileKey: figma.fileKey || null,
    extractedAt: new Date().toISOString().slice(0, 10),
    note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.2) for design→contract proposal.',
  },
};
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    if (node.name === 'Slot') continue; // utility, never a contract component
    if (TARGET_SETS.length > 0 && !TARGET_SETS.includes(node.name)) continue;
    const variants = [];
    if (node.type === 'COMPONENT_SET') {
      for (const variant of node.children) variants.push(await dumpNode(variant));
    } else {
      variants.push(await dumpNode(node));
    }
    dumps[node.name] = {
      setName: node.name,
      type: node.type,
      nodeId: node.id,
      key: node.key,
      variants,
    };
  }
}
return dumps;
