// Build the chunked capture ENGINE from the canonical extract/figma/dump.plugin.js.
//
// The engine is the VERBATIM dump.plugin.js body (dumpShape / varNameById /
// dumpPaint / dumpNode / dumpPropertyDefinitions — byte-identical, mechanically
// extracted) wrapped as an async (figma, TARGET_IDS) => {…} expression whose
// driver selects top-level sets/components BY NODE ID instead of by the
// TARGET_SETS name list (the census-agent chunking convention: ids are
// duplicate-name-safe). Output shape per chunk:
//   { sets: { <setName>: {...canonical set record} }, degradations, variables, missing }
//
// Usage: node build-engine.mjs <repoRoot> <outFile>
import fs from 'node:fs';
import path from 'node:path';

const [, , repoRoot, outFile] = process.argv;
const src = fs.readFileSync(path.join(repoRoot, 'extract/figma/dump.plugin.js'), 'utf8');

// The engine body: everything between the TARGET_SETS const (exclusive) and
// the driver (`const dumps = {` … end) — the capture functions, verbatim.
const startMarker = "const TARGET_SETS = ['Badge', 'Switch', 'Card'];";
const endMarker = 'const dumps = {';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) {
  console.error('dump.plugin.js markers not found — engine build refuses (script shape changed?)');
  process.exit(1);
}
const body = src.slice(startIdx + startMarker.length, endIdx);

const engine = `(async (figma, TARGET_IDS) => {
${body}
// --- chunk driver (id-selected; per-set record shape identical to the canonical driver) ---
const byId = new Set(TARGET_IDS);
const found = new Set();
const sets = {};
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (!byId.has(node.id)) continue;
    found.add(node.id);
    const variants = [];
    if (node.type === 'COMPONENT_SET') {
      for (const variant of node.children) variants.push(await dumpNode(variant, node.name + ':' + variant.name));
    } else {
      variants.push(await dumpNode(node, node.name + ':' + node.name));
    }
    const defs = dumpPropertyDefinitions(node);
    sets[node.name] = {
      setName: node.name,
      type: node.type,
      nodeId: node.id,
      key: node.key,
      variants,
    };
    if (Object.keys(defs.swapPreferredValues).length > 0) sets[node.name].swapPreferredValues = defs.swapPreferredValues;
    if (Object.keys(defs.boolDefaults).length > 0) sets[node.name].boolDefaults = defs.boolDefaults;
  }
}
const missing = TARGET_IDS.filter((id) => !found.has(id));
return { sets, degradations, variables: capturedVariables, missing };
})`;

fs.writeFileSync(outFile, engine);
console.log(`engine built: ${outFile} (${engine.length} bytes; body verbatim from dump.plugin.js v1.6)`);
