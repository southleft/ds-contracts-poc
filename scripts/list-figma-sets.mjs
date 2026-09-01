#!/usr/bin/env node
/**
 * READ-ONLY inventory of the component sets on named Scratch pages: set name,
 * variant names, top-level child names and sizes. Used to author fidelity
 * manifest rows without guessing names. Zero writes — findAll + geometry only.
 *
 *   node scripts/list-figma-sets.mjs --pages 198:77456,183:75801 [--out file.json]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SDK_ROOT = "/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm";
const LOCAL_JS = "/Users/tjpitre/Sites/figma-console-mcp/dist/local.js";
const TARGET = { fileKey: "byMp6lt0Ij9b2QbkDGFwBh", fileName: "Scratch Project" };
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const pages = (arg("pages") ?? "").split(",").filter(Boolean);
if (pages.length === 0) throw new Error("--pages required");

const loadEnv = (file, into) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !m[1].startsWith("#")) into[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
};
const env = {}; loadEnv(path.join(REPO, ".env.local"), env); loadEnv(path.join(REPO, ".env"), env);
const token = env.FIGMA_TOKEN || env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN || "";
const { Client } = await import(pathToFileURL(`${SDK_ROOT}/client/index.js`).href);
const { StdioClientTransport } = await import(pathToFileURL(`${SDK_ROOT}/client/stdio.js`).href);
const transport = new StdioClientTransport({ command: process.execPath, args: [LOCAL_JS], env: { ...process.env, FIGMA_TOKEN: token, FIGMA_ACCESS_TOKEN: token }, stderr: "pipe" });
const client = new Client({ name: "figma-set-inventory", version: "1" }, { capabilities: {} });
await client.connect(transport);
const parse = (r) => { const t = r.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(r); try { return JSON.parse(t); } catch { return { raw: t }; } };
const call = async (name, args, timeout = 120_000) => parse(await client.callTool({ name, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout }));
const deadline = Date.now() + 120_000; let connected = false;
while (Date.now() < deadline) {
  const s = await call("figma_get_status", { probe: true });
  const files = s?.transport?.websocket?.connectedFiles ?? s?.files ?? [];
  if ((connected = files.some((f) => f.fileKey === TARGET.fileKey && f.fileName === TARGET.fileName))) break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (!connected) { await client.close(); throw new Error("Scratch file not connected"); }
const code = `
await figma.loadAllPagesAsync();
const out = [];
for (const id of ${JSON.stringify(pages)}) {
  const page = await figma.getNodeByIdAsync(id);
  if (!page || page.type !== "PAGE") { out.push({ page: id, error: "no page" }); continue; }
  const sets = page.findAllWithCriteria({ types: ["COMPONENT_SET"] }).map((s) => ({
    id: s.id, name: s.name, w: Math.round(s.width), h: Math.round(s.height),
    variants: s.children.map((v) => ({ name: v.name, w: Math.round(v.width), h: Math.round(v.height),
      children: v.children.map((c) => ({ name: c.name, type: c.type, w: Math.round(c.width), h: Math.round(c.height) })) })),
  }));
  out.push({ page: id, pageName: page.name, sets });
}
return out;`;
const res = await call("figma_execute", { code, fileKey: TARGET.fileKey });
await client.close();
if (!res?.success) { console.error(JSON.stringify(res).slice(0, 800)); process.exit(1); }
const out = arg("out"); if (out) writeFileSync(out, JSON.stringify(res.result, null, 2));
for (const p of res.result) {
  console.log(`\n## ${p.page} ${p.pageName ?? ""} ${p.error ?? ""}`);
  for (const s of p.sets ?? []) {
    console.log(`  SET ${s.name}  (${s.w}x${s.h}, ${s.variants.length} variants)`);
    for (const v of s.variants.slice(0, 4)) console.log(`     ${v.name} ${v.w}x${v.h} :: ${v.children.map((c) => c.name + "[" + c.w + "x" + c.h + "]").join(", ")}`);
    if (s.variants.length > 4) console.log(`     … ${s.variants.length - 4} more`);
  }
}
