#!/usr/bin/env node
/**
 * Dual-stack stem + shot server for Desktop Bridge visual loops.
 *
 * Figma plugin `fetch` resolves `localhost` to IPv6. Capture receivers that
 * bind only `127.0.0.1` are unreachable from the plugin; zombie figma-console
 * instances on `[::1]:9223-9232` also steal `localhost`. This server binds `::`
 * (dual-stack) on an allowlisted port and serves:
 *
 *   GET  /status
 *   GET  /file?name=<file>          — raw text from the serve dir
 *   POST /register { name, path }   — copy a repo file into the serve dir
 *   POST /shot/:lib/:stem           — raw PNG → parity/receipts/console-loop/<lib>/shots/<stem>.png
 *
 * Usage:
 *   node scripts/console-loop-stem-serve.mjs [port=9223] [dir=/tmp/ds-stem-serve]
 *
 * Agent sync pattern (via figma_execute):
 *   const r = await fetch('http://localhost:9223/file?name=carbon-inline-notification.figma.js&ts='+Date.now());
 *   const code = await r.text();
 *   // tokens first when new vars were minted: run 00-tokens.figma.js the same way
 *   await figma.clientStorage.setAsync('ds_loop_script', code);
 *   return await eval('(async function(){\\n' + code + '\\n})()');
 *
 * Then export a representative VARIANT at scale 1 (not the COMPONENT_SET):
 *   const bytes = await cell.exportAsync({ format:'PNG', constraint:{ type:'SCALE', value:1 } });
 *   await fetch('http://localhost:9223/shot/<lib>/<stem>-cell', { method:'POST', body: bytes });
 *
 * Score (gate-shot / pair cell refs — never pair-- side-by-side receipts):
 *   npm run console-loop:developed-score -- --lib <lib> --stem <stem>
 *
 * Pass bar: compositionOk && pctAAMasked ≤ 5 — the ONE bar. The evidence
 * gates read the scorecard directly; receipts may claim a visual pass only
 * when the scorecard passes (no flip step, near-pass is a fail).
 */
import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || process.env.STEM_PORT || 9223);
const DIR = path.resolve(process.argv[3] || process.env.STEM_DIR || "/tmp/ds-stem-serve");
mkdirSync(DIR, { recursive: true });

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/" || url.pathname === "/status") {
    return json(res, 200, {
      ok: true,
      port: PORT,
      dir: DIR,
      files: readdirSync(DIR),
    });
  }

  if (url.pathname === "/file" && req.method === "GET") {
    const name = (url.searchParams.get("name") || "").replace(/[^A-Za-z0-9._-]/g, "_");
    // Allow ?ts= cache-bust: strip query already handled; name may include leftover
    const clean = name.split("?")[0];
    try {
      const data = readFileSync(path.join(DIR, clean));
      res.writeHead(200, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("no such file");
    }
    return;
  }

  if (url.pathname === "/register" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const abs = path.isAbsolute(body.path) ? body.path : path.join(ROOT, body.path);
    if (!existsSync(abs)) return json(res, 404, { ok: false, error: `missing ${abs}` });
    const name = String(body.name || path.basename(abs)).replace(/[^A-Za-z0-9._-]/g, "_");
    copyFileSync(abs, path.join(DIR, name));
    return json(res, 200, {
      ok: true,
      name,
      total: readFileSync(path.join(DIR, name)).length,
    });
  }

  // Raw JSON receiver — lets an in-Figma probe (fingerprint / round-trip
  // observation) land its result on disk for deterministic receipt building.
  const jsonMatch = url.pathname.match(/^\/json\/([^/]+)$/);
  if (jsonMatch && req.method === "POST") {
    const name = decodeURIComponent(jsonMatch[1]).replace(/[^A-Za-z0-9._-]/g, "_");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    try {
      JSON.parse(buf.toString("utf8"));
    } catch {
      return json(res, 400, { ok: false, error: "expected JSON body" });
    }
    const out = path.join(DIR, `${name}.json`);
    writeFileSync(out, buf);
    return json(res, 200, { ok: true, path: out, bytes: buf.length });
  }

  const shotMatch = url.pathname.match(/^\/shot\/([^/]+)\/([^/]+)$/);
  if (shotMatch && req.method === "POST") {
    const lib = decodeURIComponent(shotMatch[1]);
    const stem = decodeURIComponent(shotMatch[2]);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if (buf.length < 8 || buf[0] !== 0x89) {
      return json(res, 400, { ok: false, error: "expected raw PNG body", got: buf.length });
    }
    // first-party lane lives at the console-loop ROOT (shots/ directly under
    // parity/receipts/console-loop), matching console-loop-developed-score's
    // laneRoot(); foreign lanes nest under their lib name.
    const outDir =
      lib === "first-party"
        ? path.join(ROOT, "parity/receipts/console-loop", "shots")
        : path.join(ROOT, "parity/receipts/console-loop", lib, "shots");
    mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${stem}.png`);
    writeFileSync(out, buf);
    return json(res, 200, { ok: true, path: out, bytes: buf.length });
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "::", () => {
  console.log(
    `console-loop stem-serve dual-stack on http://localhost:${PORT} → ${DIR}`,
  );
});
