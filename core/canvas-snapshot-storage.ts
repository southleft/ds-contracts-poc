/** Lossless shared snapshot storage for the emitter, sync plugin, and parity extractor.
 * Namespace/key overhead counts toward each conservative per-entry byte budget.
 * This transport does not alter snapshot lines or the v6 fingerprint algorithm.
 */
export const SNAPSHOT_STORAGE_SRC: string = `
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
`;
