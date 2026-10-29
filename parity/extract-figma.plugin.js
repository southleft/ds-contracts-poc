// Figma-side extraction script (Plugin API). Transport-agnostic: run via
// figma-console-mcp figma_execute or the Figma MCP use_figma, then save the
// returned JSON to parity/snapshots/figma-components.json (sets) and
// parity/snapshots/figma-tokens.json (collections).
//
// v2 (composition): also extracts standalone COMPONENTs (not just sets),
// INSTANCE_SWAP preferredValues, and the names of nested component instances
// (for verifying contract `component` refs like Card ⊃ Avatar).
//
// v3 (provenance): the output carries `fileKey` + `extractedAt` so
// parity/diff.ts can verify the snapshot's identity (against the contracts'
// bindings.figma.anchors.fileKey) and freshness. The old hard-coded file-NAME guard is
// gone — names are user-editable and fileKey is authoritative; the caller
// (diff.ts) verifies the key instead of this script guessing.
//
// ───────────────────────────────────────────────────────────────────────────
// v4 (THE TRANSPORT) — this script now reads the canvas fingerprint back.
//
// MEASURED BEFORE THIS VERSION:
//     $ grep -c getSharedPluginData parity/extract-figma.plugin.js   → 0
// core/emit-figma-script.ts has stamped `ds_contracts/canvasFingerprint` and
// `canvasSnapshot` on the set AND every variant child for four schema
// versions, and core/canvas-binding-check.ts proves the v6 hash covers part
// tree, layout AND bindings-by-name. Nothing ever read it off the canvas. So
// the differ's Figma half compared property DEFINITIONS only, and a four-way
// part-layout edit inside ONE variant (padding, itemSpacing, counter-axis
// alignment, a dropped binding) projected to a BYTE-IDENTICAL snapshot entry
// while parity/diff.ts printed "✔ Parity clean" over it.
//
// EACH VARIANT ROW CARRIES FOUR FIELDS, AND ALL FOUR ARE LOAD-BEARING:
//
//   fingerprint / snapshot   READ from pluginData — what the plugin last
//                            STAMPED, i.e. the state it generated.
//   live / liveSnapshot      RECOMPUTED here, in this session, over the node
//                            as it stands right now.
//
// The stamp alone cannot close the exit criterion, and this is the whole
// reason `live` exists. NOTHING RE-STAMPS WHEN A DESIGNER DRAGS A PADDING
// HANDLE. After a hand edit the stamp still describes the pre-edit geometry,
// so any comparison against it — including against a freshly compiled
// contract — stays clean and the edit remains invisible. `live` vs
// `fingerprint` is the plugin's own Check Drift verdict, computed by the same
// source over the same node in the same session, and transporting it offline
// is what lets parity/diff.ts catch the edit without a human or a screenshot.
//
// The fingerprint source below is core/canvas-fingerprint.ts's FINGERPRINT_SRC
// inlined VERBATIM, the same way core/emit-figma-script.ts and
// figma-sync/plugin/code.js inline it. It is between generated markers and
// `npm run variant-drift:check` byte-compares it against the module on every
// fast-lane run; `npx tsx parity/variant-drift-check.ts --embed` re-embeds it.
// Do not hand-edit inside the markers.
// ───────────────────────────────────────────────────────────────────────────

// >>> BEGIN SNAPSHOT_STORAGE_SRC (generated from core/canvas-snapshot-storage.ts — do not edit)
// Lossless shared-plugin-data transport. Snapshot contents and v6 hashes are unchanged.
var DS_SNAPSHOT_NAMESPACE = 'ds_contracts';
var DS_SNAPSHOT_INLINE_BYTES = 96000;
var DS_SNAPSHOT_CHUNK_BYTES = 48 * 1024;
var DS_SNAPSHOT_TOTAL_BYTES = 32 * 1024 * 1024;
var DS_SNAPSHOT_MAX_CHUNKS = 1024;
function dsSnapshotFail(reason) { throw new Error('canvas-snapshot-storage: ' + reason); }
function dsSnapshotKey(key) {
  if (key !== 'canvasSnapshot' && key !== 'canvasSetSnapshot') dsSnapshotFail('unsupported key');
}
function dsSnapshotUtf8Bytes(value) {
  var bytes = 0;
  for (var i = 0; i < value.length; i++) {
    var point = value.codePointAt(i);
    if (point > 65535) i++;
    bytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
  }
  return bytes;
}
function dsSnapshotEntryBytes(key, value) {
  return dsSnapshotUtf8Bytes(DS_SNAPSHOT_NAMESPACE) + dsSnapshotUtf8Bytes(key) + dsSnapshotUtf8Bytes(value);
}
function dsSnapshotLines(value) {
  if (!Array.isArray(value)) dsSnapshotFail('invalid snapshot lines');
  var owned = [];
  for (var i = 0; i < value.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, i)) dsSnapshotFail('invalid snapshot lines');
    var line = value[i];
    if (typeof line !== 'string') dsSnapshotFail('invalid snapshot lines');
    owned.push(line);
  }
  return owned;
}
function dsSnapshotChunkKey(key, digest, index) { return key + '_chunks_' + digest + '_' + index; }
function dsSnapshotHeader(raw) {
  var parsed;
  try { parsed = JSON.parse(raw); } catch (_) { dsSnapshotFail('invalid JSON'); }
  if (Array.isArray(parsed)) return null;
  // Read the earlier numbered transport without writing it again. Its lack of a
  // digest is historical; migration below publishes verified chunks atomically.
  if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'dsSnapshotPieces')) {
    if (Object.keys(parsed).join(',') !== 'dsSnapshotPieces,length' ||
        !Number.isSafeInteger(parsed.dsSnapshotPieces) || parsed.dsSnapshotPieces < 2 || parsed.dsSnapshotPieces > 4096 ||
        !Number.isSafeInteger(parsed.length) || parsed.length < 2 || parsed.length > DS_SNAPSHOT_TOTAL_BYTES ||
        parsed.dsSnapshotPieces > parsed.length || JSON.stringify(parsed) !== raw) dsSnapshotFail('invalid legacy manifest');
    return parsed;
  }
  if (!parsed || typeof parsed !== 'object' ||
      Object.keys(parsed).join(',') !== 'storage,version,sha256,count,chars,bytes' ||
      parsed.storage !== 'ds-snapshot-chunks' || parsed.version !== 1 ||
      typeof parsed.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.sha256) ||
      !Number.isSafeInteger(parsed.count) || parsed.count < 1 || parsed.count > DS_SNAPSHOT_MAX_CHUNKS ||
      !Number.isSafeInteger(parsed.chars) || parsed.chars < 2 || parsed.chars > DS_SNAPSHOT_TOTAL_BYTES ||
      !Number.isSafeInteger(parsed.bytes) || parsed.bytes < 2 || parsed.bytes > DS_SNAPSHOT_TOTAL_BYTES ||
      parsed.chars > parsed.bytes || parsed.count > parsed.chars || JSON.stringify(parsed) !== raw) {
    dsSnapshotFail('invalid manifest');
  }
  return parsed;
}
function dsReadCanvasSnapshot(node, key) {
  dsSnapshotKey(key);
  var raw = node.getSharedPluginData(DS_SNAPSHOT_NAMESPACE, key);
  if (raw === '') return null; // Legacy unstamped node; distinct from a malformed manifest.
  if (typeof raw !== 'string' || dsSnapshotUtf8Bytes(raw) > DS_SNAPSHOT_TOTAL_BYTES) dsSnapshotFail('invalid entry size');
  var header = dsSnapshotHeader(raw);
  if (header && dsSnapshotEntryBytes(key, raw) > DS_SNAPSHOT_INLINE_BYTES) dsSnapshotFail('invalid manifest size');
  var text = raw;
  if (header && Object.prototype.hasOwnProperty.call(header, 'dsSnapshotPieces')) {
    var legacyChunks = [], legacyChars = 0, legacyBytes = 0;
    for (var legacy = 0; legacy < header.dsSnapshotPieces; legacy++) {
      var legacyKey = key + '/' + legacy;
      var legacyChunk = node.getSharedPluginData(DS_SNAPSHOT_NAMESPACE, legacyKey);
      if (typeof legacyChunk !== 'string' || legacyChunk.length === 0) dsSnapshotFail('missing legacy chunk ' + legacy);
      if (legacyChunk.length > 32000 || dsSnapshotEntryBytes(legacyKey, legacyChunk) >= 100000) dsSnapshotFail('oversized legacy chunk ' + legacy);
      var legacyFirst = legacyChunk.charCodeAt(0), legacyLast = legacyChunk.charCodeAt(legacyChunk.length - 1);
      if ((legacyFirst >= 56320 && legacyFirst <= 57343) || (legacyLast >= 55296 && legacyLast <= 56319)) dsSnapshotFail('split legacy Unicode chunk ' + legacy);
      legacyChars += legacyChunk.length; legacyBytes += dsSnapshotUtf8Bytes(legacyChunk);
      if (legacyChars > header.length || legacyBytes > DS_SNAPSHOT_TOTAL_BYTES) dsSnapshotFail('legacy chunk length mismatch');
      legacyChunks.push(legacyChunk);
    }
    if (legacyChars !== header.length) dsSnapshotFail('legacy chunk length mismatch');
    text = legacyChunks.join('');
  } else if (header) {
    var chunks = [], totalChars = 0, totalBytes = 0;
    for (var i = 0; i < header.count; i++) {
      var chunkKey = dsSnapshotChunkKey(key, header.sha256, i);
      var chunk = node.getSharedPluginData(DS_SNAPSHOT_NAMESPACE, chunkKey);
      if (typeof chunk !== 'string' || chunk.length === 0) dsSnapshotFail('missing chunk ' + i);
      if (dsSnapshotEntryBytes(chunkKey, chunk) > DS_SNAPSHOT_CHUNK_BYTES) dsSnapshotFail('oversized chunk ' + i);
      // Writers never split surrogate pairs; reject fragments even if concatenation could hide them.
      var first = chunk.charCodeAt(0), last = chunk.charCodeAt(chunk.length - 1);
      if ((first >= 56320 && first <= 57343) || (last >= 55296 && last <= 56319)) dsSnapshotFail('split Unicode chunk ' + i);
      totalChars += chunk.length;
      totalBytes += dsSnapshotUtf8Bytes(chunk);
      if (totalChars > header.chars || totalBytes > header.bytes) dsSnapshotFail('chunk length mismatch');
      chunks.push(chunk);
    }
    text = chunks.join('');
    if (totalChars !== header.chars || totalBytes !== header.bytes || dsSnapshotSha256(text) !== header.sha256) dsSnapshotFail('chunk integrity mismatch');
  }
  var lines;
  try { lines = JSON.parse(text); } catch (_) { dsSnapshotFail('invalid snapshot JSON'); }
  dsSnapshotLines(lines);
  if (node.getSharedPluginData(DS_SNAPSHOT_NAMESPACE, key) !== raw) dsSnapshotFail('manifest changed while reading');
  return lines;
}
function dsWriteCanvasSnapshot(node, key, lines) {
  dsSnapshotKey(key);
  lines = dsSnapshotLines(lines);
  var text = JSON.stringify(lines), totalBytes = dsSnapshotUtf8Bytes(text);
  if (totalBytes > DS_SNAPSHOT_TOTAL_BYTES) dsSnapshotFail('snapshot exceeds transport budget');
  var oldRaw = node.getSharedPluginData(DS_SNAPSHOT_NAMESPACE, key);
  var oldHeader = oldRaw ? dsSnapshotHeader(oldRaw) : null;
  var nextHeader = null;
  if (dsSnapshotEntryBytes(key, text) <= DS_SNAPSHOT_INLINE_BYTES) {
    node.setSharedPluginData(DS_SNAPSHOT_NAMESPACE, key, text);
  } else {
    var digest = dsSnapshotSha256(text), chunks = [], start = 0, bytes = 0;
    for (var i = 0; i < text.length; i++) {
      var point = text.codePointAt(i), size = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      var chunkKey = dsSnapshotChunkKey(key, digest, chunks.length);
      var budget = DS_SNAPSHOT_CHUNK_BYTES - dsSnapshotEntryBytes(chunkKey, '');
      if (bytes + size > budget) { chunks.push(text.slice(start, i)); start = i; bytes = 0; }
      bytes += size;
      if (point > 65535) i++;
    }
    if (start < text.length) chunks.push(text.slice(start));
    if (chunks.length < 1 || chunks.length > DS_SNAPSHOT_MAX_CHUNKS) dsSnapshotFail('chunk count exceeds transport budget');
    nextHeader = { storage: 'ds-snapshot-chunks', version: 1, sha256: digest, count: chunks.length, chars: text.length, bytes: totalBytes };
    for (var c = 0; c < chunks.length; c++) {
      var nextKey = dsSnapshotChunkKey(key, digest, c);
      if (dsSnapshotEntryBytes(nextKey, chunks[c]) > DS_SNAPSHOT_CHUNK_BYTES) dsSnapshotFail('chunk budget calculation failed');
      node.setSharedPluginData(DS_SNAPSHOT_NAMESPACE, nextKey, chunks[c]);
    }
    // The old inline value/manifest remains readable until this single publication write succeeds.
    node.setSharedPluginData(DS_SNAPSHOT_NAMESPACE, key, JSON.stringify(nextHeader));
  }
  // Cleanup follows publication; a failed cleanup cannot invalidate the new value.
  if (oldHeader && Object.prototype.hasOwnProperty.call(oldHeader, 'dsSnapshotPieces')) {
    for (var legacyOld = 0; legacyOld < oldHeader.dsSnapshotPieces; legacyOld++) node.setSharedPluginData(DS_SNAPSHOT_NAMESPACE, key + '/' + legacyOld, '');
  } else if (oldHeader && (!nextHeader || oldHeader.sha256 !== nextHeader.sha256)) {
    for (var old = 0; old < oldHeader.count; old++) node.setSharedPluginData(DS_SNAPSHOT_NAMESPACE, dsSnapshotChunkKey(key, oldHeader.sha256, old), '');
  }
}
function dsSnapshotSha256(str) {
  // UTF-8 encode
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.codePointAt(i);
    if (c > 0xffff) i++; // surrogate pair consumed
    else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const l = bytes.length;
  const n = (((l + 8) >> 6) + 1) * 16; // padded length in 32-bit words
  const w = new Array(n).fill(0);
  for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  w[n - 2] = Math.floor((l * 8) / 0x100000000);
  w[n - 1] = (l * 8) >>> 0;
  const words = new Array(64);
  for (let i = 0; i < n; i += 16) {
    for (let t = 0; t < 16; t++) words[t] = w[i + t] | 0;
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(words[t - 15], 7) ^ rotr(words[t - 15], 18) ^ (words[t - 15] >>> 3);
      const s1 = rotr(words[t - 2], 17) ^ rotr(words[t - 2], 19) ^ (words[t - 2] >>> 10);
      words[t] = (words[t - 16] + s0 + words[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + words[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
// <<< END SNAPSHOT_STORAGE_SRC

// >>> BEGIN FINGERPRINT_SRC (generated from core/canvas-fingerprint.ts — do not edit)
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
// <<< END FINGERPRINT_SRC

await figma.loadAllPagesAsync();
// v6 REQUIRES THIS. The v6 snapshot spells bindings by NAME
// (`|bound:paddingLeft|space/inset-x/sm`) through an id→name map that only an
// ASYNC Figma API can fill, and dsVarName THROWS rather than resolve to
// "(unresolved)" when the map was never loaded — because three call sites
// forgot the preload in one round and every one of them reported a FALSE
// 'canvas-edited' verdict on an untouched file. Telling a designer that
// applying would overwrite edits that do not exist is a louder wrong answer
// than the missed edit v6 was built to catch.
// Do not use dsLoadVarNames() here: the canonical helper intentionally
// swallows API errors for generation compatibility, which would turn a failed
// lookup into a successfully "loaded" empty map. Extraction is evidence, so
// it must preserve the failure and fail each affected measurement closed.
let variableNameLoadError = null;
try {
  const allVariables = await figma.variables.getLocalVariablesAsync();
  const variableNames = {};
  for (const variable of allVariables) variableNames[variable.id] = variable.name;
  dsSetVarNames(variableNames);
} catch (error) {
  variableNameLoadError =
    'variable-name preload failed: ' +
    (error && error.message ? error.message : String(error));
}

const rgbToHex = (c) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return ('#' + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
};

const measurementErrorText = (error) =>
  error && error.message ? `${error.name || 'Error'}: ${error.message}` : String(error);

/** Stamped + recomputed fingerprint for ONE node. Never throws: failures are
 * transported as machine-readable evidence and diff.ts fails them closed. */
const fingerprintRow = (node) => {
  let fingerprint = null;
  let snapshot = null;
  try {
    fingerprint = node.getSharedPluginData('ds_contracts', 'canvasFingerprint') || null;
  } catch (e) { /* unstamped */ }
  let measurementError = variableNameLoadError;
  try {
    snapshot = dsReadCanvasSnapshot(node, 'canvasSnapshot');
  } catch (error) {
    measurementError = measurementError || `stored canvas snapshot could not be read: ${measurementErrorText(error)}`;
  }
  let live = null;
  let liveSnapshot = null;
  try {
    if (!measurementError) {
      liveSnapshot = dsCanvasSnapshot(node);
      const unresolved = liveSnapshot.find((line) => line.includes('(unresolved)') || line.includes('VariableID:'));
      if (unresolved) {
        measurementError = `variable-name lookup failed while fingerprinting ${node.name}: ${unresolved}`;
        liveSnapshot = null;
      } else {
        live = dsCanvasFingerprint(node);
        if (typeof live !== 'string' || !live) {
          measurementError = `fingerprint recomputation returned ${String(live)} for ${node.name}`;
          live = null;
          liveSnapshot = null;
        }
      }
    }
  } catch (e) {
    liveSnapshot = null;
    live = null;
    measurementError = `fingerprint recomputation threw for ${node.name}: ${measurementErrorText(e)}`;
  }
  return { name: node.name, fingerprint, snapshot, live, liveSnapshot, measurementError };
};

/** The set's own metadata transport. `canvasSetSnapshot` excludes variant
 * bulk, so description/property-definition edits are localized to the set. */
const setFingerprintRow = (node) => {
  const base = fingerprintRow(node);
  let snapshot = null;
  try {
    snapshot = dsReadCanvasSnapshot(node, 'canvasSetSnapshot');
    if (!snapshot && base.fingerprint) {
      base.measurementError = 'stored component-set snapshot is absent; set metadata cannot be compared';
    }
  } catch (error) {
    base.measurementError =
      base.measurementError || `stored component-set snapshot could not be read: ${measurementErrorText(error)}`;
  }
  let liveSnapshot = null;
  if (!base.measurementError) {
    try {
      liveSnapshot = dsCanvasSetSnapshot(node);
    } catch (error) {
      base.live = null;
      base.measurementError = `component-set metadata recomputation threw for ${node.name}: ${measurementErrorText(error)}`;
    }
  }
  return {
    setFingerprint: base.fingerprint,
    setSnapshot: snapshot,
    setLive: base.live,
    setLiveSnapshot: liveSnapshot,
    setMeasurementError: base.measurementError,
  };
};

// --- Component sets AND standalone components ---
const sets = [];
for (const page of figma.root.children) {
  const nodes = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] });
  for (const node of nodes) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue; // variants
    if (node.name === 'Slot') continue; // utility, not a contract component
    const defs = {};
    for (const [key, def] of Object.entries(node.componentPropertyDefinitions)) {
      defs[key] = {
        type: def.type,
        defaultValue: def.defaultValue,
        variantOptions: def.variantOptions || null,
        preferredValues: def.preferredValues || null,
      };
    }
    // Nested instances: which components does this one compose?
    //
    // v4 FIX, measured: this probed `node.defaultVariant` for a set, so a
    // nested instance existing only in a NON-DEFAULT variant was invisible to
    // parity/diff.ts's componentRefsOf check — a Card whose Avatar appears
    // only in Size=Large reported "no Avatar instance exists inside the Figma
    // component" and the contract looked BEHIND when it was in sync.
    // extract/figma/dump.plugin.js:791-795 already walks EVERY variant; this
    // now matches it. THE COST: findAllWithCriteria runs once per variant
    // instead of once per set, so the INSTANCE walk scales with variant count
    // (Button's 63 variants → 63 walks). It is a read-only pass over a tree
    // that is already loaded and it deduplicates by owner name, so the output
    // grows only when a variant genuinely composes something the default
    // does not.
    const probes = node.type === 'COMPONENT_SET' ? node.children : [node];
    const nestedInstances = [];
    for (const probe of probes) {
      for (const inst of probe.findAllWithCriteria({ types: ['INSTANCE'] })) {
        const main = await inst.getMainComponentAsync();
        if (!main) continue;
        const owner = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : main.name;
        if (!nestedInstances.includes(owner)) nestedInstances.push(owner);
      }
    }
    // NATIVE SLOT CONTENT (2026-08-08, native-slots round). `accepts` maps to
    // the SLOT property's preferredValues, which Figma treats as a PICKER
    // HINT — off-list content is accepted by the canvas without complaint
    // (live probe 2b). The canvas therefore cannot refuse a violation, which
    // is precisely why the differ owes a finding: this is what it needs to
    // see. Captured per PROPERTY ID (slot identity is the id) with the
    // component key of each drawn child, so diff.ts can compare keys instead
    // of names.
    //
    // DECLARED LIMIT: this walks the MAIN components — design-time slot
    // content. A designer's fill on an INSTANCE elsewhere in the file is not
    // in this transport, so an accepts violation there is not measured here
    // (absence of an entry is never evidence of compliance).
    const slotContent = {};
    for (const probe of probes) {
      for (const slot of probe.findAll((n) => n.type === 'SLOT')) {
        const slotKey = (slot.componentPropertyReferences || {}).slotContentId;
        if (!slotKey) continue;
        if (!slotContent[slotKey]) slotContent[slotKey] = [];
        for (const child of slot.children) {
          const entry = { variant: probe.name, name: child.name };
          if (child.type === 'INSTANCE') {
            const main = await child.getMainComponentAsync();
            if (main) {
              const owner = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
              entry.name = owner.name;
              entry.key = owner.key;
            }
          }
          slotContent[slotKey].push(entry);
        }
      }
    }
    // THE TRANSPORT. Mirrors core/emit-figma-script.ts's dsStampFingerprints:
    // a SET stamps each variant child, a standalone COMPONENT stamps itself.
    const variants = (node.type === 'COMPONENT_SET' ? node.children : [node]).map(fingerprintRow);
    const setFingerprint = setFingerprintRow(node);
    sets.push({
      name: node.name,
      nodeId: node.id,
      key: node.key,
      description: node.description,
      variantCount: node.type === 'COMPONENT_SET' ? node.children.length : 1,
      properties: defs,
      nestedInstances,
      ...(Object.keys(slotContent).length > 0 ? { slotContent } : {}),
      // The contract this set was generated from, when the plugin marked it —
      // diff.ts falls back to key then name, and this is the unambiguous one.
      contractId: node.getSharedPluginData('ds_contracts', 'contractId') || null,
      ...setFingerprint,
      variants,
    });
  }
}

// --- Variables ---
const collections = [];
for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
  const vars = [];
  for (const id of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    const values = {};
    for (const mode of col.modes) {
      const val = v.valuesByMode[mode.modeId];
      if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
        const target = await figma.variables.getVariableByIdAsync(val.id);
        values[mode.name] = '{' + target.name + '}';
      } else if (val && typeof val === 'object' && 'r' in val) {
        values[mode.name] = rgbToHex(val);
      } else {
        values[mode.name] = val;
      }
    }
    vars.push({ name: v.name, type: v.resolvedType, scopes: v.scopes, codeSyntax: v.codeSyntax.WEB || null, values });
  }
  collections.push({ name: col.name, modes: col.modes.map((m) => m.name), variables: vars });
}

return {
  snapshotVersion: 1,
  fileName: figma.root.name,
  fileKey: figma.fileKey || null, // provenance: which file this snapshot describes
  extractedAt: Date.now(), // provenance: when it was taken (staleness check)
  sets,
  collections,
};
