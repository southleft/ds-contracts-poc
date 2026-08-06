var dsVarNames = {};
var dsVarNamesLoaded = false;
function dsSetVarNames(m) { dsVarNames = m || {}; dsVarNamesLoaded = true; return dsVarNames; }
async function dsLoadVarNames() {
  var m = {};
  try {
    var all = await figma.variables.getLocalVariablesAsync();
    for (var i = 0; i < all.length; i++) m[all[i].id] = all[i].name;
  } catch (e) {}
  return dsSetVarNames(m);
}
function dsVarName(id) {
  if (!id) return '(none)';
  if (!dsVarNamesLoaded) {
    throw new Error(
      'dsCanvasFingerprint: the variable-name map was never loaded. v6 spells bindings by NAME, so every path that COMPUTES a fingerprint must ' +
      'await dsLoadVarNames() (or call dsSetVarNames({}) to state deliberately that no names are available) before walking. ' +
      'Without it every bound field resolves to (unresolved) and the hash silently disagrees with the stamp.',
    );
  }
  if (dsVarNames[id]) return dsVarNames[id];
  try {
    if (typeof figma !== 'undefined' && figma.variables && figma.variables.getVariableById) {
      var v = figma.variables.getVariableById(id);
      if (v && v.name) { dsVarNames[id] = v.name; return v.name; }
    }
  } catch (e) {}
  return '(unresolved)';
}
function dsPaints(paints) {
  return JSON.stringify(paints, function (k, v) {
    if (v && typeof v === 'object' && v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string') {
      return { var: dsVarName(v.id) };
    }
    return v;
  });
}
function dsCanvasSnapshot(root) {
  var lines = [];
  var r1 = function (n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; };
  var factsOf = function (n, id) {
    var out = [];
    try { if (n.fills && n.fills !== undefined) out.push(id + '|fill|' + dsPaints(n.fills)); } catch (e) {}
    try { if (n.strokes && n.strokes.length) out.push(id + '|stroke|' + dsPaints(n.strokes) + ' w' + (n.strokeWeight || 0)); } catch (e) {}
    try { out.push(id + '|radius|' + r1(n.topLeftRadius || n.cornerRadius || 0) + ',' + r1(n.topRightRadius || 0) + ',' + r1(n.bottomLeftRadius || 0) + ',' + r1(n.bottomRightRadius || 0)); } catch (e) {}
    try { if (n.layoutMode && n.layoutMode !== 'NONE') out.push(id + '|layout|' + n.layoutMode + ' ' + n.primaryAxisAlignItems + '/' + n.counterAxisAlignItems + ' gap ' + r1(n.itemSpacing) + ' pad ' + r1(n.paddingTop) + ',' + r1(n.paddingRight) + ',' + r1(n.paddingBottom) + ',' + r1(n.paddingLeft)); } catch (e) {}
    try { out.push(id + '|sizing|' + (n.layoutSizingHorizontal || '') + '/' + (n.layoutSizingVertical || '') + ' ' + (n.layoutPositioning || '')); } catch (e) {}
    try { if (n.type === 'TEXT') out.push(id + '|text|"' + n.characters + '" ' + String(n.fontSize) + 'px ' + JSON.stringify(n.fontName)); } catch (e) {}
    try { if (n.opacity !== undefined && n.opacity !== 1) out.push(id + '|opacity|' + r1(n.opacity)); } catch (e) {}
    try { if (n.effects && n.effects.length) out.push(id + '|effects|' + n.effects.length); } catch (e) {}
    try { if (n.visible === false) out.push(id + '|hidden|true'); } catch (e) {}
    try {
      var bv = n.boundVariables;
      if (bv) {
        var bf = Object.keys(bv).sort();
        for (var bi = 0; bi < bf.length; bi++) {
          var al = bv[bf[bi]];
          if (!al || Object.prototype.toString.call(al) === '[object Array]' || !al.id) continue;
          out.push(id + '|bound:' + bf[bi] + '|' + dsVarName(al.id));
        }
      }
    } catch (e) {}
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
  return 'v6:' + String(h);
}
const TARGET = "2:6";
const LABEL = "2:4";
const VAR = "VariableID:2:3";
const BASELINE = "v6:3552508208";
const label = await figma.getNodeByIdAsync(LABEL);
const paddingVar = await figma.variables.getVariableByIdAsync(VAR);
if (!label || !paddingVar) throw new Error("label/variable missing");
label.paddingLeft = 8;
label.setBoundVariable("paddingLeft", paddingVar);
await dsLoadVarNames();
const node = await figma.getNodeByIdAsync(TARGET);
const snap = dsCanvasSnapshot(node);
const fp = dsCanvasFingerprint(node);
const bv = label.boundVariables && label.boundVariables.paddingLeft;
return {
  phase: "restored",
  baseline: BASELINE,
  fingerprint: fp,
  clean: fp === BASELINE,
  paddingLeft: label.paddingLeft,
  bound: bv ? { id: bv.id, name: dsVarNames[bv.id] || null } : null,
  layoutAndBoundLines: snap.filter(l => l.includes("|layout|") || l.includes("|bound:"))
};
