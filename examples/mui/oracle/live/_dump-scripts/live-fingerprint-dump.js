// Live-session fingerprint dump for MUI oracle (Wave 2).
// Captures dump-shaped facts needed for dump-readback + edit/restore:
 // set identity, propertyDefinitions, per-variant root layout + bound vars.
// Not a substitute for full extract/figma/dump.plugin.js on design→contract
// proposal; sufficient for LIVE.md Steps 2–5 evidence. Set TARGET_NAME below.
const TARGET_NAME = 'Button';

await figma.loadAllPagesAsync();

const rgbToHex = (c) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return h(c.r) + h(c.g) + h(c.b);
};

const resolveVarName = async (id) => {
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    return v ? v.name : id;
  } catch {
    return id;
  }
};

const dumpBound = async (node) => {
  const out = {};
  const bv = node.boundVariables;
  if (!bv) return out;
  for (const [field, ref] of Object.entries(bv)) {
    if (!ref) continue;
    if (Array.isArray(ref)) continue;
    if (typeof ref === 'object' && ref.id) {
      out[field] = await resolveVarName(ref.id);
    }
  }
  return out;
};

const dumpLayout = (node) => {
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') return undefined;
  return {
    mode: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    gap: node.itemSpacing,
    padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
  };
};

const dumpFill = (node) => {
  if (!('fills' in node) || !Array.isArray(node.fills) || node.fills === figma.mixed) return undefined;
  const solid = node.fills.find((p) => p.visible !== false && p.type === 'SOLID');
  if (!solid) return undefined;
  const out = { hex: rgbToHex(solid.color) };
  if (solid.opacity != null && solid.opacity < 1) out.alpha = solid.opacity;
  return out;
};

const dumpNodeLite = async (node, nodePath) => {
  const entry = {
    name: node.name,
    type: node.type,
    nodeId: node.id,
    nodePath,
  };
  const layout = dumpLayout(node);
  if (layout) entry.layout = layout;
  const bound = await dumpBound(node);
  if (Object.keys(bound).length) entry.bound = bound;
  const fill = dumpFill(node);
  if (fill) entry.fill = fill;
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
    entry.cornerRadius = node.cornerRadius;
  }
  if ('children' in node && Array.isArray(node.children)) {
    entry.children = [];
    for (const child of node.children) {
      // Do not recurse into INSTANCE internals — same limit as dump v1.
      if (child.type === 'INSTANCE') {
        const inst = {
          name: child.name,
          type: 'INSTANCE',
          nodeId: child.id,
          instanceOf: child.mainComponent
            ? (child.mainComponent.parent && child.mainComponent.parent.type === 'COMPONENT_SET'
                ? child.mainComponent.parent.name
                : child.mainComponent.name)
            : undefined,
        };
        const ib = await dumpBound(child);
        if (Object.keys(ib).length) inst.bound = ib;
        entry.children.push(inst);
        continue;
      }
      entry.children.push(await dumpNodeLite(child, nodePath + '/' + child.name));
    }
  }
  return entry;
};

const dumpPropertyDefinitions = (node) => {
  const propertyDefinitions = {};
  try {
    for (const [propName, def] of Object.entries(node.componentPropertyDefinitions || {})) {
      const captured = { type: def.type, defaultValue: def.defaultValue };
      if (def.type === 'VARIANT' && Array.isArray(def.variantOptions)) {
        captured.variantOptions = def.variantOptions.map(String);
      }
      propertyDefinitions[propName] = captured;
    }
  } catch (_) {
    /* not a set */
  }
  return propertyDefinitions;
};

const dumps = {
  _provenance: {
    fileKey: figma.fileKey || null,
    extractedAt: new Date().toISOString().slice(0, 10),
    note: 'Live fingerprint dump (mui oracle Wave 2) — root/layout/bound/props; not full dump v1.15 tree.',
    dumpVersion: 'live-fingerprint-1',
    target: TARGET_NAME,
  },
  _degradations: [],
  _variables: {},
};

let found = null;
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    if (node.name !== TARGET_NAME) continue;
    found = { page: page.name, node };
    break;
  }
  if (found) break;
}

if (!found) {
  return { error: 'TARGET_NOT_FOUND', target: TARGET_NAME };
}

const { node } = found;
const variants = [];
if (node.type === 'COMPONENT_SET') {
  for (const variant of node.children) {
    variants.push(await dumpNodeLite(variant, node.name + ':' + variant.name));
  }
} else {
  variants.push(await dumpNodeLite(node, node.name + ':' + node.name));
}

const defs = dumpPropertyDefinitions(node);
dumps[node.name] = {
  setName: node.name,
  type: node.type,
  nodeId: node.id,
  key: node.key,
  page: found.page,
  variants,
};
if (Object.keys(defs).length) dumps[node.name].propertyDefinitions = defs;

return dumps;
