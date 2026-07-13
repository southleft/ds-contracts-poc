// Assemble the v1.6 full-kit dump from banked capture chunks (PHASE 1).
//
// Merges v16-chunk-*.json ({sets, degradations, variables, missing}) into the
// canonical dump.plugin.js output shape:
//   { _provenance, _degradations, _variables, <setName>: {…} }
// and writes an integrity sidecar naming every honesty fact the merge saw:
// name collisions (dumps are name-keyed by canonical convention — a duplicate
// name means last-writer-wins, same as the canonical single-pass script),
// per-chunk missing ids, and the roster-vs-assembled delta.
//
// Usage: node assemble-dump.mjs <captureDir> <outDump> <outIntegrity> [fileVersion]
import fs from 'node:fs';
import path from 'node:path';

const [, , dir, outDump, outIntegrity, fileVersion] = process.argv;
const roster = JSON.parse(fs.readFileSync(path.join(dir, 'roster.json'), 'utf8'));

const chunkFiles = fs.readdirSync(dir).filter((f) => /^v16-chunk-\d+\.json$/.test(f)).sort();
const dump = {};
const degradations = [];
const variables = {};
const collisions = [];
const missing = [];
let setCount = 0;
const seenNames = new Map(); // name -> chunk file

for (const f of chunkFiles) {
  const chunk = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [name, rec] of Object.entries(chunk.sets)) {
    if (seenNames.has(name)) collisions.push({ name, first: seenNames.get(name), second: f });
    seenNames.set(name, f);
    dump[name] = rec;
    setCount++;
  }
  degradations.push(...chunk.degradations);
  for (const [vname, vrec] of Object.entries(chunk.variables)) {
    if (!(vname in variables)) variables[vname] = vrec; // first-wins, the committed convention
  }
  missing.push(...chunk.missing.map((id) => ({ chunk: f, id })));
}

// Intra-chunk collisions: chunk.sets is already name-keyed, so a duplicate
// name WITHIN a chunk is invisible above — recover it from the roster.
const rosterNames = new Map();
for (const r of roster.roster) rosterNames.set(r.name, (rosterNames.get(r.name) ?? 0) + 1);
const dupNames = [...rosterNames.entries()].filter(([, n]) => n > 1).map(([name, n]) => ({ name, rosterCount: n }));

const assembled = {
  _provenance: {
    fileKey: roster.fileKey,
    extractedAt: new Date().toISOString().slice(0, 10),
    note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.6) for design→contract proposal. Full-kit capture streamed per-chunk through the desktop bridge (gauntlet/live/capture-receiver.mjs) with the verbatim dump.plugin.js engine.',
    dumpVersion: '1.6',
    ...(fileVersion ? { fileVersion } : {}),
  },
  _degradations: degradations,
  _variables: variables,
};
for (const [name, rec] of Object.entries(dump)) assembled[name] = rec;

fs.writeFileSync(outDump, JSON.stringify(assembled, null, 1));

const integrity = {
  rosterEntries: roster.roster.length,
  assembledSets: Object.keys(dump).length,
  duplicateNamesInRoster: dupNames,
  crossChunkCollisions: collisions,
  missingIds: missing,
  degradations: degradations.length,
  capturedVariables: Object.keys(variables).length,
  componentSets: Object.values(dump).filter((r) => r.type === 'COMPONENT_SET').length,
  singles: Object.values(dump).filter((r) => r.type === 'COMPONENT').length,
};
fs.writeFileSync(outIntegrity, JSON.stringify(integrity, null, 2));
console.log(JSON.stringify(integrity, (k, v) => (k === 'missingIds' || k === 'duplicateNamesInRoster' || k === 'crossChunkCollisions' ? (Array.isArray(v) ? v.length : v) : v), 2));
console.log(`dump written: ${outDump}`);
