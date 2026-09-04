/**
 * HOSTED ENGINE PIN — `npm run deploy:pin:check`.
 *
 * AUD-U22 (closed 2026-09-03 by disposition, option 2): the hosted no-clone
 * plugin zip carries an engine that is not HEAD's, and docs/00 now says so
 * beside the download. This guard re-fetches the hosted zip, reads the engine
 * block its ui.html carries, and refuses if it no longer matches the pin
 * below or if docs/00 no longer states that pin — so the page cannot drift
 * silently in either direction. A deploy (option 1, V1-REL-02) replaces the
 * pin with a receipt; until then the pin is the truth on the page.
 * Unreachable host = refusal, not a pass.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = "https://ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip";
const PIN = { zipBytes: 942148, zipSha12: "af19cc985469", engineBytes: 716887, engineSha12: "e2eea33783b9", pinnedOn: "2026-09-03" };
const sha12 = (b) => createHash("sha256").update(b).digest("hex").slice(0, 12);

const docs = readFileSync(path.join(ROOT, "docs/00-choose-your-path.md"), "utf8");
for (const needle of [PIN.engineSha12, PIN.zipSha12, String(PIN.engineBytes).replace(/\B(?=(\d{3})+(?!\d))/g, ",")]) {
  if (!docs.includes(needle)) { console.error(`✖ deploy:pin:check — docs/00 no longer states the pinned engine (${needle} missing)`); process.exit(1); }
}
let zip;
try {
  const res = await fetch(URL_, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  zip = Buffer.from(await res.arrayBuffer());
} catch (e) {
  console.error(`✖ deploy:pin:check — could not fetch ${URL_} (${String(e).slice(0, 120)}); a guard that cannot look does not say clean`);
  process.exit(1);
}
// Minimal zip reader: find ui.html's local header and inflate it.
const findEntry = (buf, name) => {
  let off = 0;
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8), csize = buf.readUInt32LE(off + 18), nlen = buf.readUInt16LE(off + 26), xlen = buf.readUInt16LE(off + 28);
    const fname = buf.subarray(off + 30, off + 30 + nlen).toString("utf8");
    const data = buf.subarray(off + 30 + nlen + xlen, off + 30 + nlen + xlen + csize);
    if (fname.endsWith(name)) return method === 8 ? inflateRawSync(data) : data;
    off += 30 + nlen + xlen + csize;
  }
  return null;
};
const ui = findEntry(zip, "ui.html");
if (!ui) { console.error("✖ deploy:pin:check — the hosted zip carries no ui.html"); process.exit(1); }
const m = /<script[^>]*id="plugin-engine"[^>]*>([\s\S]*?)<\/script>/.exec(ui.toString("utf8"));
if (!m) { console.error("✖ deploy:pin:check — the hosted ui.html carries no #plugin-engine block"); process.exit(1); }
const engine = Buffer.from(m[1], "utf8");
const got = { zipBytes: zip.length, zipSha12: sha12(zip), engineBytes: engine.length, engineSha12: sha12(engine) };
const drift = Object.keys(got).filter((k) => got[k] !== PIN[k]);
if (drift.length) {
  console.error(`✖ deploy:pin:check — the hosted zip no longer matches the pin of ${PIN.pinnedOn}: ${drift.map((k) => `${k} ${PIN[k]} → ${got[k]}`).join(", ")}. Re-pin docs/00 and this script deliberately, or record the deploy (V1-REL-02).`);
  process.exit(1);
}
console.log(`✔ deploy:pin:check — the hosted zip carries the pinned engine (${got.engineBytes} B, ${got.engineSha12}…), as docs/00 states`);
