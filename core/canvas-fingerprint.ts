/**
 * CANVAS FINGERPRINT + SNAPSHOT — the drift round's shared primitive (v3).
 *
 * dsCanvasSnapshot(node): the AUTHORED visual facts of a node tree as
 * human-readable fact lines (`path:type/name|channel|value`) — paints,
 * strokes, radii, auto-layout parameters, sizing modes, text, opacity,
 * effects, visibility. GEOMETRY (x/y/w/h) stays excluded: real Figma
 * computes layout lazily, so build-tick geometry is not final (the v1
 * false-positive class). dsCanvasFingerprint = v3-prefixed djb2 of the
 * snapshot — the hash IS the snapshot's hash, so a stored snapshot always
 * explains its own fingerprint.
 *
 * Genesis stamps BOTH per variant (fingerprint on set + variants; snapshot
 * on variants — each variant node owns its pluginData quota). Check Drift
 * recomputes: fingerprint mismatch trips; snapshot DIFF names WHAT changed
 * ("label fill #fff → #f0f") — the live finding this version closes
 * ("it does not mention what changed").
 *
 * The plugin's code.js carries a byte-identical copy (no runtime imports in
 * plugins) — keep in lockstep; the plugin-engine gate pins them.
 */
export const FINGERPRINT_SRC: string = `
function dsCanvasSnapshot(root) {
  var lines = [];
  var r1 = function (n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; };
  var walk = function (n, path) {
    var id = path + ':' + n.type + '/' + n.name;
    try { if (n.fills && n.fills !== undefined) lines.push(id + '|fill|' + JSON.stringify(n.fills)); } catch (e) {}
    try { if (n.strokes && n.strokes.length) lines.push(id + '|stroke|' + JSON.stringify(n.strokes) + ' w' + (n.strokeWeight || 0)); } catch (e) {}
    try { lines.push(id + '|radius|' + r1(n.topLeftRadius || n.cornerRadius || 0) + ',' + r1(n.topRightRadius || 0) + ',' + r1(n.bottomLeftRadius || 0) + ',' + r1(n.bottomRightRadius || 0)); } catch (e) {}
    try { if (n.layoutMode && n.layoutMode !== 'NONE') lines.push(id + '|layout|' + n.layoutMode + ' ' + n.primaryAxisAlignItems + '/' + n.counterAxisAlignItems + ' gap ' + r1(n.itemSpacing) + ' pad ' + r1(n.paddingTop) + ',' + r1(n.paddingRight) + ',' + r1(n.paddingBottom) + ',' + r1(n.paddingLeft)); } catch (e) {}
    try { lines.push(id + '|sizing|' + (n.layoutSizingHorizontal || '') + '/' + (n.layoutSizingVertical || '') + ' ' + (n.layoutPositioning || '')); } catch (e) {}
    try { if (n.type === 'TEXT') lines.push(id + '|text|"' + n.characters + '" ' + String(n.fontSize) + 'px ' + JSON.stringify(n.fontName)); } catch (e) {}
    try { if (n.opacity !== undefined && n.opacity !== 1) lines.push(id + '|opacity|' + r1(n.opacity)); } catch (e) {}
    try { if (n.effects && n.effects.length) lines.push(id + '|effects|' + n.effects.length); } catch (e) {}
    try { if (n.visible === false) lines.push(id + '|hidden|true'); } catch (e) {}
    var kids = n.children || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i], path + '/' + i);
  };
  walk(root, '');
  return lines;
}
function dsCanvasFingerprint(root) {
  var s = dsCanvasSnapshot(root).join(String.fromCharCode(10));
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return 'v3:' + String(h);
}
`;
