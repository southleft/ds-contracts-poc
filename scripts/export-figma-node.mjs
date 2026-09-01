#!/usr/bin/env node
/**
 * Export a Figma node to a PNG on disk, read-only.
 *
 * The fidelity gate needs canvas shots as files. Passing them back as base64
 * through a conversation is lossy — a long string gets truncated and the PNG
 * lands corrupt, which then looks like a decoder bug rather than a transport
 * one. This writes the bytes straight from the plugin to a file.
 *
 * Read-only by construction: the only plugin call is `exportAsync`. It creates,
 * mutates and deletes nothing, and it pins the Scratch file key.
 *
 *   node scripts/export-figma-node.mjs --node 199:78941 --out shots/x.png
 *   node scripts/export-figma-node.mjs --node 199:78941 --child switch/thumb --out shots/t.png
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SDK_ROOT =
  "/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm";
const LOCAL_JS = "/Users/tjpitre/Sites/figma-console-mcp/dist/local.js";
const TARGET = { fileKey: "byMp6lt0Ij9b2QbkDGFwBh", fileName: "Scratch Project" };

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1) return process.argv[i + 1];
  return process.argv.find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
};

const nodeId = arg("node");
const outPath = arg("out");
const childPrefix = arg("child") ?? null;
const scale = Number(arg("scale") ?? "1");
if (!nodeId || !outPath) throw new Error("usage: --node <id> --out <file.png> [--child <name-prefix>] [--scale n]");

const loadEnv = (file, into) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !m[1].startsWith("#")) into[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
};
const env = {};
loadEnv(".env.local", env);
loadEnv(".env", env);
const token = env.FIGMA_TOKEN || env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN || "";

const { Client } = await import(pathToFileURL(`${SDK_ROOT}/client/index.js`).href);
const { StdioClientTransport } = await import(pathToFileURL(`${SDK_ROOT}/client/stdio.js`).href);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [LOCAL_JS],
  env: { ...process.env, FIGMA_TOKEN: token, FIGMA_ACCESS_TOKEN: token },
  stderr: "pipe",
});
const client = new Client({ name: "figma-node-exporter", version: "1" }, { capabilities: {} });
await client.connect(transport);

const parse = (r) => {
  const text = r.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(r);
  try { return JSON.parse(text); } catch { return { raw: text }; }
};
const call = async (name, args, timeout = 60_000) =>
  parse(await client.callTool({ name, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout }));

// Wait for the Scratch file to be connected, the same way the writer runner
// does. Without this the first call races the plugin's websocket and fails with
// a "Cannot connect to Figma Desktop" that looks like a setup problem.
const waitMs = Number(arg("wait-ms") ?? "120000");
const deadline = Date.now() + waitMs;
let connected = false;
while (Date.now() < deadline) {
  const status = await call("figma_get_status", { probe: true });
  const files = status?.transport?.websocket?.connectedFiles ?? status?.files ?? [];
  connected = files.some((f) => f.fileKey === TARGET.fileKey && f.fileName === TARGET.fileName);
  if (connected) break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (!connected) {
  await client.close();
  throw new Error(`Scratch ${TARGET.fileKey} not connected after ${waitMs}ms`);
}

// The plugin cannot hand back a Buffer, so bytes come across as an array of
// numbers rather than base64 — no string length limit to truncate against.
const code = `
const target = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
if (!target) throw new Error("no node ${nodeId}");
let node = target;
${childPrefix ? `node = target.findOne(n => String(n.name).startsWith(${JSON.stringify(childPrefix)})) || target;` : ""}
const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: ${scale} } });
return { id: node.id, name: node.name, w: Math.round(node.width), h: Math.round(node.height), bytes: Array.from(bytes) };
`;

const result = await call("figma_execute", { code, fileKey: TARGET.fileKey }, 120_000);
await client.close();

if (!result?.success || !result?.result?.bytes) {
  throw new Error(`export failed: ${JSON.stringify(result?.error ?? result).slice(0, 300)}`);
}
const { id, name, w, h, bytes } = result.result;
mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
writeFileSync(outPath, Buffer.from(bytes));
console.log(JSON.stringify({ ok: true, id, name, size: `${w}x${h}`, bytes: bytes.length, out: outPath }));
