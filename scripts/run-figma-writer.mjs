#!/usr/bin/env node
/**
 * Execute a prepared writer program against the Scratch Figma file.
 *
 * The signed archetypes (input-field, combobox, table, calendar) each carry a
 * per-version `private/<archetype>-live-vN-mcp-operator.mjs` that replays one
 * signed request. The boilerplate archetypes have no signed protocol — their
 * `build-*-live-proof-vN.ts` just emits `writer.js` — and there was no way to
 * run one without pasting 60-150 KB of program text through a tool call.
 *
 * This is that runner. It is deliberately generic and deliberately small:
 * connect, send one `figma_execute`, print the raw result, exit.
 *
 * SAFETY, and none of it is optional:
 *   - The target file key is pinned to Scratch. Any other file is refused
 *     before the transport opens.
 *   - The three protected pages (Input 115:295378, Combobox 163:35981,
 *     Button 85:6781) are refused if they appear anywhere in the program text.
 *   - The token is read from .env.local and never printed.
 *   - The raw response is written to disk so a failed run leaves evidence.
 *
 *   node scripts/run-figma-writer.mjs \
 *     --writer recipe/evidence/checkbox-live-pivot-v4/writer.js \
 *     --output private/checkbox-v4-writer.raw.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SDK_ROOT =
  "/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm";
const LOCAL_JS = "/Users/tjpitre/Sites/figma-console-mcp/dist/local.js";
const TARGET = {
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  fileName: "Scratch Project",
};
const PROTECTED_PAGES = ["115:295378", "163:35981", "85:6781"];

const argument = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1) return process.argv[i + 1];
  return process.argv
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const writerPath = resolve(argument("writer") ?? "");
const outputPath = resolve(argument("output") ?? "");
const waitMs = Number(argument("wait-ms") ?? "180000");
if (!writerPath || !outputPath) {
  throw new Error("usage: --writer <program.js> --output <raw.json>");
}
if (existsSync(outputPath)) throw new Error(`output already exists: ${outputPath}`);

const code = readFileSync(writerPath, "utf8");

// A protected page id may legitimately appear in a writer — the writers carry
// their own `if (currentPage.id === "115:295378") throw MUST-NOT-WRITE-…`
// guards, and refusing those would refuse exactly the programs that are
// safest. So the check is not "does this id appear" but "does every occurrence
// sit inside such a guard". An id that shows up anywhere else is a target, and
// a target is refused.
for (const page of PROTECTED_PAGES) {
  let from = 0;
  for (;;) {
    const at = code.indexOf(page, from);
    if (at < 0) break;
    const window = code.slice(at, at + 160);
    if (!/MUST-NOT-WRITE/.test(window)) {
      throw new Error(
        `writer names protected page ${page} outside a MUST-NOT-WRITE guard (offset ${at}) — refusing to run`,
      );
    }
    from = at + page.length;
  }
}
// --plugin-target: the program is the product-path writer (no file pin by
// design). This runner still only ever talks to Scratch — TARGET above is the
// runner's own pin — so executing an unpinned program here is the honest
// rehearsal of what the shipped plugin's Paste-a-script verb does in a user's
// file, without the program knowing which file it is in.
const pluginTarget = process.argv.includes("--plugin-target");
if (!pluginTarget && !code.includes(TARGET.fileKey)) {
  // A writer that never names the Scratch key is not a writer for this file.
  throw new Error(`writer does not pin ${TARGET.fileKey} — refusing to run (pass --plugin-target for a plugin-target program)`);
}
if (pluginTarget && code.includes(TARGET.fileKey)) {
  throw new Error("--plugin-target given but the program pins the Scratch key — that is a scratch-target writer");
}

const loadEnvFile = (file, into) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || m[1].startsWith("#")) continue;
    into[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
};
const env = {};
loadEnvFile(".env.local", env);
loadEnvFile(".env", env);
const token =
  env.FIGMA_TOKEN ||
  env.FIGMA_ACCESS_TOKEN ||
  process.env.FIGMA_TOKEN ||
  process.env.FIGMA_ACCESS_TOKEN ||
  "";

const { Client } = await import(pathToFileURL(`${SDK_ROOT}/client/index.js`).href);
const { StdioClientTransport } = await import(
  pathToFileURL(`${SDK_ROOT}/client/stdio.js`).href,
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [LOCAL_JS],
  env: { ...process.env, FIGMA_TOKEN: token, FIGMA_ACCESS_TOKEN: token },
  stderr: "pipe",
});
const client = new Client({ name: "figma-writer-runner", version: "1" }, { capabilities: {} });
await client.connect(transport);

const parseTool = (result) => {
  const text =
    result.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(result);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, isError: result.isError === true };
  }
};
const call = async (name, args, timeout = 60_000) =>
  parseTool(await client.callTool({ name, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout }));

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

// figma_execute defaults to a 5 s execution budget (max 300 s). A three-library
// set with six variants each needs more; the alert's twelve fit by luck.
const result = await call("figma_execute", { code, fileKey: TARGET.fileKey, timeout: Math.min(waitMs, 300_000) }, waitMs);
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
await client.close();

const ok = result?.success === true;
console.log(
  JSON.stringify({ ok, output: outputPath, summary: result?.result ?? result?.error ?? null }).slice(0, 2000),
);
process.exit(ok ? 0 : 1);
