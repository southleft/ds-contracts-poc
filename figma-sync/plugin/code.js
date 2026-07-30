// DS Contracts Sync Runner — two transports for the generated figma-sync
// scripts, both executing in the CURRENT file (see ui.html for the chrome):
//
//   1. Paste a script — paste one generated script (e.g. the playground's
//      "Figma script" output tab) and run it. This is the designer trust
//      round-trip: copy → paste → run → read the report.
//   2. Local runner — fetch every script from the local server
//      (npm run figma:serve), in order. The from-disk transport for
//      full-library operations (fresh-file rebuild, big re-syncs) —
//      no copy/paste, no per-script size caps.
//
// INTEGRITY (local runner): the manifest (/runner-manifest.json) carries a
// SHA-256 per script. Each fetched script is hashed here (pure-JS SHA-256
// below — the plugin sandbox has no WebCrypto) and the runner REFUSES to
// execute on any mismatch. This catches script bytes changing between
// manifest fetch and script fetch (e.g. a different process answering on
// 8765 mid-run). Pasted scripts have no manifest to verify against — the
// trust model there is "you generated it yourself", stated in the UI.
//
// TOKEN (opt-in, pairs with `TOKEN=1 npm run figma:serve`): the server prints
// a random token at startup and 403s every request without ?token=. Store it
// once from this plugin's dev console (Plugins → Development → Open console):
//
//   await figma.clientStorage.setAsync('ds_contracts_runner_token', '<token from terminal>')
//
// The runner reads it from clientStorage and appends it to every request.
// Without TOKEN=1 on the server, no token is needed and existing flows work.
const BASE = 'http://localhost:8765';
const TOKEN_STORAGE_KEY = 'ds_contracts_runner_token';

// Send to Playground — the pairing bridge (workers/assist/src/bridge.ts).
// The plugin POSTs one dump under a short-lived code; the playground tab
// polls the same code and imports on arrival. Must stay in manifest.json's
// networkAccess.allowedDomains.
const BRIDGE_BASE = 'https://ds-contracts-assist.southleft-llc.workers.dev';
const BRIDGE_MAX_DUMP_BYTES = 4 * 1024 * 1024; // mirror of the worker's cap, checked before sending

// THE STANDING CI↔FIGMA CHANNEL (docs/18 G1) — the same worker, a different
// shape: CI publishes whenever it likes (`ds-contracts figma publish`), this
// plugin CHECKS whenever the designer likes. No pairing code, no synchronous
// window, and — deliberately — NO TIMER: a Figma plugin has no background
// execution, so a poll loop would only run while the window is open and
// would lie about being a "watcher". Two triggers instead: once when the
// plugin opens, and the explicit "Check for updates" button.
//
// Same host as the bridge, so manifest.json's networkAccess.allowedDomains
// is unchanged.
const CHANNEL_BASE = BRIDGE_BASE;
// The designer's READ key (dscr_…). Read-only by construction — it cannot
// publish, which is the whole point of the write/read split, so storing it
// in clientStorage carries the same weight as the runner token above.
const CHANNEL_KEY_STORAGE_KEY = 'ds_contracts_channel_key';

// Small remembered UI facts (currently: when drift was last checked in THIS
// file, keyed by file key). clientStorage, not file pluginData, deliberately:
// a drift check is READ-ONLY and must stay that way — recording "I looked"
// must never write to the document the designer asked us not to touch.
const UI_STATE_PREFIX = 'ds_contracts_ui_';

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 (the plugin sandbox has no WebCrypto). Standard FIPS 180-4
// implementation over the UTF-8 bytes of the input string; returns lowercase
// hex, matching node's createHash('sha256').update(fileBytes).digest('hex').
// ---------------------------------------------------------------------------
function sha256Hex(str) {
  // UTF-8 encode
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.codePointAt(i);
    if (c > 0xffff) i++; // surrogate pair consumed
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

// ---------------------------------------------------------------------------
// UI plumbing. Results cross the sandbox → iframe boundary via postMessage,
// so reports are flattened to plain JSON (the generated scripts return plain
// object reports; anything non-serializable falls back to String()).
// ---------------------------------------------------------------------------
figma.showUI(__html__, { width: 640, height: 680, themeColors: true });

const post = (msg) => figma.ui.postMessage(msg);

// The engine tabs override each generated script's WRONG FILE guard with the
// key of the file the designer is looking at (null on unshared drafts —
// which disables the guard, correctly: an unshared draft has no key).
post({ type: 'init', fileKey: figma.fileKey || '' });

function toPlain(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return String(value);
  }
}

// --- READ-ONLY GUARD (start) ------------------------------------------------
// `readOnly: true` used to be a WORD. The ui sent it on every audit run (the
// marker inventory, the apply log, the Send-tab dump, the brownfield file
// scan) and nothing here read it — those scripts executed with full plugin
// permissions and the label promised a safety the runner did not enforce.
//
// This is the enforcement. A read-only run gets a `figma` that is a hardened
// façade instead of the real global:
//
//   • every method whose name mutates (set* / create* / import* / delete*,
//     plus the named list below) THROWS a plain-words refusal naming the call;
//   • every property assignment, defineProperty and delete on any API object
//     reached through it THROWS the same way;
//   • reads pass through untouched — methods run with the RAW object as
//     `this`, and any wrapped object handed BACK to the API as an argument is
//     unwrapped first, so Figma never sees a proxy.
//
// Scope, stated honestly: this bounds the FIGMA API surface, which is the
// only way a plugin script can touch the document. It is not a VM sandbox —
// a script can still spin the CPU or read anything readable. That is exactly
// what the UI label claims and no more. `Paste a script` (the Advanced debug
// surface) deliberately does NOT go through here and says so.
function createReadOnlyFigma(target) {
  var NAMED_MUTATORS = [
    'remove', 'appendChild', 'insertChild', 'resize', 'resizeWithoutConstraints', 'rescale',
    'rotate', 'clone', 'detachInstance', 'swapComponent', 'attachInstance', 'combineAsVariants',
    'group', 'ungroup', 'flatten', 'union', 'subtract', 'intersect', 'exclude', 'resetOverrides',
    'insertCharacters', 'deleteCharacters', 'appendCharacters', 'saveVersionHistoryAsync',
    'commitUndo', 'triggerUndo', 'addComponentProperty', 'editComponentProperty',
    'appendChildren', 'reparent',
  ];
  var refusal = function (what) {
    return new Error(
      'Read-only run refused ' + what + ' — this is an audit of your file and cannot change it. ' +
      'Nothing was written.',
    );
  };
  var isMutatorName = function (name) {
    if (typeof name !== 'string') return false;
    if (name.indexOf('set') === 0 || name.indexOf('create') === 0 ||
        name.indexOf('import') === 0 || name.indexOf('delete') === 0) return true;
    return NAMED_MUTATORS.indexOf(name) >= 0;
  };
  var proxies = new WeakMap(); // raw → proxy (stable identity: node.parent === set still holds)
  var raws = new WeakMap();    // proxy → raw (argument unwrapping)
  var unwrapArg = function (v) {
    if (Array.isArray(v)) return v.map(unwrapArg);
    if (v && typeof v === 'object' && raws.has(v)) return raws.get(v);
    return v;
  };
  var wrap = function (value, isNamespace) {
    if (Array.isArray(value)) {
      return value.map(function (v) { return wrap(v, false); });
    }
    if (value === null || typeof value !== 'object') return value;
    // Wrap API OBJECTS: anything reached off the figma namespace, and
    // anything carrying an id (nodes, variables, collections, styles).
    if (!isNamespace && typeof value.id !== 'string') return value;
    if (proxies.has(value)) return proxies.get(value);
    // A non-configurable, non-writable data property must be returned
    // verbatim or the proxy invariant throws — honour it rather than wrap.
    var locked = function (t, prop, replacement, original) {
      if (replacement === original) return replacement;
      var desc = Object.getOwnPropertyDescriptor(t, prop);
      if (desc && desc.configurable === false && desc.writable === false && 'value' in desc) {
        return original;
      }
      return replacement;
    };
    var proxy = new Proxy(value, {
      get: function (t, prop) {
        var v = Reflect.get(t, prop, t);
        if (typeof v === 'function') {
          var fn = isMutatorName(prop)
            ? function () { throw refusal('figma.' + String(prop) + '()'); }
            : function () {
                var args = Array.prototype.slice.call(arguments).map(unwrapArg);
                var out = v.apply(t, args);
                if (out && typeof out.then === 'function') {
                  return out.then(function (r) { return wrap(r, false); });
                }
                return wrap(out, false);
              };
          return locked(t, prop, fn, v);
        }
        var isObj = v !== null && typeof v === 'object' && !Array.isArray(v);
        return locked(t, prop, wrap(v, isNamespace && isObj), v);
      },
      set: function (t, prop) { throw refusal('the assignment "' + String(prop) + ' = …"'); },
      defineProperty: function (t, prop) { throw refusal('defining "' + String(prop) + '"'); },
      deleteProperty: function (t, prop) { throw refusal('deleting "' + String(prop) + '"'); },
    });
    proxies.set(value, proxy);
    raws.set(proxy, value);
    return proxy;
  };
  return wrap(target, true);
}
// --- READ-ONLY GUARD (end) --------------------------------------------------

// Same execution shape both transports use: the generated scripts are plain
// async plugin bodies ending in `return <report>`. A read-only run shadows
// the `figma` global with the guarded façade above — same script text, same
// reports, no write reachable.
function runScript(code, opts) {
  if (opts && opts.readOnly) {
    return new Function('figma', 'return (async () => {\n' + code + '\n})()')(
      createReadOnlyFigma(figma),
    );
  }
  return new Function('return (async () => {\n' + code + '\n})()')();
}

// Put the node on screen: switch to its page, select it, zoom to it. The
// paste round-trip ends HERE, not in a JSON report — the designer should be
// looking at the thing the script built (or found).
async function selectAndZoom(node) {
  let page = node;
  while (page && page.type !== 'PAGE') page = page.parent;
  if (!page) return false;
  await figma.setCurrentPageAsync(page);
  page.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
  return true;
}

// The paste report's subject node, if the well-known shapes name one:
// single-component scripts return { nodeId, ... } (or { skipped, nodeId }),
// batch scripts return { results: [{ nodeId, ... }] }.
function reportSubject(report) {
  if (!report || typeof report !== 'object') return null;
  if (report.nodeId) return { nodeId: String(report.nodeId), skipped: !!report.skipped, name: report.name };
  if (Array.isArray(report.results) && report.results.length === 1 && report.results[0] && report.results[0].nodeId) {
    const r = report.results[0];
    return { nodeId: String(r.nodeId), skipped: !!r.skipped, name: r.name };
  }
  return null;
}

let busy = false; // one run at a time, across both modes

// The current selection's component set name(s) — the empty-names-box default
// for Send to Playground (a real UI kit's ALL-SETS dump is a megadump; the
// selection is almost always what the designer means). Each selected node
// resolves to the nearest component identity: an ancestor COMPONENT_SET, an
// ancestor COMPONENT (its owning set when it has one), or — for instances —
// the main component's owning set. Read-only; unresolvable nodes are skipped.
async function selectionSetNames() {
  const names = [];
  const add = (name) => {
    if (name && name !== 'Slot' && names.indexOf(name) < 0) names.push(name);
  };
  for (const node of figma.currentPage.selection) {
    let n = node;
    while (n && n.type !== 'PAGE') {
      if (n.type === 'COMPONENT_SET') { add(n.name); break; }
      if (n.type === 'COMPONENT') {
        add(n.parent && n.parent.type === 'COMPONENT_SET' ? n.parent.name : n.name);
        break;
      }
      if (n.type === 'INSTANCE') {
        try {
          const main = await n.getMainComponentAsync();
          if (main) add(main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : main.name);
        } catch (e) { /* detached/broken instance — no set to name */ }
        break;
      }
      n = n.parent;
    }
  }
  return names;
}

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'ui-ready') {
    post({ type: 'init', fileKey: figma.fileKey || '' });
    return;
  }
  if (msg.type === 'bridge-poll') {
    // Read-only network poll (Receive by code) — allowed anytime. Mirrors
    // the playground's pollBridge: worker refusals render verbatim.
    try {
      const res = await fetch(BRIDGE_BASE + '/bridge/' + encodeURIComponent(String(msg.code || '')));
      if (res.ok) {
        const body = await res.json();
        if (body && body.status === 'delivered') {
          post({ type: 'bridge-poll-result', replyTo: msg.replyTo, status: 'delivered', kind: body.kind || 'dump', dump: body.dump });
        } else {
          post({ type: 'bridge-poll-result', replyTo: msg.replyTo, status: 'waiting' });
        }
      } else {
        let workerMessage = null;
        try {
          const parsed = await res.json();
          if (parsed && typeof parsed.error === 'string') workerMessage = parsed.error;
        } catch (e) { /* non-JSON body */ }
        post({
          type: 'bridge-poll-result', replyTo: msg.replyTo, status: 'error',
          message: workerMessage || ('The bridge answered HTTP ' + res.status + ' with no named message.'),
        });
      }
    } catch (e) {
      // Transient network blip — keep the UI polling.
      post({ type: 'bridge-poll-result', replyTo: msg.replyTo, status: 'waiting' });
    }
    return;
  }
  if (msg.type === 'channel-key-load') {
    // Read-only, allowed anytime. The key is echoed back to the UI so the
    // field shows what is stored — it is a READ key, it cannot publish.
    let key = null;
    try {
      key = await figma.clientStorage.getAsync(CHANNEL_KEY_STORAGE_KEY);
    } catch (e) { /* no storage — the field simply starts empty */ }
    post({ type: 'channel-key', key: key || '' });
    return;
  }
  if (msg.type === 'channel-key-save') {
    const key = String(msg.key || '').trim();
    try {
      if (key) await figma.clientStorage.setAsync(CHANNEL_KEY_STORAGE_KEY, key);
      else await figma.clientStorage.deleteAsync(CHANNEL_KEY_STORAGE_KEY);
      post({ type: 'channel-key-saved', ok: true, key: key });
    } catch (e) {
      post({ type: 'channel-key-saved', ok: false, message: 'Could not save the channel key: ' + String(e && e.message ? e.message : e) });
    }
    return;
  }
  if (msg.type === 'ui-state-load') {
    // Read-only, allowed anytime. An unreadable value is simply "nothing
    // remembered" — the line it feeds is a courtesy, never a gate.
    let value = null;
    try {
      value = await figma.clientStorage.getAsync(UI_STATE_PREFIX + String(msg.key || ''));
    } catch (e) { /* no storage — the line simply does not show */ }
    post({ type: 'ui-state', key: String(msg.key || ''), value: value === undefined ? null : value });
    return;
  }
  if (msg.type === 'ui-state-save') {
    // Fire-and-forget: a remembered timestamp is never worth an error box.
    try {
      const value = msg.value;
      if (value === null || value === undefined) await figma.clientStorage.deleteAsync(UI_STATE_PREFIX + String(msg.key || ''));
      else await figma.clientStorage.setAsync(UI_STATE_PREFIX + String(msg.key || ''), value);
    } catch (e) { /* no storage — nothing is remembered, nothing breaks */ }
    return;
  }
  if (msg.type === 'channel-check') {
    // Read-only network peek — allowed anytime, never blocked by a run. The
    // read is NON-CONSUMING on the worker side: asking twice is free and
    // changes nothing, unlike the pairing bridge's deliver-once GET.
    const answer = (payload) => post(Object.assign({ type: 'channel-check-result', replyTo: msg.replyTo }, payload));
    const key = String(msg.key || '').trim();
    if (!key) return answer({ status: 'error', message: 'No channel key — paste the read key (dscr_…) your CI engineer minted with `ds-contracts figma claim-channel`.' });
    try {
      const since = Number.isFinite(Number(msg.since)) ? Number(msg.since) : 0;
      // `meta=1` asks for the HEAD only (no bundle) — the check-on-open
      // question is "is anything waiting?", and pulling up to 4 MB to answer
      // it would be rude. The explicit button asks the full question.
      const url = CHANNEL_BASE + '/channel/' + encodeURIComponent(key) +
        '?since=' + encodeURIComponent(String(since)) + (msg.metaOnly ? '&meta=1' : '');
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        return answer({
          status: body && body.status === 'update' ? 'update' : 'current',
          seq: body && typeof body.seq === 'number' ? body.seq : 0,
          publishedAt: (body && body.publishedAt) || null,
          bytes: (body && body.bytes) || null,
          provenance: (body && body.provenance) || null,
          bundle: body ? body.bundle : undefined,
          metaOnly: !!msg.metaOnly,
        });
      }
      // The worker's refusals are plain words already — show them verbatim.
      let workerMessage = null;
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed.error === 'string') workerMessage = parsed.error;
      } catch (e) { /* non-JSON error body */ }
      return answer({ status: 'error', message: workerMessage || ('The channel answered HTTP ' + res.status + ' with no named message.') });
    } catch (e) {
      return answer({ status: 'error', message: 'Could not reach the channel (' + String(e && e.message ? e.message : e) + ') — check your connection and try again.' });
    }
  }
  if (msg.type === 'push-proposal') {
    // Send-to-repo (the dev door): POST the Propose tab's export envelope to
    // the bridge under the pairing code `ds-contracts figma receive` printed.
    // Network-only — nothing in this file changes, nothing is stored; the
    // envelope leaves for the bridge and nowhere else. Allowed anytime.
    const answer = (ok, message) => post({ type: 'proposal-push-result', ok, message });
    try {
      const body = String(msg.body || '');
      if (!body) return answer(false, 'Nothing to send — run "Read the set & diff" first.');
      if (body.length > BRIDGE_MAX_DUMP_BYTES) {
        return answer(false, 'This proposal is too large for the bridge (' + (body.length / (1024 * 1024)).toFixed(1) + ' MB, cap 4 MB).');
      }
      const pairCode = String(msg.pairCode || '');
      const res = await fetch(BRIDGE_BASE + '/bridge/' + encodeURIComponent(pairCode), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      if (res.ok) {
        return answer(true, 'Delivered (' + Math.max(1, Math.round(body.length / 1024)) + ' KB) — the terminal showing code ' + pairCode + ' picks it up within a few seconds and prints the diff. Nothing lands in the repo without --apply there.');
      }
      // The worker's refusals are plain words already — show them verbatim.
      let workerMessage = null;
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed.error === 'string') workerMessage = parsed.error;
      } catch (e) { /* non-JSON error body */ }
      return answer(false, workerMessage || ('The bridge answered HTTP ' + res.status + ' with no named message — try again.'));
    } catch (e) {
      return answer(false, 'Could not reach the bridge (' + String(e && e.message ? e.message : e) + ') — check your connection and try again.');
    }
  }
  if (msg.type === 'query-selection-sets') {
    // Allowed anytime (read-only), like select-node.
    try {
      post({ type: 'selection-sets', names: await selectionSetNames() });
    } catch (e) {
      post({ type: 'selection-sets', names: [] });
    }
    return;
  }
  if (msg.type === 'select-node') {
    // Canvas focus only — allowed anytime, never blocked by a run.
    try {
      const node = await figma.getNodeByIdAsync(String(msg.nodeId || ''));
      if (!node || !(await selectAndZoom(node))) {
        figma.notify('Node ' + String(msg.nodeId) + ' was not found in this file.', { error: true });
        return;
      }
      figma.notify('Selected ' + node.name + '.');
    } catch (e) {
      figma.notify('Could not select the node: ' + String(e && e.message ? e.message : e), { error: true });
    }
    return;
  }
  if (msg.type === 'check-drift') {
    // DRIFT ROUND: recompute every generated set's canvas fingerprint and
    // compare with the stamp genesis wrote. Mismatch = the canvas was edited
    // after generation. (The contract-side twin: specHash — a freshly pasted
    // bundle whose hash differs means the CODE side moved.)
    try {
      await figma.loadAllPagesAsync();
      const rows = [];
      for (const page of figma.root.children) {
        const marked = page.findAll(function (n) {
          return (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
            n.getSharedPluginData('ds_contracts', 'contractId') &&
            !(n.parent && n.parent.type === 'COMPONENT_SET');
        });
        for (const node of marked) {
          const stored = node.getSharedPluginData('ds_contracts', 'canvasFingerprint');
          const fresh = dsCanvasFingerprint(node);
          // VERSION HONESTY (prototype-wiring round): the scheme moved v4→v5
          // (reactions became a tracked fact). A canvas stamped by an older
          // plugin is NOT "canvas-edited" — we simply cannot compare, and
          // saying "edited" would be a false alarm on an untouched file. Name
          // the version change and the remedy instead.
          const FP_VERSION = 'v5:';
          const olderStamp = stored && stored.indexOf('v') === 0 && stored.indexOf(':') > 0 && stored.indexOf(FP_VERSION) !== 0;
          const status = !stored
            ? 'unstamped (no fingerprint — re-run its sync script to baseline)'
            : olderStamp
              ? 'fingerprint version changed (' + stored.slice(0, stored.indexOf(':') + 1) + ' → ' + FP_VERSION + ') — regenerate to re-baseline; NOT a canvas edit'
              : stored === fresh ? 'in-sync' : 'canvas-edited';
          // LOCALIZE + EXPLAIN: on a set-level mismatch, drill into variant
          // stamps, and DIFF the stored snapshot against a fresh one so the
          // report says WHAT changed, not just that something did.
          const editedVariants = [];
          // LINE-SET diff with prefix pairing (live finding: the first key
          // parser truncated to the node id, so every fact on a node collided
          // and only the LAST one was compared — fill/description/propdef
          // edits all vanished). removed/added lines pair by their id|channel
          // prefix when the pairing is unambiguous; everything else lists as
          // (absent)/(removed).
          const diffSnapshots = function (storedLines, freshLines) {
            const inA = {}; storedLines.forEach(function (l) { inA[l] = true; });
            const inB = {}; freshLines.forEach(function (l) { inB[l] = true; });
            const removed = storedLines.filter(function (l) { return !inB[l]; });
            const added = freshLines.filter(function (l) { return !inA[l]; });
            const prefixOf = function (l) { var i = l.indexOf('|'); var j = l.indexOf('|', i + 1); return j > 0 ? l.slice(0, j) : l; };
            const valOf = function (l) { return l.slice(prefixOf(l).length + 1); };
            const remByPrefix = {};
            removed.forEach(function (l) { var k = prefixOf(l); (remByPrefix[k] = remByPrefix[k] || []).push(l); });
            const out = [];
            const usedRem = {};
            added.forEach(function (l) {
              var k = prefixOf(l);
              var candidates = (remByPrefix[k] || []).filter(function (r) { return !usedRem[r]; });
              if (candidates.length === 1) {
                usedRem[candidates[0]] = true;
                out.push({ what: k, was: valOf(candidates[0]), now: valOf(l) });
              } else {
                out.push({ what: k, was: '(absent)', now: valOf(l) });
              }
            });
            removed.forEach(function (l) {
              if (!usedRem[l]) out.push({ what: prefixOf(l), was: valOf(l), now: '(removed)' });
            });
            return out;
          };
          // v4: SET-LEVEL edits (description, added/removed properties)
          // diff against the set's own shallow snapshot.
          let setChanges = [];
          if (status === 'canvas-edited') {
            try {
              const setSnap = JSON.parse(node.getSharedPluginData('ds_contracts', 'canvasSetSnapshot') || '[]');
              setChanges = diffSnapshots(setSnap, dsCanvasSetSnapshot(node)).slice(0, 6);
            } catch (e) { /* pre-v4 — no set snapshot */ }
          }
          if (status === 'canvas-edited' && node.type === 'COMPONENT_SET') {
            for (const child of node.children) {
              const cs = child.getSharedPluginData('ds_contracts', 'canvasFingerprint');
              if (cs && cs.indexOf('v5:') === 0 && cs !== dsCanvasFingerprint(child)) {
                let changes = [];
                try {
                  const snap = JSON.parse(child.getSharedPluginData('ds_contracts', 'canvasSnapshot') || '[]');
                  changes = diffSnapshots(snap, dsCanvasSnapshot(child)).slice(0, 6);
                } catch (e) { /* snapshot unreadable — variant still listed */ }
                editedVariants.push({ nodeId: child.id, name: child.name, changes: changes });
              }
            }
          }
          rows.push({
            nodeId: node.id,
            name: node.name,
            page: page.name,
            contractId: node.getSharedPluginData('ds_contracts', 'contractId'),
            specHash: node.getSharedPluginData('ds_contracts', 'specHash'),
            status: status,
            editedVariants: editedVariants,
            setChanges: setChanges,
          });
        }
      }
      post({ type: 'drift-result', ok: true, rows: rows });
    } catch (e) {
      post({ type: 'drift-result', ok: false, error: String(e && e.message ? e.message : e) });
    }
    return;
  }
  if (busy) {
    figma.notify('A run is already in progress.', { error: true });
    return;
  }
  if (msg.type === 'engine-run') {
    // The engine tabs' execution path — the SAME runScript machinery as the
    // paste box; the ui supplies engine-emitted script text and correlates
    // by id. `focus` asks for the paste tab's select+zoom on the result.
    busy = true;
    try {
      // READ-ONLY: the ui's `readOnly` flag is now ENFORCED, not decorative —
      // the script runs against the guarded façade and any write throws.
      const result = await runScript(String(msg.code || ''), { readOnly: !!msg.readOnly });
      const plain = toPlain(result);
      let focus = null;
      if (msg.focus && !msg.readOnly) {
        try {
          const subject = reportSubject(plain);
          if (subject) {
            const node = await figma.getNodeByIdAsync(subject.nodeId);
            if (node && !subject.skipped && (await selectAndZoom(node))) {
              focus = { kind: 'selected', nodeId: subject.nodeId, name: subject.name || node.name };
            }
          }
        } catch (e) { /* focus is a courtesy */ }
      }
      post({ type: 'engine-result', id: msg.id, ok: true, result: plain, focus: focus });
    } catch (e) {
      post({
        type: 'engine-result', id: msg.id, ok: false,
        error: String(e && e.message ? e.message : e),
        stack: e && e.stack ? String(e.stack) : null,
      });
    }
    busy = false;
    return;
  }
  if (msg.type === 'run-paste') {
    busy = true;
    try {
      const result = await runScript(String(msg.code || ''));
      const plain = toPlain(result);
      // After the run, take the designer TO the result: created/amended →
      // select + zoom it; skipped (already exists) → hand the UI enough to
      // say so in plain words and offer a Select-it button.
      let focus = null;
      try {
        const subject = reportSubject(plain);
        if (subject) {
          const node = await figma.getNodeByIdAsync(subject.nodeId);
          if (node) {
            if (subject.skipped) {
              focus = { kind: 'skipped', nodeId: subject.nodeId, name: subject.name || node.name };
            } else if (await selectAndZoom(node)) {
              focus = { kind: 'selected', nodeId: subject.nodeId, name: subject.name || node.name };
            }
          }
        }
      } catch (e) { /* focus is a courtesy — the report below still stands */ }
      post({ type: 'paste-result', ok: true, result: plain, focus: focus });
      figma.notify('Pasted script finished.');
    } catch (e) {
      post({
        type: 'paste-result',
        ok: false,
        error: String(e && e.message ? e.message : e),
        stack: e && e.stack ? String(e.stack) : null,
      });
      figma.notify('Pasted script threw — see the plugin window.', { error: true });
    }
    busy = false;
  } else if (msg.type === 'run-runner') {
    busy = true;
    await runLocalRunner();
    busy = false;
  }
};

// ---------------------------------------------------------------------------
// Local runner — the original from-disk flow, now button-triggered from the
// UI instead of auto-running on plugin start. Behavior is unchanged:
// dependency order, integrity refusal, stop on first failure, results POSTed
// back to the server's /runner-result sink. Instead of closePlugin() the
// outcome now lands in the UI so the window stays open for another run.
// ---------------------------------------------------------------------------
async function runLocalRunner() {
  const done = (ok, summary) => post({ type: 'runner-done', ok, summary });
  const log = (line, level) => post({ type: 'runner-log', line, level: level || 'info' });

  const token = await figma.clientStorage.getAsync(TOKEN_STORAGE_KEY).catch(() => null);
  const withToken = (url) => (token ? url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token) : url);
  const get = async (pathname) => {
    const res = await fetch(withToken(BASE + pathname));
    if (res.status === 403) {
      throw new Error(
        'server requires a token (TOKEN=1). Copy the token from the figma:serve terminal, then run once in this plugin\'s console: await figma.clientStorage.setAsync(\'' +
          TOKEN_STORAGE_KEY + '\', \'<token>\')',
      );
    }
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + pathname);
    return res;
  };

  figma.notify('Sync Runner: fetching script list…');
  log('Fetching ' + BASE + '/runner-manifest.json …');
  let list;
  try {
    list = await (await get('/runner-manifest.json')).json();
  } catch (e) {
    return done(false, 'Sync Runner: ' + String(e && e.message ? e.message : e) + ' — is `npm run figma:serve` running?');
  }
  // Integrity map from the manifest ({ integrity: [{ name, sha256 }] }).
  // Older servers only send `scripts: [names]` — then there is nothing to
  // verify against and the runner says so rather than silently trusting.
  const expectedHash = {};
  if (Array.isArray(list.integrity)) {
    for (const entry of list.integrity) expectedHash[entry.name] = entry.sha256;
  } else {
    log('Manifest has no integrity hashes — running UNVERIFIED (update figma-serve.mjs)', 'warn');
    figma.notify('Sync Runner: manifest has no integrity hashes — running UNVERIFIED (update figma-serve.mjs)', { timeout: 4000 });
  }

  const results = [];
  const progress = (payload) =>
    fetch(withToken(BASE + '/runner-result'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  for (const name of list.scripts) {
    figma.notify('Running ' + name + '…', { timeout: 1500 });
    log('Running ' + name + ' …');
    await progress({ phase: 'starting', script: name, when: Date.now(), soFar: results });
    let code;
    try {
      code = await (await get('/' + name)).text();
    } catch (e) {
      return done(false, 'Fetch failed for ' + name + ': ' + String(e && e.message ? e.message : e));
    }
    // Refuse to execute bytes that do not match the manifest hash.
    if (expectedHash[name]) {
      const actual = sha256Hex(code);
      if (actual !== expectedHash[name]) {
        results.push({ script: name, ok: false, error: 'integrity mismatch' });
        await progress({ phase: 'integrity-failure', script: name, when: Date.now(), soFar: results });
        return done(false,
          'INTEGRITY FAILURE: ' + name + ' hash ' + actual.slice(0, 12) + '… does not match manifest ' +
            expectedHash[name].slice(0, 12) + '… — refusing to execute. Is something else answering on port 8765?',
        );
      }
    }
    try {
      const result = await runScript(code);
      results.push({ script: name, ok: true, result });
      log(name + ' — ok', 'ok');
      await progress({ phase: 'finished', script: name, when: Date.now(), soFar: results });
    } catch (e) {
      results.push({ script: name, ok: false, error: String(e && e.message ? e.message : e) });
      log(name + ' — FAILED: ' + String(e && e.message ? e.message : e), 'error');
      break; // dependency order matters — stop on first failure
    }
  }
  // Report back to the local server so the agent/CI can read the outcome.
  try {
    await fetch(withToken(BASE + '/runner-result'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKey: figma.fileKey || null, when: Date.now(), results }, null, 2),
    });
  } catch (e) { /* server may not accept POST; the summary below still shows */ }
  const failed = results.filter((r) => !r.ok);
  done(failed.length === 0, failed.length === 0
    ? 'Sync complete: ' + results.length + ' script(s) ran clean.'
    : 'FAILED at ' + failed[0].script + ': ' + failed[0].error);
}

// DRIFT ROUND — byte-identical copy of core/canvas-fingerprint.ts
// FINGERPRINT_SRC (v5). Keep in lockstep — the plugin-engine gate pins it
// by SUBSTRING COMPARISON (not just by evaluating the module copy).

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



