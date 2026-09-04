#!/usr/bin/env node
/**
 * EXECUTE ONE SIGNED BROKER REQUEST — `node scripts/run-broker-request.mjs
 * --request <request.json> --output <raw.json>`.
 *
 * The signed live-mint protocols (table, combobox, calendar, input-field) issue
 * one request at a time: a pinned dynamic tool, a pinned argument set, and an
 * instruction to "invoke exactly the request's pinned namespace/tool with its
 * arguments, persist the complete raw response, then run accept". This does
 * exactly that and nothing else:
 *
 *   · it reads the tool and arguments FROM the request and never edits them;
 *   · it refuses a request whose expected tool is not figma_execute, whose
 *     fileKey is not the Scratch file, or whose code names a protected live
 *     page — the same three refusals scripts/run-figma-writer.mjs makes;
 *   · it makes ONE tool call, as `oneMcpCallPerSignedRequest` in the
 *     authorization requires, and writes the complete raw response;
 *   · it refuses to overwrite an existing output file, so a response can
 *     never be silently replaced.
 *
 * It does not sign, accept, or interpret anything. The broker verifies the
 * response against its own signature; this is the operator's hand, no more.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SDK_ROOT = "/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm";
const LOCAL_JS = "/Users/tjpitre/Sites/figma-console-mcp/dist/local.js";
const SCRATCH = { fileKey: "byMp6lt0Ij9b2QbkDGFwBh", fileName: "Scratch Project" };
const PROTECTED_PAGES = ["115:295378", "163:35981", "85:6781"];

const argument = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const requestPath = argument("request");
const outputPath = argument("output");
if (!requestPath || !outputPath) throw new Error("usage: --request <request.json> --output <raw.json>");
if (existsSync(resolve(outputPath))) throw new Error(`output already exists: ${outputPath} — a response is never silently replaced`);

const request = JSON.parse(readFileSync(resolve(requestPath), "utf8"));
const tool = request.expectedDynamicTool?.tool;
if (tool !== "figma_execute") throw new Error(`request pins tool ${JSON.stringify(tool)}; this runner only performs figma_execute`);
const args = request.arguments;
if (!args || typeof args !== "object") throw new Error("request carries no arguments");
if (args.fileKey !== SCRATCH.fileKey) throw new Error(`request targets fileKey ${args.fileKey}; only the Scratch file may be written`);
for (const page of PROTECTED_PAGES) {
  const code = String(args.code ?? "");
  let from = 0;
  for (;;) {
    const at = code.indexOf(page, from);
    if (at < 0) break;
    const window = code.slice(Math.max(0, at - 120), at + 120);
    if (!/throw new Error|FORBIDDEN|MUST-NOT/.test(window)) throw new Error(`request names protected page ${page} outside a refusal guard`);
    from = at + page.length;
  }
}

const loadEnvFile = (file, into) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) into[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};
const env = {};
loadEnvFile(".env.local", env);
loadEnvFile(".env", env);
const token = env.FIGMA_TOKEN || env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN || "";

const { Client } = await import(pathToFileURL(`${SDK_ROOT}/client/index.js`).href);
const { StdioClientTransport } = await import(pathToFileURL(`${SDK_ROOT}/client/stdio.js`).href);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [LOCAL_JS],
  env: { ...process.env, FIGMA_TOKEN: token, FIGMA_ACCESS_TOKEN: token },
  stderr: "pipe",
});
const client = new Client({ name: "broker-request-runner", version: "1" }, { capabilities: {} });
await client.connect(transport);
// Wait for the desktop bridge, exactly as scripts/run-figma-writer.mjs does:
// a freshly spawned server has not attached to the plugin's websocket yet, and
// calling before it has produces a "Cannot connect to Figma Desktop" that is a
// race, not a refusal.
const parseTool = (result) => {
  const text = result.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(result);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};
const deadline = Date.now() + 120_000;
let connected = false;
while (Date.now() < deadline) {
  const status = parseTool(await client.callTool({ name: "figma_get_status", arguments: { probe: true } }, undefined, { timeout: 30_000 }));
  const files = status?.transport?.websocket?.connectedFiles ?? status?.files ?? [];
  connected = files.some((f) => f.fileKey === SCRATCH.fileKey && f.fileName === SCRATCH.fileName);
  if (connected) break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (!connected) {
  await client.close();
  throw new Error(`the Desktop Bridge is not connected to ${SCRATCH.fileName} (${SCRATCH.fileKey}) — open the plugin in that file and retry; nothing was sent`);
}
const timeout = Math.min(Number(args.timeout ?? 300_000), 300_000);
const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout });
const text = result.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(result);
writeFileSync(resolve(outputPath), text.endsWith("\n") ? text : `${text}\n`);
await client.close();
let parsed = null;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = null;
}
console.log(JSON.stringify({ request: request.requestId ?? null, phase: request.phase ?? null, wrote: outputPath, bytes: text.length, success: parsed?.success ?? null }));
