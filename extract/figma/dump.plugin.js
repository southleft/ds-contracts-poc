// Design-side ANATOMY dump — the canonical node-tree capture (dump v1.13).
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
//                      literal spacing + padding [top,right,bottom,left], sizing modes.
//                      dump v1.12: `wrap` (layoutWrap === 'WRAP') and `rowSpacing`
//                      (counterAxisSpacing, ONLY when it differs from itemSpacing —
//                      Figma leaves it null to follow, which is what one CSS `gap`
//                      already means). The emitter has written layoutWrap from a
//                      contract's `layout.wrap` since v15 and nothing read it back,
//                      so a wrapping row returned as a single line with no receipt.
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
//                      dump v1.6: multi-mode collections also carry `modes`
//                      (mode NAME → resolved value per mode) — the channel
//                      §3 theme-mode promotion resolves through.
//   cornerRadius       literal uniform radius (bound radii appear in `bound`)
//   fill / stroke      first visible solid paint: { var: name } when bound,
//                      { hex: "rrggbb" } when raw, plus { alpha } when the
//                      paint's effective opacity < 1 (dump v1.1) — raw paints
//                      are REPORTED by propose.ts, never silently tokenized
//   gradient           first visible GRADIENT_LINEAR fill (dump v1.16):
//                      normalized-object-space handles (start → ramp 0,
//                      end → ramp 1, gradientTransform inverted) + stops
//                      (resolved hex/alpha, bound variable NAME per stop when
//                      one rides it). Carried alone or over a SOLID drawn
//                      below it (CSS background-color under background-image).
//                      RADIAL/ANGULAR/DIAMOND stay paint-unsupported receipts.
//   strokeWeight       literal stroke weight (bound weights appear in `bound`)
//   strokeAlign        INSIDE | CENTER | OUTSIDE (dump v1.11) — where the
//                      weight is drawn relative to the node box. Captured on
//                      EVERY stroke, INSIDE included: an absent field was
//                      being read as INSIDE by assumption, and the assumption
//                      was wrong on Untitled UI's Avatar focus ring. OUTSIDE
//                      lowers to the CSS outline vocabulary (which draws
//                      outside the border box and does not affect layout),
//                      INSIDE to border; CENTER is refused BY NAME
//                      (stroke-align-unsupported) because CSS has no
//                      straddling spelling.
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
//                      — VARIANT and TEXT-property values alike (a TEXT
//                      component property's characters ride here, keyed with
//                      the Plugin API's "#id" suffix). A component set with NO
//                      TEXT property has nothing to carry in this channel:
//                      its hosts override characters DIRECTLY, which is
//                      `textOverrides` below.
//   textOverrides      INSTANCE nodes (dump v1.10): the characters a HOST sets
//                      on this instance's text descendants when the child
//                      component exposes NO TEXT property — the field case
//                      dump v1.1–v1.9 dropped entirely (Untitled UI's Tooltip
//                      and Avatar have zero TEXT properties, so a slider's
//                      "0%" and an avatar group's "+5" chip were invisible and
//                      the child's own default characters rendered instead).
//                      Source: InstanceNode.overrides, filtered to entries
//                      whose overriddenFields include 'characters' — Figma's
//                      own answer to "what did this host change?", never a
//                      diff we compute. Keyed by the overridden node's NAME
//                      PATH inside the instance ("Content/Text"), value = the
//                      drawn characters. This is the ONE targeted read-only
//                      walk into instance internals (dump v1 otherwise never
//                      recurses); an override the walk cannot locate is a
//                      named degradation, never a guess.
//   instanceKey /      INSTANCE nodes (dump v1.5): the main component's publish
//   instanceSetKey     key and its owning set's key — rename-safe identity the
//                      session-linking resolver matches against in-scope
//                      contracts' anchors (componentSetKey first, name fallback)
//   bbox               INSTANCE nodes (dump v1.5): the OBSERVED bounding box —
//                      honest geometry for child STUBS (a correctly-sized box;
//                      instance internals still never recursed)
//   swapPreferredValues set-level (dump v1.5): INSTANCE_SWAP preferredValues
//                      (component keys) → slot `accepts` where the keys resolve
//   boolDefaults       set-level (dump v1.5): BOOLEAN property defaultValues —
//                      visibility-bound boolean prop defaults, captured evidence
//   fixedSize          in-flow fixed-size box (dump v1.8): drawn w/h from
//                      absoluteBoundingBox, captured for in-flow
//                      NON-auto-layout children of AUTO-layout parents whose
//                      layoutSizing is FIXED — the one class no other size
//                      channel touches (UUI tooltip arrow strip field case)
//   imageFill          first visible fill is an IMAGE paint (dump v1.7) —
//                      dump v1.9 carries the paint's imageHash STRING (the
//                      exported asset's name, <hash>.png; the bytes export
//                      rides a separate bridge pass over the same nodes);
//                      a hashless image paint keeps the v1.7 boolean marker
//   SLOT nodes         native Figma slots (Schema 2025, dump v1.5): carried
//                      verbatim (type 'SLOT', children walked) — propose maps
//                      them to the same contract slot part as INSTANCE_SWAP
//
// NOT captured in v1 (declared limits, noted by propose.ts): element
// semantics, events. Read-only — mutates nothing.

// Target set names. Empty array = every local set/component except the Slot
// utility. For the shipped fixtures this was ['Badge', 'Switch', 'Card'].
const TARGET_SETS = ['Badge', 'Switch', 'Card'];

await figma.loadAllPagesAsync();

// dump v1.13: ALL FIVE Figma constraint values, not three.
//
// The Plugin API's ConstraintType is MIN | CENTER | MAX | STRETCH | SCALE.
// Both capture sites mapped only the first three, so `H['STRETCH']` was
// undefined and the `if (h && v)` guard DROPPED THE WHOLE FIELD. That is not a
// lost fact, it is a SUBSTITUTED one: core/propose-figma.ts reads an absent
// field as `?? 'LEFT'` / `?? 'TOP'` and then bakes confident pinned-top-left
// geometry. Untitled UI's `Progress circle/Ring` is the
// candidate that surfaced it: 6 of its 16 occurrences are drawn with EQUAL
// insets on all four sides (12/12/12/12 in two), which is consistent with a
// stretched box — though NOT proof, since STRETCH permits ANY fixed insets and
// the other occurrences are unequal or have negative bottoms. What IS measured:
// 352 positioned boxes across the committed dumps carry NO constraints field,
// and until v1.13 a STRETCH or SCALE node was INDISTINGUISHABLE there from a
// genuine top-left pin.
//
// propose-figma.ts already carries a refusal for exactly this
// ("constraint AxB has no carried offset spelling"), and a plugin dump could
// NEVER trigger it — the only fixture that does is a HAND-AUTHORED conformance
// case (placement-constraints-scale.dump.json) written to contain a value the
// real capture cannot emit. The gate was green over a dead path, the same
// shape as the POLYGON incident.
//
// STRETCH is exactly CSS `left + right` (or `top + bottom`) with no size, so it
// is CARRIABLE; SCALE (proportional resize) has no CSS spelling and keeps the
// named refusal. Either way the fact now REACHES the decision.
const CONSTRAINT_H = { MIN: 'LEFT', MAX: 'RIGHT', CENTER: 'CENTER', STRETCH: 'STRETCH', SCALE: 'SCALE' };
const CONSTRAINT_V = { MIN: 'TOP', MAX: 'BOTTOM', CENTER: 'CENTER', STRETCH: 'STRETCH', SCALE: 'SCALE' };

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
// TWO APIs, TWO SPELLINGS, AND THIS FILE SPOKE THE WRONG ONE. A polygon is
// `REGULAR_POLYGON` in the REST API and `POLYGON` in the Plugin API. This
// script runs INSIDE the plugin, so every polygon missed SHAPE_KIND_BY_TYPE,
// dumpShape returned null, and the node fell through to BOTH the
// vector-geometry and rotation degradations — carrying paints only and
// rendering as a box. The field case is the CBDS Tooltip pointer, which
// extract/figma/visual-parity/triage.ts still reports as a live Δ19-device-px
// defect and attributes to "the plugin channel does not carry it". It would
// have carried it. The REST mapper spells it correctly, the eval covers the
// REST path, and scripts/plugin-engine-mock-figma.mjs returned the REST
// spelling from createPolygon() — so the test agreed with the bug.
// Both spellings are accepted here rather than swapped, because this file is
// diffed against REST-derived fixtures and must read either.
const VECTOR_TYPES = ['VECTOR', 'STAR', 'LINE', 'BOOLEAN_OPERATION'];
const SHAPE_KIND_BY_TYPE = { REGULAR_POLYGON: 'polygon', POLYGON: 'polygon', ELLIPSE: 'ellipse', RECTANGLE: 'rect' };
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
  if (kind === 'rect' && rotation === 0) {
    // dump v1.7: an unrotated RECT is 'ordinary' only when auto-layout carries
    // its size; outside auto-layout (slider tracks, progress bars) or when
    // ABSOLUTE, nothing else carries width/height — carry it as shape.
    const parentAuto = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
    if (parentAuto && node.layoutPositioning !== 'ABSOLUTE') return null;
  }
  const shape = { kind, width: round2(node.width), height: round2(node.height) };
  if ((node.type === 'REGULAR_POLYGON' || node.type === 'POLYGON') && typeof node.pointCount === 'number') shape.sides = node.pointCount;
  if (node.type === 'ELLIPSE' && node.arcData && (Math.abs(node.arcData.endingAngle - node.arcData.startingAngle) < Math.PI * 2 - 1e-6 || node.arcData.innerRadius > 0)) {
    shape.arc = { start: round2(node.arcData.startingAngle), end: round2(node.arcData.endingAngle), innerRadius: round2(node.arcData.innerRadius) };
  }
  if (rotation !== 0) shape.rotation = rotation;
  const box = node.absoluteBoundingBox;
  const parentBox = parent && parent.absoluteBoundingBox;
  // dump v1.7 (overlay-flattened class, round 2 iteration 2): a shape child
  // of a NON-auto-layout parent is x/y-placed exactly like every other child
  // there — the same rule the `abs` channel uses (layoutPositioning only
  // means something inside auto-layout). Previously only ABSOLUTE nodes got
  // placement, so slider/progress tracks and ring ellipses captured size but
  // LOST their canvas position and code stacked them in flow.
  const shapeParentAuto = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
  const shapePlaced = node.layoutPositioning === 'ABSOLUTE'
    || (parent && !shapeParentAuto && typeof node.x === 'number');
  if (shapePlaced && box && parentBox) {
    const cx = box.x - parentBox.x + box.width / 2;
    const cy = box.y - parentBox.y + box.height / 2;
    shape.x = round2(cx - shape.width / 2);
    shape.y = round2(cy - shape.height / 2);
    shape.right = round2(parentBox.width - cx - shape.width / 2);
    shape.bottom = round2(parentBox.height - cy - shape.height / 2);
    if (node.constraints) {
      const h = CONSTRAINT_H[node.constraints.horizontal];
      const v = CONSTRAINT_V[node.constraints.vertical];
      if (h && v) shape.constraints = { horizontal: h, vertical: v };
      else degrade('constraint-spelling-unknown', nodePath, 'constraints ' + node.constraints.horizontal + 'x' + node.constraints.vertical + ' has no dump spelling — the field is OMITTED, and propose reads an absent field as LEFTxTOP');
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
// dump v1.6: a variable whose COLLECTION has more than one mode ALSO carries
// `modes` — mode NAME → resolved value per mode (direct values and one-hop-
// resolved aliases; deeper alias chains resolve up to depth 5). This is the
// channel §3 theme-mode promotion resolves through: the default mode's value
// stays `value` (byte-compatible with v1.4 consumers), the other modes land
// as MODES on the captured-token layer. A mode whose value cannot resolve is
// a named degradation, never a silent absence.
const spellVariableValue = (resolvedType, value) => {
  if (resolvedType === 'COLOR' && value && typeof value === 'object') {
    const alpha = typeof value.a === 'number' ? value.a : 1;
    const suffix = alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '';
    return '#' + rgbToHex(value) + suffix;
  }
  return value;
};
const resolveModeValue = async (raw, modeId, depth) => {
  if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
    if (depth >= 5) return undefined;
    const target = await figma.variables.getVariableByIdAsync(raw.id);
    if (!target) return undefined;
    // The aliased variable resolves through the SAME mode when its own
    // collection carries it, else its collection's default mode.
    const next = target.valuesByMode[modeId] !== undefined
      ? target.valuesByMode[modeId]
      : target.valuesByMode[Object.keys(target.valuesByMode)[0]];
    return resolveModeValue(next, modeId, depth + 1);
  }
  return raw;
};
const varNameById = async (id, consumer) => {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) return null;
  if (consumer && !(v.name in capturedVariables)) {
    try {
      const r = v.resolveForConsumer(consumer);
      if (r) {
        capturedVariables[v.name] = { type: r.resolvedType, value: spellVariableValue(r.resolvedType, r.value) };
        try {
          const collection = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          if (collection && collection.modes.length > 1) {
            const modes = {};
            for (const m of collection.modes) {
              const resolved = await resolveModeValue(v.valuesByMode[m.modeId], m.modeId, 0);
              if (resolved === undefined) {
                degrade('variable-mode-unresolved', v.name, 'mode "' + m.name + '" did not resolve (alias chain too deep or target missing) — the mode value is not captured (dump v1.6)');
              } else {
                modes[m.name] = spellVariableValue(r.resolvedType, resolved);
              }
            }
            if (Object.keys(modes).length > 0) capturedVariables[v.name].modes = modes;
          }
        } catch (e) {
          degrade('variable-mode-unresolved', v.name, 'collection modes threw (' + (e && e.message ? e.message : String(e)) + ') — per-mode values not captured (dump v1.6)');
        }
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

const round4 = (v) => Math.round(v * 10000) / 10000;

// dump v1.16: GRADIENT_LINEAR projection. The Plugin API spells a gradient's
// placement as `gradientTransform` — an affine map from normalized object
// space to gradient space — while the dump (and the REST surface) speak the
// two HANDLE POINTS: the object-space points at ramp position 0 and 1, i.e.
// the transform's INVERSE applied to (0, 0.5) and (1, 0.5) (REST
// gradientHandlePositions[0]/[1]). Stops carry the resolved color (+ alpha
// when < 1) and the bound variable's NAME when a stop rides one — the same
// name-resolution rule every other paint channel uses. A degenerate
// (non-invertible) transform or a < 2-stop ramp is refused by name.
const dumpGradient = async (p, nodePath, consumer) => {
  const t = p.gradientTransform;
  if (!Array.isArray(t) || t.length !== 2) {
    degrade('paint-unsupported', nodePath, 'GRADIENT_LINEAR without a gradientTransform — gradient not captured (dump v1.16)');
    return null;
  }
  const a = t[0][0], b = t[0][1], c = t[0][2];
  const d = t[1][0], e = t[1][1], f = t[1][2];
  const det = a * e - b * d;
  if (!isFinite(det) || Math.abs(det) < 1e-9) {
    degrade('paint-unsupported', nodePath, 'GRADIENT_LINEAR gradientTransform is non-invertible — gradient not captured (dump v1.16)');
    return null;
  }
  const inv = (x, y) => ({
    x: round4((e * (x - c) - b * (y - f)) / det),
    y: round4((-d * (x - c) + a * (y - f)) / det),
  });
  const stops = [];
  for (const s of p.gradientStops || []) {
    const stop = { position: round4(s.position), hex: rgbToHex(s.color) };
    const sa = typeof s.color.a === 'number' ? s.color.a : 1;
    if (sa < 1) stop.alpha = round4(sa);
    const alias = s.boundVariables && s.boundVariables.color;
    if (alias && alias.id) {
      const name = await varNameById(alias.id, consumer);
      if (name) stop.var = name;
    }
    stops.push(stop);
  }
  if (stops.length < 2) {
    degrade('paint-unsupported', nodePath, 'GRADIENT_LINEAR with ' + stops.length + ' stop(s) — gradient not captured (dump v1.16)');
    return null;
  }
  const out = { start: inv(0, 0.5), end: inv(1, 0.5), stops };
  const op = typeof p.opacity === 'number' ? p.opacity : 1;
  if (op < 1) out.alpha = round4(op);
  return out;
};

// dump v1.16: the FILL STACK dumper — the first visible SOLID (dumpPaint's
// selection rule, spelling parity via dumpPaint itself) PLUS the first
// visible GRADIENT_LINEAR drawn ABOVE it (Figma paints draw bottom-to-top,
// so solid-below-gradient is exactly CSS background-color under
// background-image). A gradient hidden UNDER a solid keeps the truncation
// receipt; RADIAL/ANGULAR/DIAMOND (and IMAGE — its own channel) keep
// paint-unsupported. Receipts fire only for what is NOT carried.
const dumpFillStack = async (node, nodePath) => {
  const paints = node.fills;
  if (!Array.isArray(paints)) return { fill: null, gradient: null }; // figma.mixed
  const visibles = paints.filter((x) => x.visible !== false);
  const solid = visibles.find((x) => x.type === 'SOLID');
  const grad = visibles.find((x) => x.type === 'GRADIENT_LINEAR');
  const gradCarriable = grad && (!solid || visibles.indexOf(grad) > visibles.indexOf(solid));
  const gradient = gradCarriable ? await dumpGradient(grad, nodePath, node) : null;
  if (!solid && !gradient && visibles.length > 0 && nodePath) {
    degrade('paint-unsupported', nodePath, 'first visible fill paint is ' + visibles[0].type + ', not SOLID — dump v1.16 carries SOLID and GRADIENT_LINEAR fills only; paint omitted');
  }
  const carried = (solid ? 1 : 0) + (gradient ? 1 : 0);
  if (carried > 0 && visibles.length > carried && nodePath) {
    degrade('paint-stack-truncated', nodePath, visibles.length + ' visible fill paints (' + visibles.map((x) => x.type).join(', ') + ') — dump v1.16 carries the first SOLID plus a GRADIENT_LINEAR above it only');
  }
  const fill = solid ? await dumpPaint([solid], nodePath, 'fill', node) : null;
  return { fill, gradient };
};

async function dumpNode(node, nodePath, parent) {
  const out = { name: node.name, type: node.type };

  // dump v1.14: the structured realized tuple for a direct component-set row.
  // Names are presentation and may contain punctuation; exact recovery uses
  // these verbatim property keys/values instead of splitting node.name.
  if (node.type === 'COMPONENT' && parent && parent.type === 'COMPONENT_SET') {
    try {
      const tuple = node.variantProperties || null;
      if (tuple && Object.keys(tuple).length > 0) {
        out.variantProperties = Object.fromEntries(
          Object.keys(tuple).sort().map((key) => [key, String(tuple[key])]),
        );
      }
    } catch (e) {
      // Absence means structured metadata was not captured. The exact
      // projection gate reports legacy-unverified rather than guessing.
    }
  }

  // dump v1.5: variant-ROOT observed bounding box — the drawn dimension of a
  // FIXED root axis is otherwise unrecoverable (CBDS Dialog field case).
  if (node.type === 'COMPONENT' && typeof node.width === 'number' && typeof node.height === 'number') {
    out.bbox = { width: round2(node.width), height: round2(node.height) };
  }

  // dump v1.3 (#42): parametric decor geometry is CARRIED (rotation rides it).
  const shape = dumpShape(node, parent);
  if (shape) out.shape = shape;

  // dump v1.7: ABSOLUTE placement for ALL node types (TEXT/FRAME/INSTANCE),
  // center-preserving, same spelling as dumpShape — the overlay-flattened class.
  const parentAutoLayout = parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
  const isAbsolutePlaced = node.layoutPositioning === 'ABSOLUTE'
    // dump v1.7: in a NON-auto-layout parent EVERY child is absolutely
    // placed by x/y (layoutPositioning only means something inside auto-layout)
    // — UUI's avatar indicators and floating tooltips live exactly there, which
    // is why the first rev captured zero abs blocks.
    || (parent && !parentAutoLayout && typeof node.x === 'number');
  if (!shape && isAbsolutePlaced && node.absoluteBoundingBox && parent && parent.absoluteBoundingBox) {
    const bb = node.absoluteBoundingBox, pb = parent.absoluteBoundingBox;
    const cx = bb.x - pb.x + bb.width / 2, cy = bb.y - pb.y + bb.height / 2;
    const abs = { x: round2(cx - bb.width / 2), y: round2(cy - bb.height / 2), right: round2(pb.width - cx - bb.width / 2), bottom: round2(pb.height - cy - bb.height / 2), width: round2(bb.width), height: round2(bb.height) };
    if (node.constraints) {
      const h = CONSTRAINT_H[node.constraints.horizontal], v = CONSTRAINT_V[node.constraints.vertical];
      if (h && v) abs.constraints = { horizontal: h, vertical: v };
      else degrade('constraint-spelling-unknown', nodePath, 'constraints ' + node.constraints.horizontal + 'x' + node.constraints.vertical + ' has no dump spelling — the field is OMITTED, and propose reads an absent field as LEFTxTOP');
    }
    out.abs = abs;
  }

  // dump v1.8: fixed-size IN-FLOW box. An in-flow child of an AUTO-layout
  // parent that is NOT itself auto-layout gets NO size channel from any
  // other capture (`layout` needs auto-layout on the node, `abs` needs
  // ABSOLUTE or a non-auto-layout parent, `shape` covers parametric decor,
  // `bbox` covers COMPONENT roots and INSTANCE stubs) — yet its drawn box is
  // a hard fact when layoutSizing is FIXED. Carried from absoluteBoundingBox
  // (the DRAWN box — rotation-safe: UUI's tooltip arrow strip draws 6×16
  // from a 90°-rotated 16×6 frame; a rotated box carries only when BOTH axes
  // are FIXED, an unrotated one carries each FIXED axis independently).
  // Field case: that strip captured NOTHING, its anchor box collapsed to 0,
  // and the absolutely-placed arrow overlaid the bubble's text.
  const nodeAutoLayout = 'layoutMode' in node && node.layoutMode !== 'NONE';
  if (!shape && !out.abs && !out.bbox && node.type !== 'TEXT' && node.type !== 'INSTANCE'
      && parentAutoLayout && node.layoutPositioning !== 'ABSOLUTE' && !nodeAutoLayout
      && node.absoluteBoundingBox && 'layoutSizingHorizontal' in node) {
    const hFixed = node.layoutSizingHorizontal === 'FIXED';
    const vFixed = node.layoutSizingVertical === 'FIXED';
    const rotated = 'rotation' in node && typeof node.rotation === 'number' && Math.abs(node.rotation) > 1e-6;
    const fixed = {};
    if (hFixed && (vFixed || !rotated)) fixed.width = round2(node.absoluteBoundingBox.width);
    if (vFixed && (hFixed || !rotated)) fixed.height = round2(node.absoluteBoundingBox.height);
    if (fixed.width !== undefined || fixed.height !== undefined) out.fixedSize = fixed;
  }

  // dump v1.7: INSTANCE primary fill — the stub-paint gap: a stub with
  // observed geometry but no paint renders invisible. Read-only subtree walk,
  // first node with a visible SOLID, reusing dumpPaint (alias + alpha;
  // nodePath null suppresses per-node degradation spam). Stroke-aware: when
  // NO node in the subtree carries a visible SOLID fill (line icons draw
  // with strokes only), the first visible SOLID stroke carries instead,
  // flagged { stroke: true, weight } (first stroke's weight) so the
  // inversion renders it as a border, never a background; a CIRCULAR
  // stroke source adds { ellipse: true } — an OBSERVED-geometry witness
  // (ELLIPSE node type, or a VECTOR whose network is a pure ring: >= 4
  // vertices equidistant from their centroid, every segment an arc with
  // nonzero tangent handles — straight-line icons like x/plus/arrow have
  // zero tangents and never qualify) that makes a circular border-radius
  // DERIVABLE downstream (corner radius inside an instance is otherwise
  // uncaptured; nothing is inferred from names).
  const isCircularStrokeSource = (n) => {
    try {
      if (n.type === 'ELLIPSE') return true;
      if (n.type !== 'VECTOR' || !n.vectorNetwork) return false;
      if (typeof n.width !== 'number' || typeof n.height !== 'number' || Math.abs(n.width - n.height) > 0.5) return false;
      const vs = n.vectorNetwork.vertices, segs = n.vectorNetwork.segments;
      if (!vs || vs.length < 4 || !segs || segs.length < vs.length) return false;
      let cx = 0, cy = 0;
      for (const v of vs) { cx += v.x; cy += v.y; }
      cx /= vs.length; cy /= vs.length;
      const r0 = Math.hypot(vs[0].x - cx, vs[0].y - cy);
      if (r0 <= 0) return false;
      for (const v of vs) {
        if (Math.abs(Math.hypot(v.x - cx, v.y - cy) - r0) > 0.02 * r0 + 0.1) return false;
      }
      for (const s of segs) {
        const ts = s.tangentStart, te = s.tangentEnd;
        if (!ts || !te || Math.hypot(ts.x, ts.y) < 0.1 || Math.hypot(te.x, te.y) < 0.1) return false;
      }
      return true;
    } catch (e) { return false; }
  };
  if (node.type === 'INSTANCE' && typeof node.findAll === 'function') {
    try {
      const kids = [node].concat(node.findAll(function () { return true; })).slice(0, 60);
      let strokePaint = null;
      for (const n of kids) {
        if ('fills' in n && Array.isArray(n.fills)
            && n.fills.some(function (p) { return p.visible !== false && p.type === 'SOLID'; })) {
          const paint = await dumpPaint(n.fills, null, 'fill', n);
          if (paint) { out.instancePrimaryFill = paint; break; }
        }
        if (!strokePaint && 'strokes' in n && Array.isArray(n.strokes)
            && n.strokes.some(function (p) { return p.visible !== false && p.type === 'SOLID'; })) {
          const paint = await dumpPaint(n.strokes, null, 'stroke', n);
          if (paint) {
            strokePaint = Object.assign({}, paint, { stroke: true, weight: typeof n.strokeWeight === 'number' ? round2(n.strokeWeight) : 1 });
            if (isCircularStrokeSource(n)) {
              strokePaint.ellipse = true;
              // The ring's OBSERVED geometry: the source node's own box
              // (`src`) and stroke alignment — captured ONLY when the source
              // sits centered in the instance (verified via absolute boxes),
              // so downstream can place the ring at the drawn radius rather
              // than the instance edge. Observed facts, nothing assumed.
              try {
                const ib = node.absoluteBoundingBox, sb = n.absoluteBoundingBox;
                if (ib && sb) {
                  const l = sb.x - ib.x, r = (ib.x + ib.width) - (sb.x + sb.width);
                  const t = sb.y - ib.y, btm = (ib.y + ib.height) - (sb.y + sb.height);
                  if (Math.abs(l - r) <= 0.5 && Math.abs(t - btm) <= 0.5 && Math.abs(l - t) <= 0.5) {
                    strokePaint.src = round2(sb.width);
                    if (typeof n.strokeAlign === 'string') strokePaint.align = n.strokeAlign;
                  }
                }
              } catch (e) { /* src stays uncaptured — border fallback downstream */ }
            }
          }
        }
      }
      if (!out.instancePrimaryFill && strokePaint) out.instancePrimaryFill = strokePaint;
    } catch (e) { /* walk refused — stays a stub-paint degradation */ }
  }

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
    // dump v1.12: WRAPPING. `core/emit-figma-script.ts` has written
    // `node.layoutWrap = 'WRAP'` from a contract's `layout.wrap` since v15, and
    // nothing here ever read it back — so a wrapping row went to the canvas
    // correctly, came back as a single non-wrapping line, and NOTHING said so.
    // It survived because it is RARE, not absent: exactly ONE of 804 committed
    // contracts carries layout.wrap (ds.composite-modal's tags row — the very
    // archetype), so it was reproducible against a committed artifact the whole
    // time. An earlier draft of this comment claimed ZERO, which was a bad
    // walker of mine, not a fact.
    if (node.layoutWrap === 'WRAP') {
      out.layout.wrap = true;
      // Figma's counterAxisSpacing is null when it FOLLOWS itemSpacing, which
      // is the same shape as a single CSS `gap`. Only a distinct row gap is a
      // separate fact, so only that is captured.
      if (typeof node.counterAxisSpacing === 'number' && node.counterAxisSpacing !== node.itemSpacing) {
        out.layout.rowSpacing = node.counterAxisSpacing;
      }
      // counterAxisAlignContent has NO dump projection and no contract
      // vocabulary — say so rather than let the default pass for the drawing.
      if (node.counterAxisAlignContent === 'SPACE_BETWEEN') {
        degrade('wrap-align-content-unsupported', nodePath, 'counterAxisAlignContent SPACE_BETWEEN on a WRAPPING stack is not captured (dump v1.12 carries layoutWrap and a distinct counterAxisSpacing only) — the wrapped LINES render packed rather than distributed');
      }
    }
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
    // dump v1.16: the fill STACK — first visible SOLID plus a GRADIENT_LINEAR
    // above it (see dumpFillStack). Solid-only stacks are byte-identical to
    // the v1.15 projection.
    const stack = 'fills' in node ? await dumpFillStack(node, nodePath) : { fill: null, gradient: null };
    const fill = stack.fill;
    if (fill) out.fill = fill;
    if (stack.gradient) out.gradient = stack.gradient;
    // dump v1.7: IMAGE-fill marker — photo avatars were pure degradations.
    // dump v1.9: the marker carries the paint's imageHash (the exported
    // asset's name) — ONLY for scaleMode FILL paints, so a hash downstream
    // IMPLIES CSS background-size: cover as an observed fact. A hashless
    // paint or any other scaleMode (FIT/CROP/TILE — no cover equivalence)
    // keeps the boolean marker and downstream renders the documented
    // placeholder gradient instead.
    if (!fill && 'fills' in node && Array.isArray(node.fills)) {
      const img = node.fills.find(function (p) { return p.visible !== false && p.type === 'IMAGE'; });
      if (img) out.imageFill = typeof img.imageHash === 'string' && img.imageHash !== '' && img.scaleMode === 'FILL' ? img.imageHash : true;
    }
  }
  const stroke = 'strokes' in node ? await dumpPaint(node.strokes, nodePath, 'stroke', node) : null;
  if (stroke) {
    out.stroke = stroke;
    if (typeof node.strokeWeight === 'number') out.strokeWeight = node.strokeWeight;
    // dump v1.11: EVERY stroke carries its ALIGNMENT — the channel that
    // decides whether the weight is drawn inside the node box, centred on
    // its edge, or outside it. INSIDE is captured too, explicitly, because
    // the alternative is what this channel cost the kit for eight rounds: an
    // absent field read as "INSIDE" by assumption. Untitled UI's Avatar
    // focus ring is OUTSIDE, so every focused reference export is exactly
    // 8px larger than the box the dump recorded (4px ring x 2 sides) while
    // the CSS `border` it lowered to, under the emitted global
    // `box-sizing: border-box`, drew INWARD and ate the photo. That was
    // 2.686 kit points of pixel loss with a receipt so generic
    // (`stroke-style-unsupported`, shared with dashPattern) that no gate,
    // ledger or fixture could see the alignment was the cause.
    if (typeof node.strokeAlign === 'string') out.strokeAlign = node.strokeAlign;
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
      // OUTSIDE and INSIDE both LOWER (outline / border). CENTER does not:
      // it straddles the edge, half the weight each side, and CSS has no
      // spelling for that — `border` draws wholly inward and `outline`
      // wholly outward. The FACT is carried above either way; what is
      // refused is the lowering, and it is refused under its OWN code so
      // the boundary is countable rather than folded into a shared one.
      if (node.strokeAlign === 'CENTER') {
        degrade('stroke-align-unsupported', nodePath, 'strokeAlign CENTER — a centred stroke draws half its weight inside the box and half outside; CSS border draws wholly inward and outline wholly outward, so neither carries it exactly. The alignment is CAPTURED (dump v1.11) and the LOWERING is refused: the node renders an INSIDE border');
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
    // dump v1.16: UPPER/LOWER/TITLE are CAPTURED (text.textCase below — the
    // canvas fact behind CSS text-transform); SMALL_CAPS[_FORCED] has no CSS
    // text-transform twin and stays a receipt.
    const TEXT_CASE_CAPTURED = { UPPER: true, LOWER: true, TITLE: true };
    if (node.textCase !== figma.mixed && node.textCase && node.textCase !== 'ORIGINAL' && !TEXT_CASE_CAPTURED[node.textCase]) channels.push('textCase ' + node.textCase);
    if (node.textDecoration !== figma.mixed && node.textDecoration && node.textDecoration !== 'NONE') channels.push('textDecoration ' + node.textDecoration);
    if (node.lineHeight !== figma.mixed && node.lineHeight && node.lineHeight.unit !== 'AUTO' && node.lineHeight.unit !== 'PIXELS') {
      channels.push('lineHeight ' + node.lineHeight.value + node.lineHeight.unit + ' — only PIXELS carries, dump v1.3');
    }
    // CLOSURE GATE (extract/figma/channel-closure-check.ts). `text-align` and
    // `text-overflow` are DECLARED_CHANNELS the canvas DRAWS — the emitter
    // writes textAlignHorizontal and textTruncation back to Figma — and no
    // reader mentioned either property, so a designer's centred label or
    // authored ellipsis vanished on the return leg with no receipt. Named here
    // rather than carried: naming closes the SILENT hole, which is the bar;
    // carrying them is a follow-up with its own measured value.
    if (node.textAlignHorizontal && node.textAlignHorizontal !== 'LEFT') {
      channels.push('textAlignHorizontal ' + node.textAlignHorizontal);
    }
    if (node.textAlignVertical && node.textAlignVertical !== 'TOP') {
      channels.push('textAlignVertical ' + node.textAlignVertical);
    }
    if (node.textTruncation && node.textTruncation !== 'DISABLED') {
      channels.push('textTruncation ' + node.textTruncation + (typeof node.maxLines === 'number' ? ' maxLines ' + node.maxLines : ''));
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
    if (node.textCase !== figma.mixed && TEXT_CASE_CAPTURED[node.textCase]) text.textCase = node.textCase;
    if (node.textStyleId && node.textStyleId !== figma.mixed) {
      const style = await figma.getStyleByIdAsync(node.textStyleId);
      if (style) {
        text.style = style.name;
        const sourceKey = style.getSharedPluginData('ds_contracts', 'sourceTextStyleKey');
        if (sourceKey) text.styleKey = sourceKey;
        else if (typeof style.key === 'string' && style.key) text.styleKey = style.key;
      }
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
      // dump v1.5: rename-safe identity — the main component's publish key
      // and its owning set's key; the session-linking resolver matches these
      // against in-scope contracts' anchors (componentSetKey first).
      if (main.key) out.instanceKey = main.key;
      if (main.parent && main.parent.type === 'COMPONENT_SET' && main.parent.key) {
        out.instanceSetKey = main.parent.key;
      }
    }
    // dump v1.5: OBSERVED bounding box — honest geometry for child stubs
    // (dump v1 still never recurses into instance internals).
    if (typeof node.width === 'number' && typeof node.height === 'number') {
      out.bbox = { width: round2(node.width), height: round2(node.height) };
    }
    // dump v1.1: applied property values, so component refs keep fixed props.
    // dump v1.5: keys keep their "#id" suffix (the Plugin API's own spelling)
    // — a suffixed string key is a TEXT property with certainty; stripping
    // collapsed TEXT and VARIANT properties into one ambiguous shape.
    try {
      const props = {};
      for (const [key, def] of Object.entries(node.componentProperties || {})) {
        if (def.type === 'INSTANCE_SWAP') continue; // slots ride propRefs instead
        props[key] = def.value;
      }
      if (Object.keys(props).length > 0) out.componentProperties = props;
    } catch (e) {
      // componentProperties can throw on detached/broken instances — dump v1
      // fixtures shipped without this field, so absence is always tolerated.
    }
    // dump v1.10: TEXT OVERRIDES — the one channel a child component with no
    // TEXT property leaves nowhere else to land. InstanceNode.overrides is
    // Figma's OWN record of what this host changed; we filter it to
    // 'characters' and resolve each reported id against this instance's TEXT
    // descendants (the single targeted walk — names only, no styling, no
    // structure). Nothing is diffed against the main component: an entry
    // present here is an override BY FIGMA'S ACCOUNT.
    try {
      const overridden = {};
      let overriddenCount = 0;
      for (const o of node.overrides || []) {
        if (o && o.id && Array.isArray(o.overriddenFields) && o.overriddenFields.indexOf('characters') >= 0) {
          overridden[o.id] = true;
          overriddenCount++;
        }
      }
      if (overriddenCount > 0 && typeof node.findAll === 'function') {
        const textOverrides = {};
        let located = 0;
        for (const t of node.findAll(function (n) { return n.type === 'TEXT'; }).slice(0, 60)) {
          if (!overridden[t.id]) continue;
          const seg = [];
          for (let p = t; p && p.id !== node.id; p = p.parent) seg.unshift(p.name);
          // A duplicate name path is ambiguous — the LAST writer would win
          // silently, so the whole path is refused by name instead.
          if (Object.prototype.hasOwnProperty.call(textOverrides, seg.join('/'))) {
            degrade('text-override-ambiguous-path', nodePath, 'two text descendants of this instance share the name path "' + seg.join('/') + '" — both character overrides refused (a name path must identify one node)');
            textOverrides[seg.join('/')] = null;
            located++;
            continue;
          }
          textOverrides[seg.join('/')] = t.characters;
          located++;
        }
        for (const k of Object.keys(textOverrides)) if (textOverrides[k] === null) delete textOverrides[k];
        if (Object.keys(textOverrides).length > 0) out.textOverrides = textOverrides;
        if (located < overriddenCount) {
          degrade('text-override-unlocated', nodePath, (overriddenCount - located) + ' of ' + overriddenCount + ' character override(s) reported by InstanceNode.overrides could not be matched to a TEXT descendant of this instance (hidden branch, or past the 60-node walk cap) — not captured');
        }
      }
    } catch (e) {
      degrade('text-override-unreadable', nodePath, 'InstanceNode.overrides threw — per-instance character overrides not captured for this instance (the child renders its own default characters)');
    }
  }

  if ('children' in node && node.type !== 'INSTANCE') {
    out.children = [];
    for (const child of node.children) out.children.push(await dumpNode(child, nodePath + '/' + child.name, node));
  }
  return out;
}

// dump v1.5: set-level INSTANCE_SWAP preferredValues (component keys →
// slot `accepts` downstream) and BOOLEAN property defaults (the one
// property default the variants alone cannot recover — visibility-bound
// boolean props). Definitions can throw on broken sets — tolerated, the
// channels are additive.
function dumpPropertyDefinitions(node) {
  const out = { propertyDefinitions: {}, swapPreferredValues: {}, boolDefaults: {} };
  try {
    for (const [propName, def] of Object.entries(node.componentPropertyDefinitions || {})) {
      const name = propName.split('#')[0];
      const captured = { type: def.type, defaultValue: def.defaultValue };
      if (def.type === 'VARIANT' && Array.isArray(def.variantOptions)) {
        captured.variantOptions = def.variantOptions.map(String);
      }
      if ((def.type === 'INSTANCE_SWAP' || def.type === 'SLOT') && Array.isArray(def.preferredValues) && def.preferredValues.length > 0) {
        captured.preferredValues = def.preferredValues.map((v) => ({ type: v.type, key: v.key }));
      }
      if (def.type === 'SLOT') {
        if (typeof def.description === 'string') captured.description = def.description;
        if (def.slotSettings && typeof def.slotSettings === 'object') captured.slotSettings = def.slotSettings;
      }
      out.propertyDefinitions[propName] = captured;
      if (def.type === 'INSTANCE_SWAP' && Array.isArray(def.preferredValues) && def.preferredValues.length > 0) {
        out.swapPreferredValues[name] = def.preferredValues.map((v) => ({ type: v.type, key: v.key }));
      }
      if (def.type === 'BOOLEAN' && typeof def.defaultValue === 'boolean') {
        out.boolDefaults[name] = def.defaultValue;
      }
    }
  } catch (e) {
    // componentPropertyDefinitions throws on some non-set components —
    // absence of the channels means not captured, a declared limit.
  }
  return out;
}

const dumps = {
  _provenance: {
    fileKey: figma.fileKey || null,
    extractedAt: new Date().toISOString().slice(0, 10),
    note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.16) for design→contract proposal.',
    dumpVersion: '1.16',
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
      for (const variant of node.children) variants.push(await dumpNode(variant, node.name + ':' + variant.name, node));
    } else {
      variants.push(await dumpNode(node, node.name + ':' + node.name));
    }
    const defs = dumpPropertyDefinitions(node);
    dumps[node.name] = {
      setName: node.name,
      type: node.type,
      nodeId: node.id,
      key: node.key,
      variants,
    };
    if (Object.keys(defs.propertyDefinitions).length > 0) dumps[node.name].propertyDefinitions = defs.propertyDefinitions;
    if (Object.keys(defs.swapPreferredValues).length > 0) dumps[node.name].swapPreferredValues = defs.swapPreferredValues;
    if (Object.keys(defs.boolDefaults).length > 0) dumps[node.name].boolDefaults = defs.boolDefaults;
  }
}
return dumps;
