// THE PLUGIN CAPTURE (docs/GOAL.md Step 2): reference images and fonts for one
// component set, read in the plugin sandbox from a draft the owner
// duplicated. Read-only: it only calls exportAsync and reads node properties.
// Embedded VERBATIM in figma-sync/plugin/ui.html (drift-guarded by
// scripts/build-plugin-zip.mjs), which sets CAPTURE_SET and offers the result as
// <set>.capture.json beside the dump; variables come from the dump itself.
//
//  - box: a PNG of each variant's layout box at scale 1 (useAbsoluteBounds),
//    with `wholePixel` saying whether the box sits on whole pixels. A
//    fractional box is named, never rounded here.
//  - paint: when paint reaches past the layout box (outside strokes, shadows),
//    a second PNG of the painted extent and its offset from the box.
//  - after: both boxes read again once the exports are done, so the check can
//    refuse a capture whose node moved while it was being exported.
//  - fonts: every family and style the set's text draws, hidden layers included
//    (a true/false property can show them), and whether this Figma can load it.
//  - figmaFonts: every family and style this Figma can load. The list belongs to
//    the machine, not the draft: React to Figma holds a library's rendered faces
//    against it before anything is written (scripts/font-preflight.ts).
//  - svgs and each variant's drawings: a drawing (no text, no auto layout, at
//    least one arbitrary-path vector) is built as SVG from its fillGeometry and
//    strokeGeometry, never exported: on the A0 draft (2026-11-01) one icon's SVG
//    export took 1 ms, then 152 s, and blocks the plugin. An instance is built
//    once from its main component; a hidden plain drawing is skipped. Each drawn
//    node is a <g> with its transform into the drawing's coordinates, in tree
//    order (bottom to top), and each paint a <path> per geometry path. What it
//    cannot express is refused by name: masks, gradients, image paints, effects,
//    other blend modes, opacity over several drawn nodes, clipped overflow, and
//    paint past an unclipped drawing's box (the SVG's viewBox would cut it).
// Deterministic: the same draft on the same machine gives the same bytes (two exports compared equal).
const CAPTURE_SET = '';

if (!CAPTURE_SET) throw Error('CAPTURE_SET_MISSING: the plugin sets the component set name before running');
await figma.loadAllPagesAsync();
const matches = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })
  .filter((n) => n.name === CAPTURE_SET && !(n.type === 'COMPONENT' && n.parent && n.parent.type === 'COMPONENT_SET'));
if (matches.length !== 1) throw Error('CAPTURE_SET_' + (matches.length ? 'AMBIGUOUS' : 'NOT_FOUND') + ': ' + JSON.stringify(CAPTURE_SET) + ' matches ' + matches.length + ' set(s)');
const set = matches[0];
const variants = set.type === 'COMPONENT_SET' ? set.children.filter((n) => n.type === 'COMPONENT') : [set];

const box = (b) => (b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null);
const whole = (b) => !!b && [b.x, b.y, b.width, b.height].every((n) => Number.isInteger(n));
const sameBox = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const png = async (node, useAbsoluteBounds) =>
  figma.base64Encode(await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 }, useAbsoluteBounds }));

const VECTOR_TYPES = ['VECTOR', 'STAR', 'LINE', 'BOOLEAN_OPERATION'];
const kids = (n) => ('children' in n ? n.children : []);
const drawingOf = (n) => n.type !== 'TEXT' && n.type !== 'SLOT' && !(n.layoutMode && n.layoutMode !== 'NONE') && kids(n).every(drawingOf);
const holdsVector = (n) => VECTOR_TYPES.includes(n.type) || kids(n).some(holdsVector);
const num = (n) => { const r = Math.round(n * 10000) / 10000; return String(r === 0 ? 0 : r); };
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
// Transforms as [a, b, c, d, e, f] (SVG matrix order) from Figma's [[a, c, e], [b, d, f]].
const flat = (m) => [m[0][0], m[1][0], m[0][1], m[1][1], m[0][2], m[1][2]];
const times = (p, q) => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
const inverse = ([a, b, c, d, e, f]) => { const k = a * d - b * c; return [d / k, -b / k, -c / k, a / k, (c * f - d * e) / k, (b * e - a * f) / k]; };
const refuse = (reason) => { throw Object.assign(Error(reason), { refusal: reason }); };
function buildSvg(root) {
  const toRoot = inverse(flat(root.absoluteTransform)), body = [];
  const paints = (n, list) => list.filter((p) => p.visible !== false).map((p) => {
    if (p.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(p.blendMode)) refuse('svg-blend-mode');
    if (p.type !== 'SOLID') refuse(p.type.startsWith('GRADIENT') ? 'svg-gradient' : 'svg-paint-' + p.type.toLowerCase());
    return p;
  });
  const drawn = (n) => n.visible !== false && (n.type === 'BOOLEAN_OPERATION' || !kids(n).length ? 1 : 0) + (n.type === 'BOOLEAN_OPERATION' ? 0 : kids(n).reduce((t, c) => t + drawn(c), 0));
  const walk = (n, isRoot) => {
    if (n.visible === false) return;
    if (n.isMask) refuse('svg-mask');
    if ((n.effects || []).some((e) => e.visible !== false)) refuse('svg-effect');
    if (n.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(n.blendMode)) refuse('svg-blend-mode');
    const opacity = n.opacity === undefined ? 1 : n.opacity, leaf = n.type === 'BOOLEAN_OPERATION' || !kids(n).length;
    if (!isRoot && !leaf && opacity < 1 && drawn(n) > 1) refuse('svg-group-opacity');
    const r = n.absoluteRenderBounds, b = n.absoluteBoundingBox;
    if (isRoot && !n.clipsContent && r && b && (r.x < b.x || r.y < b.y || r.x + r.width > b.x + b.width || r.y + r.height > b.y + b.height)) refuse('svg-overflow');
    if (!isRoot && !leaf && n.clipsContent && kids(n).some((c) => { const a = c.absoluteRenderBounds, b = n.absoluteBoundingBox;
      return a && b && (a.x < b.x || a.y < b.y || a.x + a.width > b.x + b.width || a.y + a.height > b.y + b.height); })) refuse('svg-clip-content');
    const layers = [[n.fillGeometry || [], paints(n, n.fills || [])], [n.strokeGeometry || [], paints(n, n.strokes || [])]];
    const shapes = layers.flatMap(([geometry, list]) => list.flatMap((p) => geometry.map((g) => `<path d="${g.data}" fill="${hex(p.color)}"` +
      (p.opacity !== undefined && p.opacity < 1 ? ` fill-opacity="${num(p.opacity)}"` : '') + ` fill-rule="${g.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}"/>`)));
    if (shapes.length) body.push(`<g transform="matrix(${times(toRoot, flat(n.absoluteTransform)).map(num).join(' ')})"` +
      (opacity < 1 && (leaf || !isRoot) ? ` opacity="${num(opacity)}"` : '') + `>${shapes.join('')}</g>`);
    if (n.type !== 'BOOLEAN_OPERATION') for (const c of kids(n)) walk(c, false);
  };
  walk(root, true);
  const [w, h] = [num(root.width), num(root.height)], whole = root.opacity !== undefined && root.opacity < 1 && kids(root).length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">` +
    (whole ? `<g opacity="${num(root.opacity)}">${body.join('')}</g>` : body.join('')) + '</svg>';
}
const svgs = new Map();
const drawingsOf = async (n, top, out) => {
  if (!top && drawingOf(n) && holdsVector(n)) {
    const main = n.type === 'INSTANCE' ? await n.getMainComponentAsync() : null;
    if (!main && n.visible === false) return;
    const target = main || n, key = (main ? 'main:' : 'node:') + target.id;
    if (!svgs.has(key)) {
      try { svgs.set(key, { key, nodeId: target.id, name: target.name, svg: buildSvg(target) }); }
      catch (e) { if (!e.refusal) throw e; svgs.set(key, { key, nodeId: target.id, name: target.name, refused: e.refusal }); }
    }
    out.push({ nodeId: n.id, svg: key });
    return;
  }
  for (const c of kids(n)) await drawingsOf(c, false, out);
};

const faces = new Map();
const captured = [];
for (const variant of variants) {
  const layout = box(variant.absoluteBoundingBox), render = box(variant.absoluteRenderBounds);
  const entry = { nodeId: variant.id, name: variant.name, box: { bounds: layout, wholePixel: whole(layout), png: await png(variant, true) } };
  if (render && !sameBox(render, layout)) {
    entry.paint = { bounds: render, offset: { x: render.x - layout.x, y: render.y - layout.y }, png: await png(variant, false) };
  }
  entry.after = { layout: box(variant.absoluteBoundingBox), render: box(variant.absoluteRenderBounds) };
  const visit = async (n) => {
    if (n.type === 'TEXT') {
      const segments = typeof n.getStyledTextSegments === 'function' ? n.getStyledTextSegments(['fontName', 'fontWeight']) : [];
      for (const s of segments) faces.set(s.fontName.family + '\u0000' + s.fontName.style, { family: s.fontName.family, style: s.fontName.style, weight: s.fontWeight });
      return;
    }
    for (const c of 'children' in n ? n.children : []) await visit(c);
  };
  await visit(variant);
  entry.drawings = [];
  await drawingsOf(variant, true, entry.drawings);
  captured.push(entry);
}
const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);
const loadable = new Map((await figma.listAvailableFontsAsync()).map((f) => [f.fontName.family + '\u0000' + f.fontName.style, { family: f.fontName.family, style: f.fontName.style }]));
const fonts = [...faces.entries()].sort(byKey).map(([key, f]) => ({ ...f, available: loadable.has(key) }));
const figmaFonts = [...loadable.entries()].sort(byKey).map(([, f]) => f);

return { kind: 'ds-contracts-plugin-capture', version: 2, fileKey: figma.fileKey || null, set: set.name, nodeId: set.id, variants: captured, fonts, figmaFonts,
  svgs: [...svgs.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) };
