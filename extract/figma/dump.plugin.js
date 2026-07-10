// Design-side ANATOMY dump — the canonical node-tree capture (dump v1.4).
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
//   minWidth/minHeight/maxWidth/maxHeight
//                      literal min/max sizing in px (dump v1.4) — carried as
//                      style facts (a drawn minHeight 44 is a tap-target
//                      fact); bound min/max variables ride `bound` instead
//   _variables         top-level channel (dump v1.4): every variable a
//                      binding resolved through, keyed by slash-form name →
//                      { type, value } — the RESOLVED value for the consuming
//                      mode (Variable.resolveForConsumer). Colors are hex
//                      strings; floats stay raw numbers. The playground
//                      registers these as an import-scoped token layer so the
//                      proposal's real-name refs resolve and render.
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

// dump v1.2: capture-side degradation receipts — the plugin mirror of the
// REST mapper's MapReport.degradations. Every channel this script reads but
// cannot carry lands here by name (STYLE-FIDELITY audit: zero silent loss).
const degradations = [];
const degrade = (code, nodePath, message) => degradations.push({ code, nodePath, message });
// Arbitrary-path vectors — still #42 receipts. REGULAR_POLYGON / ELLIPSE /
// rotated RECTANGLE are CARRIED since dump v1.3 (see dumpShape below).
const VECTOR_TYPES = ['VECTOR', 'STAR', 'POLYGON', 'LINE', 'BOOLEAN_OPERATION'];
const SHAPE_KIND_BY_TYPE = { REGULAR_POLYGON: 'polygon', ELLIPSE: 'ellipse', RECTANGLE: 'rect' };
const round2 = (n) => Math.round(n * 100) / 100;

// Decor-shape capture (dump v1.3, #42) — the plugin mirror of
// extract/figma/rest/map.ts mapShape. The Plugin API gives the INTRINSIC
// (pre-rotation) size directly (node.width/height) and rotation in
// COUNTERCLOCKWISE degrees — negated into the dump's CSS-clockwise degrees.
// Placement (ABSOLUTE nodes only) comes from absoluteBoundingBox deltas,
// spelled center-preserving exactly like the REST mapper; constraints are
// normalized to the REST spelling (MIN→LEFT/TOP, MAX→RIGHT/BOTTOM).
function dumpShape(node, parent) {
  const kind = SHAPE_KIND_BY_TYPE[node.type];
  if (!kind) return null;
  const rotation = round2(-(typeof node.rotation === 'number' ? node.rotation : 0));
  if (kind === 'rect' && rotation === 0) return null; // ordinary box — existing channels
  const shape = { kind, width: round2(node.width), height: round2(node.height) };
  if (node.type === 'REGULAR_POLYGON' && typeof node.pointCount === 'number') shape.sides = node.pointCount;
  if (rotation !== 0) shape.rotation = rotation;
  const box = node.absoluteBoundingBox;
  const parentBox = parent && parent.absoluteBoundingBox;
  if (node.layoutPositioning === 'ABSOLUTE' && box && parentBox) {
    const cx = box.x - parentBox.x + box.width / 2;
    const cy = box.y - parentBox.y + box.height / 2;
    shape.x = round2(cx - shape.width / 2);
    shape.y = round2(cy - shape.height / 2);
    shape.right = round2(parentBox.width - cx - shape.width / 2);
    shape.bottom = round2(parentBox.height - cy - shape.height / 2);
    if (node.constraints) {
      const H = { MIN: 'LEFT', MAX: 'RIGHT', CENTER: 'CENTER' };
      const V = { MIN: 'TOP', MAX: 'BOTTOM', CENTER: 'CENTER' };
      const h = H[node.constraints.horizontal];
      const v = V[node.constraints.vertical];
      if (h && v) shape.constraints = { horizontal: h, vertical: v };
    }
  }
  return shape;
}

// dump v1.4: every variable a binding resolves through also lands in
// `_variables` with its RESOLVED value for the consuming node's mode —
// COLOR as hex ('#rrggbb', 8-digit when alpha < 1), FLOAT as the raw
// number, STRING/BOOLEAN as-is. A variable whose value cannot resolve is a
// named degradation, never a silent absence.
const capturedVariables = {};
const varNameById = async (id, consumer) => {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) return null;
  if (consumer && !(v.name in capturedVariables)) {
    try {
      const r = v.resolveForConsumer(consumer);
      if (r && r.resolvedType === 'COLOR') {
        const alpha = typeof r.value.a === 'number' ? r.value.a : 1;
        const suffix = alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '';
        capturedVariables[v.name] = { type: 'COLOR', value: '#' + rgbToHex(r.value) + suffix };
      } else if (r) {
        capturedVariables[v.name] = { type: r.resolvedType, value: r.value };
      }
    } catch (e) {
      degrade('variable-value-unresolved', v.name, 'resolveForConsumer threw (' + (e && e.message ? e.message : String(e)) + ') — the name still binds; the value is not captured (dump v1.4)');
    }
  }
  return v.name;
};

// First visible solid paint → { var } | { hex } | null, with the paint's
// effective opacity as `alpha` when < 1 (dump v1.1 — 5%-black fills are a
// real kit idiom; without alpha they mint opaque black).
const dumpPaint = async (paints, nodePath, field, consumer) => {
  if (!Array.isArray(paints)) return null; // figma.mixed
  const visibles = paints.filter((x) => x.visible !== false);
  const p = visibles.find((x) => x.type === 'SOLID');
  if (!p) {
    if (visibles.length > 0 && nodePath) {
      degrade('paint-unsupported', nodePath, 'first visible ' + field + ' paint is ' + visibles[0].type + ', not SOLID — dump v1 carries solid paints only; paint omitted');
    }
    return null;
  }
  if (visibles.length > 1 && nodePath) {
    degrade('paint-stack-truncated', nodePath, visibles.length + ' visible ' + field + ' paints (' + visibles.map((x) => x.type).join(', ') + ') — dump v1 carries the first SOLID only');
  }
  const alpha = typeof p.opacity === 'number' ? p.opacity : 1;
  const withAlpha = (paint) => (alpha < 1 ? Object.assign(paint, { alpha }) : paint);
  const alias = p.boundVariables && p.boundVariables.color;
  if (alias) {
    const name = await varNameById(alias.id, consumer);
    if (name) return withAlpha({ var: name });
  }
  return withAlpha({ hex: rgbToHex(p.color) });
};

async function dumpNode(node, nodePath, parent) {
  const out = { name: node.name, type: node.type };

  // dump v1.3 (#42): parametric decor geometry is CARRIED (rotation rides it).
  const shape = dumpShape(node, parent);
  if (shape) out.shape = shape;

  // dump v1.2: channels with NO dump projection are named receipts.
  if ('blendMode' in node && node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') {
    degrade('blend-mode-unsupported', nodePath, 'blendMode ' + node.blendMode + ' has no dump v1 projection — node renders as NORMAL');
  }
  if (!shape && 'rotation' in node && typeof node.rotation === 'number' && Math.abs(node.rotation) > 1e-6) {
    degrade('rotation-unsupported', nodePath, 'rotation ' + node.rotation + ' on a ' + node.type + ' has no dump projection (rotation is carried only on shape decor — dump v1.3) — node renders unrotated (#42 residue)');
  }
  if (VECTOR_TYPES.indexOf(node.type) >= 0) {
    degrade('vector-geometry-unsupported', nodePath, node.type + ' geometry (arbitrary paths) is not captured — parametric decor (REGULAR_POLYGON/ELLIPSE/rotated RECTANGLE) IS carried since dump v1.3; this node carries paints only and renders as a box (#42 residue)');
  }

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
  } else if ('cornerRadius' in node && typeof node.cornerRadius !== 'number') {
    // figma.mixed — per-corner radii (dump v1.2: named, no longer silent)
    degrade('radii-nonuniform', nodePath, 'per-corner radii [' + [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].join(', ') + '] are not uniform — dump v1 carries a uniform radius only; omitted');
  }

  // Direct variable bindings (paint bindings ride fill/stroke/text instead).
  const bound = {};
  for (const [field, alias] of Object.entries(node.boundVariables || {})) {
    if (Array.isArray(alias) || !alias || !alias.id) continue; // fills/strokes/characters
    const name = await varNameById(alias.id, node);
    if (name) bound[field] = name;
  }
  if (Object.keys(bound).length > 0) out.bound = bound;

  if (node.type !== 'TEXT') {
    const fill = 'fills' in node ? await dumpPaint(node.fills, nodePath, 'fill', node) : null;
    if (fill) out.fill = fill;
  }
  const stroke = 'strokes' in node ? await dumpPaint(node.strokes, nodePath, 'stroke', node) : null;
  if (stroke) {
    out.stroke = stroke;
    if (typeof node.strokeWeight === 'number') out.strokeWeight = node.strokeWeight;
    // Stroke DETAIL on an INSTANCE is elided by design downstream (instance
    // styling belongs to the child contract; the Slot utility's dashed
    // border is the utility's own) — no receipt for an unconsumed channel.
    if (node.type !== 'INSTANCE') {
      if (typeof node.strokeWeight !== 'number') {
        degrade('stroke-weights-nonuniform', nodePath, 'per-side stroke weights [' + [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight].join(', ') + '] — dump v1 carries a uniform strokeWeight only');
      }
      if (Array.isArray(node.dashPattern) && node.dashPattern.length > 0) {
        degrade('stroke-style-unsupported', nodePath, 'dashPattern [' + node.dashPattern.join(', ') + '] — dashed strokes have no dump v1 projection; stroke renders solid');
      }
      if ('strokeAlign' in node && node.strokeAlign !== 'INSIDE') {
        degrade('stroke-style-unsupported', nodePath, 'strokeAlign ' + node.strokeAlign + ' — dump consumers render INSIDE strokes (CSS borders); alignment dropped');
      }
    }
  }
  // dump v1.4: literal min/max sizing is CARRIED as style facts (a drawn
  // minHeight 44 is a tap-target fact) — previously a named degradation.
  // Bound min/max variables ride `bound` instead.
  if ('minWidth' in node && typeof node.minWidth === 'number') out.minWidth = node.minWidth;
  if ('maxWidth' in node && typeof node.maxWidth === 'number') out.maxWidth = node.maxWidth;
  if ('minHeight' in node && typeof node.minHeight === 'number') out.minHeight = node.minHeight;
  if ('maxHeight' in node && typeof node.maxHeight === 'number') out.maxHeight = node.maxHeight;
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
  // dump v1.2: VISIBLE effects. Shadows carry geometry + color; blur types
  // carry the type — propose.ts NAMES what it cannot invert.
  if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
    const effects = [];
    for (const e of node.effects) {
      if (e.visible === false) continue;
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const alpha = typeof e.color.a === 'number' ? e.color.a : 1;
        const color = alpha < 1 ? { hex: rgbToHex(e.color), alpha: Math.round(alpha * 10000) / 10000 } : { hex: rgbToHex(e.color) };
        const eff = { type: e.type, color, offset: { x: e.offset.x, y: e.offset.y }, radius: e.radius };
        if (typeof e.spread === 'number' && e.spread !== 0) eff.spread = e.spread;
        effects.push(eff);
      } else {
        effects.push(typeof e.radius === 'number' ? { type: e.type, radius: e.radius } : { type: e.type });
      }
    }
    if (effects.length > 0) out.effects = effects;
  }

  if (node.type === 'TEXT') {
    // dump v1.3: PIXEL line heights are CAPTURED; other explicit units stay
    // receipts below.
    const pxLineHeight =
      node.lineHeight !== figma.mixed && node.lineHeight && node.lineHeight.unit === 'PIXELS'
        ? node.lineHeight.value
        : null;
    const channels = [];
    if (node.letterSpacing !== figma.mixed && node.letterSpacing && node.letterSpacing.value !== 0) {
      channels.push('letterSpacing ' + node.letterSpacing.value + node.letterSpacing.unit);
    }
    if (node.textCase !== figma.mixed && node.textCase && node.textCase !== 'ORIGINAL') channels.push('textCase ' + node.textCase);
    if (node.textDecoration !== figma.mixed && node.textDecoration && node.textDecoration !== 'NONE') channels.push('textDecoration ' + node.textDecoration);
    if (node.lineHeight !== figma.mixed && node.lineHeight && node.lineHeight.unit !== 'AUTO' && node.lineHeight.unit !== 'PIXELS') {
      channels.push('lineHeight ' + node.lineHeight.value + node.lineHeight.unit + ' — only PIXELS carries, dump v1.3');
    }
    if (channels.length > 0) {
      degrade('text-channel-unsupported', nodePath, 'text channel(s) with no dump v1 projection: ' + channels.join('; ') + ' — typography carries (fontSize, fontStyle, style identity) only');
    }
    const text = {
      characters: node.characters,
      fontSize: typeof node.fontSize === 'number' ? node.fontSize : null,
      fontStyle: node.fontName === figma.mixed ? null : node.fontName.style,
    };
    if (typeof pxLineHeight === 'number') text.lineHeight = pxLineHeight;
    if (node.textStyleId && node.textStyleId !== figma.mixed) {
      const style = await figma.getStyleByIdAsync(node.textStyleId);
      if (style) text.style = style.name;
    }
    const fill = await dumpPaint(node.fills, nodePath, 'fill', node);
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
    for (const child of node.children) out.children.push(await dumpNode(child, nodePath + '/' + child.name, node));
  }
  return out;
}

const dumps = {
  _provenance: {
    fileKey: figma.fileKey || null,
    extractedAt: new Date().toISOString().slice(0, 10),
    note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.4) for design→contract proposal.',
  },
};
dumps._degradations = degradations;
dumps._variables = capturedVariables;
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    if (node.name === 'Slot') continue; // utility, never a contract component
    if (TARGET_SETS.length > 0 && !TARGET_SETS.includes(node.name)) continue;
    const variants = [];
    if (node.type === 'COMPONENT_SET') {
      for (const variant of node.children) variants.push(await dumpNode(variant, node.name + ':' + variant.name));
    } else {
      variants.push(await dumpNode(node, node.name + ':' + node.name));
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
