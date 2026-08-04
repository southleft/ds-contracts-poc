/**
 * CANVAS FINGERPRINT + SNAPSHOT — the drift round's shared primitive (v6).
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
 * dsCanvasFingerprint = v6-prefixed djb2 of the snapshot.
 * dsCanvasSetSnapshot(node): the set's OWN facts only (description +
 * property definitions) — stored on the set node so set-level edits diff
 * without duplicating variant bulk.
 *
 * ── v6: BINDINGS (the third of the roadmap's "part tree, layout, AND
 * bindings"; two of three were covered). Measured, not assumed: v5 scored
 * `grep -c boundVariables` = 0. A designer who DETACHES a variable and types
 * the same literal changed the file's meaning and left NO trace — the
 * offline probe (paddingLeft unbound from space/inset-y/xs, value still 2)
 * recomputed the IDENTICAL hash, zero diff lines. That is the v3→v4 and
 * v4→v5 invisibility class a third time.
 *
 * TWO THINGS CHANGE.
 *
 * 1. A `bound:<field>` channel per bound property, carrying the variable's
 *    SLASH-FORM NAME. The channel is per-FIELD on purpose, not one shared
 *    `|bound|` line: the drift reporter (diffSnapshots) pairs removed/added
 *    lines by their `id|channel` prefix and degrades to "(absent)" when the
 *    pairing is ambiguous. A node with paddingLeft AND paddingRight bound
 *    would collide under a shared channel and report neither value — the
 *    exact defect diffSnapshots' own comment records ("the first key parser
 *    truncated to the node id, so every fact on a node collided"). Per-field
 *    channels keep every binding independently pairable, so a detach reports
 *    `was: space/inset-y/xs, now: (removed)`.
 *
 * 2. The fill/stroke lines STOP LEAKING the alias id. v5 spelled paints with
 *    a bare JSON.stringify, which drags the run-scoped `"id":"VariableID:
 *    279:280"` into the hash verbatim. That is serviceable for Check Drift
 *    (stamp vs recompute inside ONE file) and useless for every other
 *    comparison this repo wants — contract vs canvas, file A vs file B —
 *    because a re-imported or duplicated file mints new ids. Aliases now
 *    serialize as `{"var":"color/switch/on/track"}`, the same portability
 *    doctrine the reaction line already follows ("destination by NAME, never
 *    node id").
 *
 * NAMES ARE RESOLVED, NOT INVENTED — and the spelling is BORROWED, not
 * re-derived. extract/figma/dump.plugin.js already resolves bindings to
 * slash-form names (`bound: {paddingLeft: "space/inset-y/xs"}`, paints to
 * `{var: name}`) and skips array-valued aliases because fills/strokes ride
 * their own channel. v6 reproduces that shape exactly; a second,
 * differently-spelled resolver is the drift this repo keeps finding.
 *
 * The lookup is a two-stage id→name map because dsCanvasSnapshot is SYNC and
 * every Figma variable API that survives dynamic-page loading is async:
 * callers `await dsLoadVarNames()` once from their existing async prologue,
 * and the sync walk reads the populated map. Unresolvable ids spell
 * `(unresolved)` — never the raw id, since leaking it back would restore the
 * exact non-portability v6 exists to remove.
 *
 * The plugin's code.js carries a byte-identical copy (no runtime imports in
 * plugins) — keep in lockstep; the plugin-engine gate pins them. The joiner
 * is String.fromCharCode(10): identical bytes across the TS-template,
 * plugin-static, and gate-eval contexts (escaping doctrine).
 */
export const FINGERPRINT_SRC: string = `
var dsVarNames = {};
var dsVarNamesLoaded = false;
function dsSetVarNames(m) { dsVarNames = m || {}; dsVarNamesLoaded = true; return dsVarNames; }
// Callers with an async prologue (the emitted script's top-level await, the
// plugin's check-drift handler) populate the map ONCE; the sync walk reads it.
async function dsLoadVarNames() {
  var m = {};
  try {
    var all = await figma.variables.getLocalVariablesAsync();
    for (var i = 0; i < all.length; i++) m[all[i].id] = all[i].name;
  } catch (e) {}
  return dsSetVarNames(m);
}
// THE UNLOADED MAP IS A REFUSAL, NOT A DIFFERENT ANSWER.
//
// v6 spells bindings by NAME, and the name map can only be filled from an
// ASYNC api. A call site that forgets to await dsLoadVarNames() used to get a
// perfectly well-formed hash -- computed over (unresolved) everywhere -- that
// simply did not equal the stamp. Three separate sites hit that in one round
// (the emitted script, the plugin's inventory walk, and the engine gate's own
// new-Function harness), and every one reported a FALSE 'canvas-edited'
// verdict on an untouched file rather than an error. Telling a designer that
// applying would overwrite edits that do not exist is a louder wrong answer
// than the missed detach v6 was built to catch.
//
// So the unloaded state now refuses BY NAME at the first binding it is asked
// to resolve. A forgotten preload becomes an immediate, located error instead
// of a plausible hash -- the same reason styledChannels takes a REQUIRED
// FusionEnv rather than an optional one. dsSetVarNames({}) is the way to say
// deliberately that no names are available.
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
  // Real Figma (non-dynamic-page documents) still answers synchronously;
  // where it does not, the preloaded map above is the answer.
  try {
    if (typeof figma !== 'undefined' && figma.variables && figma.variables.getVariableById) {
      var v = figma.variables.getVariableById(id);
      if (v && v.name) { dsVarNames[id] = v.name; return v.name; }
    }
  } catch (e) {}
  return '(unresolved)';
}
// Paints serialize with aliases as NAMES: a run-scoped VariableID makes the
// line unusable across files, which is the whole defect v6 closes.
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
    // v6: DIRECT variable bindings, one channel per field so the drift
    // reporter can pair each independently. Array-valued aliases
    // (fills/strokes/characters) are skipped — they ride their own channel,
    // the same split dump.plugin.js makes.
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
  return 'v6:' + String(h);
}
`;

/** The stamp version prefix — one spelling, imported by the emitter and the
 *  gates rather than re-typed as a literal in each (v5 was typed in five
 *  places and a bump had to find all of them). */
export const FINGERPRINT_VERSION = 'v6:';
