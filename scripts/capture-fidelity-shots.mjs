#!/usr/bin/env node
/**
 * Re-export every canvas shot the fidelity gate scores.
 *
 * This is the ONLY step that touches Figma, and it is read-only: the single
 * plugin call per subject is `exportAsync`. The gate itself
 * (`npm run recipe:fidelity:check`) never opens a connection — it scores
 * committed bytes, so it runs in CI and a score is reproducible from the repo.
 *
 * Subjects are resolved by NAME (page → component set → variant → child), not
 * by node id, so a remint that changes ids does not silently score the old
 * page. If a name no longer resolves, this fails rather than exporting
 * something adjacent.
 *
 * `child` prefers a DIRECT child and falls back to the first matching
 * descendant, because not every archetype puts its control at the top: a
 * checkbox variant holds `checkbox/hit` directly, while a radio variant holds
 * `radio/item/a` which holds `radio/hit`. Depth-first order means the fallback
 * takes the first item's control, which is the one the variant is named for.
 *
 *   npm run recipe:fidelity:capture
 *   npm run recipe:fidelity:capture -- --label switch/mui
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SDK_ROOT =
  "/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm";
const LOCAL_JS = "/Users/tjpitre/Sites/figma-console-mcp/dist/local.js";
const TARGET = { fileKey: "byMp6lt0Ij9b2QbkDGFwBh", fileName: "Scratch Project" };
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const only = arg("label");
// --page <id> overrides every selected subject's page (a rehearsal mint on
// another page); --shot-suffix <s> writes "<shot>-<s>.png" so the committed
// shot is untouched. Together they score a page without editing the manifest.
const pageOverride = arg("page");
const shotSuffix = arg("shot-suffix");

const manifest = JSON.parse(readFileSync(path.join(REPO, "recipe/fidelity-manifest.json"), "utf8"));
const subjects = manifest.subjects
  .filter((s) => !only || s.label === only || (only.endsWith("/*") && s.label.startsWith(only.slice(0, -1))))
  .map((s) => ({ ...s, page: pageOverride ?? s.page, shot: shotSuffix ? s.shot.replace(/\.png$/, `-${shotSuffix}.png`) : s.shot }));
if (subjects.length === 0) throw new Error(`no subject matches --label ${only}`);

const loadEnv = (file, into) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !m[1].startsWith("#")) into[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
};
const env = {};
loadEnv(path.join(REPO, ".env.local"), env);
loadEnv(path.join(REPO, ".env"), env);
const token = env.FIGMA_TOKEN || env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN || "";

const { Client } = await import(pathToFileURL(`${SDK_ROOT}/client/index.js`).href);
const { StdioClientTransport } = await import(pathToFileURL(`${SDK_ROOT}/client/stdio.js`).href);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [LOCAL_JS],
  env: { ...process.env, FIGMA_TOKEN: token, FIGMA_ACCESS_TOKEN: token },
  stderr: "pipe",
});
const client = new Client({ name: "fidelity-shot-capture", version: "1" }, { capabilities: {} });
await client.connect(transport);

const parse = (r) => {
  const text = r.content?.find((p) => p.type === "text")?.text ?? JSON.stringify(r);
  try { return JSON.parse(text); } catch { return { raw: text }; }
};
const call = async (name, args, timeout = 120_000) =>
  parse(await client.callTool({ name, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout }));

const deadline = Date.now() + 120_000;
let connected = false;
while (Date.now() < deadline) {
  const status = await call("figma_get_status", { probe: true });
  const files = status?.transport?.websocket?.connectedFiles ?? status?.files ?? [];
  connected = files.some((f) => f.fileKey === TARGET.fileKey && f.fileName === TARGET.fileName);
  if (connected) break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (!connected) { await client.close(); throw new Error("Scratch file not connected"); }

let failures = 0;
for (const s of subjects) {
  const code = `
await figma.loadAllPagesAsync();
const page = await figma.getNodeByIdAsync(${JSON.stringify(s.page)});
if (!page || page.type !== "PAGE") throw new Error("no page ${s.page}");
let variant;
if (${JSON.stringify(s.component ?? null)}) {
  // A single COMPONENT resolved by name — the boilerplate v1 stays live as
  // one component inside a wrap frame inside a per-library section.
  const matches = page.findAllWithCriteria({ types: ["COMPONENT"] })
    .filter(n => n.name === ${JSON.stringify(s.component ?? null)});
  if (matches.length !== 1) throw new Error("expected exactly one component named " + ${JSON.stringify(s.component ?? null)} + " on " + page.name + ", found " + matches.length);
  variant = matches[0];
} else {
  const set = page.findAllWithCriteria({ types: ["COMPONENT_SET"] })
    .find(n => n.name === ${JSON.stringify(s.set ?? null)});
  if (!set) throw new Error("no set " + ${JSON.stringify(s.set ?? null)} + " on " + page.name);
  variant = set.children.find(c => c.name === ${JSON.stringify(s.variant ?? null)});
  if (!variant) throw new Error("no variant " + ${JSON.stringify(s.variant ?? null)});
}
let node = variant;
// exportParent: export the wrap frame around the component instead of the
// component itself — Figma clips a node-box export to the node, so an
// anchored overlay that overhangs its host (badge) is cut off. The wrap
// frame contains the overhang; the scorer's ink trim removes the margin.
${s.exportParent ? `node = variant.parent; if (!node) throw new Error("no parent to export");` : ""}
${s.child ? `node = variant.children.find(c => String(c.name).startsWith(${JSON.stringify(s.child)}))
  || variant.findOne(n => String(n.name).startsWith(${JSON.stringify(s.child)}));
if (!node) throw new Error("no child ${s.child}");` : ""}
// exportAbsoluteBounds: include children that overflow the node's own box
// (an anchored badge indicator sits partly above/right of its host). Off by
// default so every other subject keeps the node-box export it was scored on.
const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 }${s.exportAbsoluteBounds ? ", useAbsoluteBounds: true" : ""} });
return { id: node.id, w: Math.round(node.width), h: Math.round(node.height), bytes: Array.from(bytes) };
`;
  const res = await call("figma_execute", { code, fileKey: TARGET.fileKey, timeout: 60_000 });
  if (!res?.success || !res?.result?.bytes) {
    console.error(`✖ ${s.label}: ${String(res?.error ?? "export failed").slice(0, 160)}`);
    failures += 1;
    continue;
  }
  const out = path.join(REPO, s.shot);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(res.result.bytes));
  console.log(`✔ ${s.label.padEnd(20)} ${res.result.w}x${res.result.h}  → ${s.shot}`);
}
await client.close();
if (failures > 0) process.exit(1);
console.log(`\ncaptured ${subjects.length - failures} shot(s); zero Figma writes`);
