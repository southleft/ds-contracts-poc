/**
 * CANVAS FINGERPRINT — the drift round's shared primitive.
 *
 * A deterministic djb2 hash over the VISUAL facts of a node tree: type,
 * name, rounded geometry, paint stacks, corner radii, auto-layout box
 * facts, text characters, opacity, effect count. Two uses:
 *
 *   · GENESIS stamps `ds_contracts/canvasFingerprint` on every built set /
 *     standalone component (emit-figma-script embeds FINGERPRINT_SRC in the
 *     emitted sync scripts);
 *   · CHECK DRIFT recomputes it — a mismatch means the canvas was edited
 *     after generation (the contract-side twin is `specHash`: stored ≠
 *     freshly-compiled means the contract moved).
 *
 * Bound variables are hashed by id: ids are file-local but STABLE within a
 * file, and the fingerprint only ever compares a node against its own past
 * in the same file. Geometry rounds to 0.1px (Figma float noise).
 *
 * The plugin's code.js carries a byte-identical copy of this function (a
 * Figma plugin cannot import at runtime) — keep them in lockstep; the
 * plugin-engine gate exercises the emitted copy against this module.
 */
export const FINGERPRINT_SRC: string = `
function dsCanvasFingerprint(root) {
  var h = 5381;
  var mix = function (s) { for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; };
  var r1 = function (n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; };
  var walk = function (n) {
    mix('|' + n.type + '/' + n.name);
    try { mix(':' + r1(n.width) + 'x' + r1(n.height) + '@' + r1(n.x) + ',' + r1(n.y)); } catch (e) {}
    try { if (n.fills && n.fills !== undefined) mix('f' + JSON.stringify(n.fills)); } catch (e) {}
    try { if (n.strokes && n.strokes.length) mix('s' + JSON.stringify(n.strokes) + (n.strokeWeight || 0)); } catch (e) {}
    try { mix('r' + r1(n.topLeftRadius || n.cornerRadius || 0) + ',' + r1(n.topRightRadius || 0) + ',' + r1(n.bottomLeftRadius || 0) + ',' + r1(n.bottomRightRadius || 0)); } catch (e) {}
    try { if (n.layoutMode && n.layoutMode !== 'NONE') mix('l' + n.layoutMode + n.primaryAxisAlignItems + n.counterAxisAlignItems + r1(n.itemSpacing) + ',' + r1(n.paddingTop) + ',' + r1(n.paddingRight) + ',' + r1(n.paddingBottom) + ',' + r1(n.paddingLeft)); } catch (e) {}
    try { if (n.type === 'TEXT') mix('t' + n.characters + '/' + String(n.fontSize) + '/' + JSON.stringify(n.fontName)); } catch (e) {}
    try { if (n.opacity !== undefined && n.opacity !== 1) mix('o' + r1(n.opacity)); } catch (e) {}
    try { if (n.effects && n.effects.length) mix('e' + n.effects.length); } catch (e) {}
    try { if (n.visible === false) mix('h'); } catch (e) {}
    var kids = n.children || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  };
  walk(root);
  return String(h);
}
`;
