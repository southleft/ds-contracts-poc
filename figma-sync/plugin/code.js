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
figma.showUI(__html__, { width: 460, height: 620, themeColors: true });

const post = (msg) => figma.ui.postMessage(msg);

function toPlain(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return String(value);
  }
}

// Same execution shape both transports use: the generated scripts are plain
// async plugin bodies ending in `return <report>`.
function runScript(code) {
  return new Function('return (async () => {\n' + code + '\n})()')();
}

let busy = false; // one run at a time, across both modes

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.type) return;
  if (busy) {
    figma.notify('A run is already in progress.', { error: true });
    return;
  }
  if (msg.type === 'run-paste') {
    busy = true;
    try {
      const result = await runScript(String(msg.code || ''));
      post({ type: 'paste-result', ok: true, result: toPlain(result) });
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
