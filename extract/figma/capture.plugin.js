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
// Not yet: SVG for icons and vectors. On the A0 draft (2026-11-01) the first SVG
// export of a session took 61 s (later ones 1-10 ms), and exporting a whole
// variant root as SVG did not return; it stays a named gap until it is measured
// per node rather than a capture that stalls the plugin.
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
  captured.push(entry);
}
const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);
const loadable = new Map((await figma.listAvailableFontsAsync()).map((f) => [f.fontName.family + '\u0000' + f.fontName.style, { family: f.fontName.family, style: f.fontName.style }]));
const fonts = [...faces.entries()].sort(byKey).map(([key, f]) => ({ ...f, available: loadable.has(key) }));
const figmaFonts = [...loadable.entries()].sort(byKey).map(([, f]) => f);

return { kind: 'ds-contracts-plugin-capture', version: 2, fileKey: figma.fileKey || null, set: set.name, nodeId: set.id, variants: captured, fonts, figmaFonts };
