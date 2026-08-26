/**
 * CANVAS-USABLE PROBE — the bytes an agent runs through the figma-console
 * bridge to MEASURE whether a minted set behaves like a real Figma component.
 *
 * WHY THIS FILE IS A .plugin.js AND NOT A GATE STEP.
 *   docs/31 §6: the figma-console bridge speaks MCP over stdio to its own
 *   client and WebSocket to plugin clients. A Node process is neither, so the
 *   gate (scripts/canvas-usable-check.ts) can never drive the canvas itself.
 *   An agent holding the MCP tools runs THIS file's body through
 *   `figma_execute` once per PAGE (all of that page's sets in one batch) and
 *   commits each returned observation as
 *   `parity/receipts/v1/usable/<library>/<id>.json`. The gate is a pure
 *   READER of those observations: it computes the four verdicts, adjudicates
 *   assertion 4 against the contract, and refuses BY NAME for any row that
 *   has no observation.
 *
 * HOW TO RUN IT
 *   const body = readFileSync('extract/figma/census/usable-probe.plugin.js','utf8')
 *     .replace('__USABLE_TARGETS__', JSON.stringify(setNodeIds))
 *     .replace('__USABLE_PAGE__',    JSON.stringify(pageName));
 *   figma_execute({ code: body, timeout: 30000 })
 *   → { canvasBefore, canvasAfter, canvasRestored, observations: [...] }
 *   Split `observations` into one file per row with
 *   `npx tsx extract/figma/census/usable-record.ts <batch.json>`.
 *
 * WHAT IT OBSERVES (it decides NOTHING — every verdict is the gate's):
 *   1. reflow      — the variant COMPONENT is resized on both axes, every
 *                    child's box is measured before and after, and the node is
 *                    restored to its exact original size AND sizing modes. A
 *                    page-wide signature is hashed before and after so the
 *                    gate can prove the canvas was left byte-identical.
 *   2. variants    — one instance is created off-canvas, driven across every
 *                    value of every axis in `variantGroupProperties`, each
 *                    render fingerprinted (geometry / fills / text kept
 *                    separate), then removed.
 *   3. binding     — every fill, stroke, spacing, sizing and corner-radius
 *                    channel that actually CARRIES a value is classified
 *                    bound / inferred / literal from `boundVariables` and
 *                    `inferredVariables`.
 *   4. layoutFacts — every node's `layoutPositioning` and its parent's
 *                    `layoutMode`, so the gate can cross-examine the contract.
 *
 * WRITES IT MAKES, AND UNMAKES: one resize (restored), one instance (removed).
 * Nothing else. It refuses to run against any file but the scratch project.
 */
const TARGET_IDS = __USABLE_TARGETS__;
const PAGE_NAME = __USABLE_PAGE__;
const SCRATCH_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PROBE_VERSION = 1;
/** How far off-canvas the throwaway instance is parked. */
const INSTANCE_PARK = 100000;
/** Deterministic cap on named literal sites carried in the observation. */
const LITERAL_SITE_CAP = 24;

if (figma.fileKey !== SCRATCH_FILE_KEY) {
  throw new Error(
    "REFUSED: canvas-usable probe may only run in the scratch project " +
      SCRATCH_FILE_KEY +
      " (current file " +
      figma.fileKey +
      ")",
  );
}
await figma.loadAllPagesAsync();

const page = figma.root.children.find((p) => p.name === PAGE_NAME);
if (!page) throw new Error("REFUSED: no page named " + PAGE_NAME);

// --- tiny deterministic digest (djb2/xor, hex) -----------------------------
const digest = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  let g = 0x811c9dc5;
  for (let i = s.length - 1; i >= 0; i--) {
    g ^= s.charCodeAt(i);
    g = (g * 0x01000193) >>> 0;
  }
  return (
    (h >>> 0).toString(16).padStart(8, "0") +
    (g >>> 0).toString(16).padStart(8, "0")
  );
};
const r2 = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : n);

// --- page-wide signature (the restoration proof) ---------------------------
const pageSignature = () => {
  const parts = [];
  let count = 0;
  const walk = (n, depth) => {
    count++;
    parts.push(
      [
        depth,
        n.id,
        n.name,
        n.type,
        r2(n.x),
        r2(n.y),
        r2(n.width),
        r2(n.height),
        "layoutMode" in n ? n.layoutMode : "-",
        "itemSpacing" in n ? r2(n.itemSpacing) : "-",
        "characters" in n ? n.characters : "-",
      ].join(""),
    );
    if ("children" in n) for (const c of n.children) walk(c, depth + 1);
  };
  for (const c of page.children) walk(c, 0);
  return { nodes: count, sig: digest(parts.join("")) };
};

// --- node helpers ----------------------------------------------------------
const paintDigest = (paints) => {
  if (paints === figma.mixed) return "MIXED";
  if (!Array.isArray(paints)) return "-";
  return paints
    .map((p) => {
      if (p.type === "SOLID") {
        const c = p.color;
        return (
          "S:" +
          [r2(c.r * 255), r2(c.g * 255), r2(c.b * 255), r2(p.opacity ?? 1)].join(
            ",",
          ) +
          (p.visible === false ? ":hidden" : "")
        );
      }
      return p.type + (p.visible === false ? ":hidden" : "");
    })
    .join("|");
};

const boxOf = (node, origin) => ({
  id: node.id,
  name: node.name,
  type: node.type,
  x: r2(node.x),
  y: r2(node.y),
  w: r2(node.width),
  h: r2(node.height),
  ax: r2(node.absoluteBoundingBox ? node.absoluteBoundingBox.x - origin.x : 0),
  ay: r2(node.absoluteBoundingBox ? node.absoluteBoundingBox.y - origin.y : 0),
  visible: node.visible !== false,
});

/** Every descendant, depth-first, with a stable slash path. */
const descendants = (root) => {
  const out = [];
  const walk = (n, path) => {
    if ("children" in n)
      n.children.forEach((c, i) => {
        const p = path + "/" + (c.name || c.type) + "[" + i + "]";
        out.push({ node: c, path: p, parent: n });
        walk(c, p);
      });
  };
  walk(root, "");
  return out;
};

const before = pageSignature();
const observations = [];
for (const TARGET_ID of TARGET_IDS) {
// --- resolve the target ----------------------------------------------------
const setNode = await figma.getNodeByIdAsync(TARGET_ID);
if (!setNode) throw new Error("REFUSED: no node " + TARGET_ID);
let axes = null;
let axesError = null;
if (setNode.type === "COMPONENT_SET") {
  try {
    const vgp = setNode.variantGroupProperties;
    axes = Object.keys(vgp).map((k) => ({ axis: k, values: vgp[k].values }));
  } catch (e) {
    axesError = String((e && e.message) || e);
  }
}
/** The layout container under test: a set's first variant, or the component. */
const variantNode =
  setNode.type === "COMPONENT_SET" ? setNode.children[0] : setNode;

const observation = {
  probeVersion: PROBE_VERSION,
  fileKey: figma.fileKey,
  page: PAGE_NAME,
  setNodeId: setNode.id,
  setName: setNode.name,
  setType: setNode.type,
  variantNodeId: variantNode ? variantNode.id : null,
  variantNodeName: variantNode ? variantNode.name : null,
  axes,
  axesError,
  variantChildCount: setNode.type === "COMPONENT_SET" ? setNode.children.length : 1,
  variantChildNames:
    setNode.type === "COMPONENT_SET" ? setNode.children.map((c) => c.name) : [setNode.name],
};

// ===========================================================================
// 1. REFLOW
// ===========================================================================
const reflow = { target: variantNode ? variantNode.id : null };
if (!variantNode) {
  reflow.error = "set has no variant child";
} else {
  const origin = variantNode.absoluteBoundingBox || { x: 0, y: 0 };
  const kids = "children" in variantNode ? variantNode.children : [];
  reflow.targetName = variantNode.name;
  reflow.layoutMode = "layoutMode" in variantNode ? variantNode.layoutMode : "NONE";
  reflow.childCount = kids.length;
  reflow.sizing = {
    h: "layoutSizingHorizontal" in variantNode ? variantNode.layoutSizingHorizontal : null,
    v: "layoutSizingVertical" in variantNode ? variantNode.layoutSizingVertical : null,
    primary: "primaryAxisSizingMode" in variantNode ? variantNode.primaryAxisSizingMode : null,
    counter: "counterAxisSizingMode" in variantNode ? variantNode.counterAxisSizingMode : null,
    primaryAlign: "primaryAxisAlignItems" in variantNode ? variantNode.primaryAxisAlignItems : null,
    counterAlign: "counterAxisAlignItems" in variantNode ? variantNode.counterAxisAlignItems : null,
  };
  const w0 = variantNode.width;
  const h0 = variantNode.height;
  reflow.before = {
    w: r2(w0),
    h: r2(h0),
    children: kids.map((k) => boxOf(k, origin)),
  };
  const dw = 40;
  const dh = 40;
  let resizeError = null;
  try {
    variantNode.resize(w0 + dw, h0 + dh);
  } catch (e) {
    resizeError = String((e && e.message) || e);
  }
  reflow.resizedBy = { dw, dh };
  reflow.resizeError = resizeError;
  if (!resizeError) {
    const origin2 = variantNode.absoluteBoundingBox || { x: 0, y: 0 };
    reflow.after = {
      w: r2(variantNode.width),
      h: r2(variantNode.height),
      children: kids.map((k) => boxOf(k, origin2)),
    };
    const same = (a, b) =>
      a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    reflow.responded = [];
    reflow.frozen = [];
    for (let i = 0; i < reflow.before.children.length; i++) {
      const b = reflow.before.children[i];
      const a = reflow.after.children[i];
      if (!a) continue;
      if (same(b, a)) reflow.frozen.push(b.name);
      else
        reflow.responded.push({
          name: b.name,
          dx: r2(a.x - b.x),
          dy: r2(a.y - b.y),
          dw: r2(a.w - b.w),
          dh: r2(a.h - b.h),
        });
    }
    // --- restore, exactly ---
    try {
      variantNode.resize(w0, h0);
      if ("layoutSizingHorizontal" in variantNode && reflow.sizing.h)
        variantNode.layoutSizingHorizontal = reflow.sizing.h;
      if ("layoutSizingVertical" in variantNode && reflow.sizing.v)
        variantNode.layoutSizingVertical = reflow.sizing.v;
      reflow.restoreError = null;
    } catch (e) {
      reflow.restoreError = String((e && e.message) || e);
    }
    reflow.restoredTo = { w: r2(variantNode.width), h: r2(variantNode.height) };
    reflow.restoredExact =
      r2(variantNode.width) === r2(w0) && r2(variantNode.height) === r2(h0);
  }
}
observation.reflow = reflow;

// ===========================================================================
// 2. VARIANT SWITCHING
// ===========================================================================
const fingerprint = (root) => {
  const origin = root.absoluteBoundingBox || { x: 0, y: 0 };
  const geo = [];
  const fill = [];
  const text = [];
  const all = [{ node: root, path: "" }].concat(descendants(root));
  for (const { node: n, path } of all) {
    const bb = n.absoluteBoundingBox;
    geo.push(
      path +
        "=" +
        [
          n.type,
          bb ? r2(bb.x - origin.x) : "-",
          bb ? r2(bb.y - origin.y) : "-",
          r2(n.width),
          r2(n.height),
          n.visible === false ? "hidden" : "shown",
          "cornerRadius" in n && n.cornerRadius !== figma.mixed
            ? r2(n.cornerRadius)
            : "-",
        ].join(","),
    );
    fill.push(
      path +
        "=" +
        ("fills" in n ? paintDigest(n.fills) : "-") +
        ";" +
        ("strokes" in n ? paintDigest(n.strokes) : "-"),
    );
    if ("characters" in n) text.push(path + "=" + n.characters);
  }
  return {
    geometry: digest(geo.join("\n")),
    fills: digest(fill.join("\n")),
    text: digest(text.join("\n")),
  };
};

const variants = { attempted: false };
try {
  variants.attempted = true;
  let instance = null;
  if (setNode.type === "COMPONENT_SET") {
    const def = setNode.defaultVariant || setNode.children[0];
    instance = def.createInstance();
  } else if (setNode.type === "COMPONENT") {
    instance = setNode.createInstance();
  }
  if (!instance) throw new Error("target is " + setNode.type + ", not instantiable");
  page.appendChild(instance);
  instance.x = INSTANCE_PARK;
  instance.y = INSTANCE_PARK;
  variants.instantiable = true;
  variants.instanceId = instance.id;
  variants.baseline = fingerprint(instance);
  variants.axes = [];
  if (axes) {
    const baseProps = {};
    for (const a of axes)
      baseProps[a.axis] = instance.componentProperties[a.axis]
        ? instance.componentProperties[a.axis].value
        : a.values[0];
    for (const a of axes) {
      const row = { axis: a.axis, values: [], errors: [] };
      for (const v of a.values) {
        const props = Object.assign({}, baseProps);
        props[a.axis] = v;
        try {
          instance.setProperties(props);
          row.values.push(Object.assign({ value: v }, fingerprint(instance)));
        } catch (e) {
          row.errors.push({ value: v, error: String((e && e.message) || e) });
        }
      }
      // restore this axis before moving to the next
      try {
        instance.setProperties(baseProps);
      } catch (e) {
        row.errors.push({ value: "<restore>", error: String((e && e.message) || e) });
      }
      variants.axes.push(row);
    }
  }
  instance.remove();
  variants.instanceRemoved = true;
} catch (e) {
  variants.instantiable = variants.instantiable === true;
  variants.error = String((e && e.message) || e);
  // best effort cleanup
  try {
    if (variants.instanceId) {
      const stray = await figma.getNodeByIdAsync(variants.instanceId);
      if (stray && !stray.removed) {
        stray.remove();
        variants.instanceRemoved = true;
      }
    }
  } catch (e2) {
    variants.cleanupError = String((e2 && e2.message) || e2);
  }
}
observation.variants = variants;

// ===========================================================================
// 3. TOKEN BINDING
// ===========================================================================
const bindingSites = [];
const classify = (node, field, index) => {
  const bv = node.boundVariables || {};
  const iv = node.inferredVariables || {};
  if (index === undefined) {
    if (bv[field]) return "bound";
    if (iv[field] && iv[field].length) return "inferred";
    return "literal";
  }
  const b = bv[field];
  if (Array.isArray(b) && b[index]) return "bound";
  const i = iv[field];
  if (Array.isArray(i) && i[index] && i[index].length) return "inferred";
  return "literal";
};
const noteSite = (path, node, group, channel, state, value) => {
  bindingSites.push({
    path: path || "/" + node.name,
    node: node.name,
    group,
    channel,
    state,
    value: String(value),
  });
};

const bindingRoots = [{ node: variantNode, path: "" }].concat(
  variantNode ? descendants(variantNode) : [],
);
for (const { node: n, path } of bindingRoots) {
  if (!n) continue;
  const p = path || "/" + n.name;
  // fills / strokes — one site per paint that actually paints
  if ("fills" in n && n.fills !== figma.mixed && Array.isArray(n.fills)) {
    n.fills.forEach((paint, i) => {
      if (paint.visible === false) return;
      const state =
        paint.type === "SOLID"
          ? paint.boundVariables && paint.boundVariables.color
            ? "bound"
            : classify(n, "fills", i)
          : classify(n, "fills", i);
      noteSite(p, n, "fills", "fills[" + i + "]", state, paint.type);
    });
  }
  if ("strokes" in n && Array.isArray(n.strokes)) {
    n.strokes.forEach((paint, i) => {
      if (paint.visible === false) return;
      const state =
        paint.boundVariables && paint.boundVariables.color
          ? "bound"
          : classify(n, "strokes", i);
      noteSite(p, n, "strokes", "strokes[" + i + "]", state, paint.type);
    });
    if (n.strokes.length > 0 && "strokeWeight" in n && n.strokeWeight !== figma.mixed)
      noteSite(p, n, "strokes", "strokeWeight", classify(n, "strokeWeight"), n.strokeWeight);
  }
  // spacing — only where auto-layout actually consumes it
  if ("layoutMode" in n && n.layoutMode !== "NONE") {
    if (n.itemSpacing !== 0 || n.children.length > 1)
      noteSite(p, n, "spacing", "itemSpacing", classify(n, "itemSpacing"), n.itemSpacing);
    for (const side of ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"])
      if (n[side] !== 0) noteSite(p, n, "spacing", side, classify(n, side), n[side]);
  }
  // sizing — only where the dimension is FIXED (a hug/fill is not a literal)
  if ("layoutSizingHorizontal" in n && n.layoutSizingHorizontal === "FIXED")
    noteSite(p, n, "sizing", "width", classify(n, "width"), r2(n.width));
  else if (!("layoutSizingHorizontal" in n) && "width" in n)
    noteSite(p, n, "sizing", "width", classify(n, "width"), r2(n.width));
  if ("layoutSizingVertical" in n && n.layoutSizingVertical === "FIXED")
    noteSite(p, n, "sizing", "height", classify(n, "height"), r2(n.height));
  else if (!("layoutSizingVertical" in n) && "height" in n)
    noteSite(p, n, "sizing", "height", classify(n, "height"), r2(n.height));
  for (const m of ["minWidth", "maxWidth", "minHeight", "maxHeight"])
    if (m in n && n[m] !== null && n[m] !== undefined)
      noteSite(p, n, "sizing", m, classify(n, m), n[m]);
  // corner radii — only where a corner is actually rounded
  for (const c of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"])
    if (c in n && n[c] > 0) noteSite(p, n, "radius", c, classify(n, c), n[c]);
}

const groups = {};
for (const s of bindingSites) {
  const g = (groups[s.group] = groups[s.group] || { bound: 0, inferred: 0, literal: 0 });
  g[s.state]++;
}
const literalSites = bindingSites
  .filter((s) => s.state === "literal")
  .map((s) => s.path + "·" + s.channel + "=" + s.value);
observation.binding = {
  total: bindingSites.length,
  bound: bindingSites.filter((s) => s.state === "bound").length,
  inferred: bindingSites.filter((s) => s.state === "inferred").length,
  literal: literalSites.length,
  byGroup: groups,
  literalSites: literalSites.slice(0, LITERAL_SITE_CAP),
  literalSitesTruncated: Math.max(0, literalSites.length - LITERAL_SITE_CAP),
};

// ===========================================================================
// 4. LAYOUT FACTS (the gate adjudicates these against the contract)
// ===========================================================================
observation.layoutFacts = bindingRoots
  .filter((e) => e.node)
  .map(({ node: n, path }) => ({
    path: path || "/" + n.name,
    name: n.name,
    type: n.type,
    layoutPositioning: "layoutPositioning" in n ? n.layoutPositioning : null,
    layoutMode: "layoutMode" in n ? n.layoutMode : null,
    childCount: "children" in n ? n.children.length : 0,
    w: r2(n.width),
    h: r2(n.height),
    visible: n.visible !== false,
    parentLayoutMode:
      n.parent && "layoutMode" in n.parent ? n.parent.layoutMode : null,
    parentType: n.parent ? n.parent.type : null,
  }));

observations.push(observation);
}

const after = pageSignature();
return {
  page: PAGE_NAME,
  fileKey: figma.fileKey,
  probeVersion: PROBE_VERSION,
  canvasBefore: before,
  canvasAfter: after,
  canvasRestored: after.sig === before.sig && after.nodes === before.nodes,
  observations,
};
