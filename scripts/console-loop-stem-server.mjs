#!/usr/bin/env node
/**
 * Tiny localhost stem server for Figma Console fetch+eval of large *.figma.js scripts.
 *   GET  /manifest.json → { ok, stems }
 *   GET  /stem/:name    → { ok, stem, total, code }
 *   POST /stem/:name    body: raw script text OR JSON {code}
 *   POST /register      body: JSON { name, path } — load path from disk
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.STEM_PORT || 9230);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
/** @type {Map<string, string>} */
const stems = new Map();

function seedDefaults() {
  const defaults = {
    "carbon-checkbox": "examples/carbon/figma/checkbox.figma.js",
    checkbox: "examples/carbon/figma/checkbox.figma.js",
    "polaris-button": "examples/polaris/figma/button.figma.js",
    "astryx-switch": "examples/astryx/figma/switch.figma.js",
    switch: "examples/astryx/figma/switch.figma.js",
    slider: "examples/astryx/figma/slider.figma.js",
    "toggle-switch": "examples/tailwind/figma/toggle-switch.figma.js",
    "altitude-badge": "examples/altitude/figma/badge.figma.js",
    "polaris-text-field": "examples/polaris/figma/text-field.figma.js",
    "astryx-toast": "examples/astryx/figma/toast.figma.js",
    "astryx-progress-bar": "examples/astryx/figma/progress-bar.figma.js",
    "astryx-button": "examples/astryx/figma/button.figma.js",
  };
  for (const [name, rel] of Object.entries(defaults)) {
    const abs = path.join(ROOT, rel);
    if (existsSync(abs)) stems.set(name, readFileSync(abs, "utf8"));
  }
}

seedDefaults();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  if (url.pathname === "/" || url.pathname === "/manifest.json" || url.pathname === "/status") {
    return json(res, 200, { ok: true, stems: [...stems.keys()], port: PORT });
  }
  const stemMatch = url.pathname.match(/^\/stem\/([^/]+)$/);
  if (stemMatch && req.method === "GET") {
    const name = decodeURIComponent(stemMatch[1]);
    const code = stems.get(name);
    if (!code) return json(res, 404, { ok: false, error: `unknown stem ${name}` });
    return json(res, 200, { ok: true, stem: name, total: code.length, code });
  }
  if (stemMatch && req.method === "POST") {
    const name = decodeURIComponent(stemMatch[1]);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let code = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.code === "string") code = parsed.code;
      if (parsed && typeof parsed.path === "string") {
        const abs = path.isAbsolute(parsed.path) ? parsed.path : path.join(ROOT, parsed.path);
        code = readFileSync(abs, "utf8");
      }
    } catch {
      /* raw script body */
    }
    stems.set(name, code);
    return json(res, 200, { ok: true, stem: name, total: code.length });
  }
  if (url.pathname === "/register" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const abs = path.isAbsolute(body.path) ? body.path : path.join(ROOT, body.path);
    const code = readFileSync(abs, "utf8");
    stems.set(body.name, code);
    return json(res, 200, { ok: true, stem: body.name, total: code.length });
  }
  // POST /shot/:lib/:stem  — raw PNG body → parity/receipts/console-loop/<lib>/shots/<stem>.png
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
    const dir = path.join(ROOT, "parity/receipts/console-loop", lib, "shots");
    mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${stem}.png`);
    writeFileSync(out, buf);
    return json(res, 200, { ok: true, path: path.relative(ROOT, out), bytes: buf.length });
  }
  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`console-loop stem server on http://127.0.0.1:${PORT} stems=${stems.size}`);
});
