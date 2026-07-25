/**
 * CANVAS FINGERPRINT — the drift round's shared primitive (v2).
 *
 * A deterministic djb2 hash over the AUTHORED visual facts of a node tree:
 * type, name, paint stacks, corner radii, auto-layout parameters, sizing
 * modes, text, opacity, effect count, visibility. GEOMETRY (x/y/width/
 * height) is deliberately EXCLUDED: real Figma computes auto-layout
 * geometry lazily, so values read in the same tick the tree was built are
 * not final — v1 hashed them and every fresh generation immediately
 * self-flagged as drifted (live finding, 2026-07-25). Authored facts are
 * stable at stamp time by construction. Named limitation: a pure
 * geometry-only canvas edit (dragging a frame's size) is not detected by
 * the fingerprint — the full dump-diff path owns that class.
 *
 * Two uses:
 *   · GENESIS stamps `ds_contracts/canvasFingerprint` (v2-prefixed) on every
 *     built set / standalone component (emit-figma-script embeds
 *     FINGERPRINT_SRC in the emitted sync scripts);
 *   · CHECK DRIFT recomputes it — a mismatch means the canvas was edited
 *     after generation. A stamp without the v2 prefix predates this scheme
 *     and re-baselines on the next sync run.
 *
 * The plugin's code.js carries a byte-identical copy (a Figma plugin cannot
 * import at runtime) — keep them in lockstep; the plugin-engine gate pins
 * the emitted copy against this module.
 */
export const FINGERPRINT_SRC: string = `
function dsCanvasFingerprint(root) {
  var h = 5381;
  var mix = function (s) { for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; };
  var r1 = function (n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; };
  var walk = function (n) {
    mix('|' + n.type + '/' + n.name);
    try { if (n.fills && n.fills !== undefined) mix('f' + JSON.stringify(n.fills)); } catch (e) {}
    try { if (n.strokes && n.strokes.length) mix('s' + JSON.stringify(n.strokes) + (n.strokeWeight || 0)); } catch (e) {}
    try { mix('r' + r1(n.topLeftRadius || n.cornerRadius || 0) + ',' + r1(n.topRightRadius || 0) + ',' + r1(n.bottomLeftRadius || 0) + ',' + r1(n.bottomRightRadius || 0)); } catch (e) {}
    try { if (n.layoutMode && n.layoutMode !== 'NONE') mix('l' + n.layoutMode + n.primaryAxisAlignItems + n.counterAxisAlignItems + r1(n.itemSpacing) + ',' + r1(n.paddingTop) + ',' + r1(n.paddingRight) + ',' + r1(n.paddingBottom) + ',' + r1(n.paddingLeft)); } catch (e) {}
    try { mix('z' + (n.layoutSizingHorizontal || '') + (n.layoutSizingVertical || '') + (n.layoutPositioning || '')); } catch (e) {}
    try { if (n.type === 'TEXT') mix('t' + n.characters + '/' + String(n.fontSize) + '/' + JSON.stringify(n.fontName)); } catch (e) {}
    try { if (n.opacity !== undefined && n.opacity !== 1) mix('o' + r1(n.opacity)); } catch (e) {}
    try { if (n.effects && n.effects.length) mix('e' + n.effects.length); } catch (e) {}
    try { if (n.visible === false) mix('h'); } catch (e) {}
    var kids = n.children || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  };
  walk(root);
  return 'v2:' + String(h);
}
`;
