/**
 * CANVAS FINGERPRINT + SNAPSHOT — the drift round's shared primitive (v5).
 *
 * dsCanvasSnapshot(node): AUTHORED visual facts as human-readable lines
 * (`path:type/name|channel|value`). v4 adds `description` and component
 * `propdef` lines — TJ's live edit list (set description + an added
 * property) was INVISIBLE to v3. v5 adds `reaction` lines: the
 * prototype-wiring round makes hover/press interactions a generated fact,
 * and v4 was blind to them — a designer stripping or re-pointing a reaction
 * produced NO drift signal, exactly the v3→v4 invisibility class. The
 * destination is recorded by variant NAME, never node id, so the line is
 * file-portable (a re-imported/duplicated file mints new ids).
 * Geometry stays excluded (deferred-layout doctrine, v2).
 * dsCanvasFingerprint = v5-prefixed djb2 of the snapshot.
 * dsCanvasSetSnapshot(node): the set's OWN facts only (description +
 * property definitions) — stored on the set node so set-level edits diff
 * without duplicating variant bulk.
 *
 * The plugin's code.js carries a byte-identical copy (no runtime imports in
 * plugins) — keep in lockstep; the plugin-engine gate pins them. The joiner
 * is String.fromCharCode(10): identical bytes across the TS-template,
 * plugin-static, and gate-eval contexts (escaping doctrine).
 */
export const FINGERPRINT_SRC: string = `
function dsCanvasSnapshot(root) {
  var lines = [];
  var r1 = function (n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; };
  var factsOf = function (n, id) {
    var out = [];
    try { if (n.fills && n.fills !== undefined) out.push(id + '|fill|' + JSON.stringify(n.fills)); } catch (e) {}
    try { if (n.strokes && n.strokes.length) out.push(id + '|stroke|' + JSON.stringify(n.strokes) + ' w' + (n.strokeWeight || 0)); } catch (e) {}
    try { out.push(id + '|radius|' + r1(n.topLeftRadius || n.cornerRadius || 0) + ',' + r1(n.topRightRadius || 0) + ',' + r1(n.bottomLeftRadius || 0) + ',' + r1(n.bottomRightRadius || 0)); } catch (e) {}
    try { if (n.layoutMode && n.layoutMode !== 'NONE') out.push(id + '|layout|' + n.layoutMode + ' ' + n.primaryAxisAlignItems + '/' + n.counterAxisAlignItems + ' gap ' + r1(n.itemSpacing) + ' pad ' + r1(n.paddingTop) + ',' + r1(n.paddingRight) + ',' + r1(n.paddingBottom) + ',' + r1(n.paddingLeft)); } catch (e) {}
    try { out.push(id + '|sizing|' + (n.layoutSizingHorizontal || '') + '/' + (n.layoutSizingVertical || '') + ' ' + (n.layoutPositioning || '')); } catch (e) {}
    try { if (n.type === 'TEXT') out.push(id + '|text|"' + n.characters + '" ' + String(n.fontSize) + 'px ' + JSON.stringify(n.fontName)); } catch (e) {}
    try { if (n.opacity !== undefined && n.opacity !== 1) out.push(id + '|opacity|' + r1(n.opacity)); } catch (e) {}
    try { if (n.effects && n.effects.length) out.push(id + '|effects|' + n.effects.length); } catch (e) {}
    try { if (n.visible === false) out.push(id + '|hidden|true'); } catch (e) {}
    // v4 (live finding: description + added property were invisible):
    try { if (n.description) out.push(id + '|description|' + n.description); } catch (e) {}
    try {
      if (n.componentPropertyDefinitions) {
        var defs = n.componentPropertyDefinitions;
        var names = Object.keys(defs).sort();
        for (var d = 0; d < names.length; d++) {
          var def = defs[names[d]];
          out.push(id + '|propdef|' + names[d] + ':' + def.type + '=' + String(def.defaultValue));
        }
      }
    } catch (e) {}
    // v5 (prototype-wiring round): interactions are generated facts now.
    // Destination by NAME (resolved among the node's siblings — a variant
    // swap is always intra-set); an unresolvable id is named honestly rather
    // than leaked as a run-scoped number.
    try {
      var rx = n.reactions;
      if (rx && rx.length) {
        var destName = function (nn, destId) {
          if (!destId) return '(none)';
          try {
            var p = nn.parent;
            var sibs = (p && p.children) || [];
            for (var s = 0; s < sibs.length; s++) if (sibs[s].id === destId) return sibs[s].name;
          } catch (e2) {}
          return '(external)';
        };
        for (var ri = 0; ri < rx.length; ri++) {
          var rr = rx[ri];
          var acts = rr.actions || (rr.action ? [rr.action] : []);
          var trg = (rr.trigger && rr.trigger.type) || '(none)';
          for (var ai = 0; ai < acts.length; ai++) {
            var ac = acts[ai];
            out.push(id + '|reaction|' + trg + String.fromCharCode(8594) + (ac.navigation || ac.type) + ' ' + destName(n, ac.destinationId));
          }
        }
      }
    } catch (e) {}
    return out;
  };
  var walk = function (n, path) {
    var id = path + ':' + n.type + '/' + n.name;
    var fs = factsOf(n, id);
    for (var i = 0; i < fs.length; i++) lines.push(fs[i]);
    var kids = n.children || [];
    for (var i2 = 0; i2 < kids.length; i2++) walk(kids[i2], path + '/' + i2);
  };
  walk(root, '');
  return lines;
}
function dsCanvasSetSnapshot(node) {
  // the SET's OWN facts only (description, property definitions, name) —
  // small enough to store on the set node; variants own their subtrees.
  var lines = [];
  var id = ':' + node.type + '/' + node.name;
  try { if (node.description) lines.push(id + '|description|' + node.description); } catch (e) {}
  try {
    if (node.componentPropertyDefinitions) {
      var defs = node.componentPropertyDefinitions;
      var names = Object.keys(defs).sort();
      for (var d = 0; d < names.length; d++) {
        var def = defs[names[d]];
        lines.push(id + '|propdef|' + names[d] + ':' + def.type + '=' + String(def.defaultValue));
      }
    }
  } catch (e) {}
  return lines;
}
function dsCanvasFingerprint(root) {
  var s = dsCanvasSnapshot(root).join(String.fromCharCode(10));
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return 'v5:' + String(h);
}
`;
