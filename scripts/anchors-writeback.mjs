/**
 * Anchors write-back — closes the loop the contract schema promises.
 *
 * contracts/*.contract.json each carry anchors.figma { fileKey,
 * componentSetKey, nodeId } that the schema documents as "written back after
 * first generation". This script actually does that: it reads the Sync
 * Runner's POSTed outcome (figma-sync/.runner-result.json, written by
 * scripts/figma-serve.mjs) and updates each contract's anchors.figma from the
 * per-component results the batch scripts return ({ name, nodeId, key }).
 *
 *   npm run anchors:writeback
 *
 * Matching is by component name (contract.name === result.name). Contracts
 * are only rewritten when an anchor value actually changed, and the write is
 * a targeted textual replacement of the three anchor values — the rest of
 * the file's formatting (2-space indent, one-line objects, trailing newline)
 * is untouched. Safe because "fileKey"/"componentSetKey"/"nodeId" each occur
 * exactly once per contract, inside anchors.figma (verified before writing).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RESULT_PATH = path.join(ROOT, 'figma-sync', '.runner-result.json');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');

if (!existsSync(RESULT_PATH)) {
  console.error(
    `✖ No runner result at ${path.relative(ROOT, RESULT_PATH)} — run the Sync Runner plugin against npm run figma:serve first.`,
  );
  process.exit(1);
}

const raw = JSON.parse(readFileSync(RESULT_PATH, 'utf8'));

// The server sink receives both mid-run progress payloads ({ phase, script,
// soFar }) and the final payload ({ fileKey, when, results }). Accept either.
const scriptResults = Array.isArray(raw.results)
  ? raw.results
  : Array.isArray(raw.soFar)
    ? raw.soFar
    : [];
const fileKey = typeof raw.fileKey === 'string' && raw.fileKey ? raw.fileKey : null;
if (!fileKey) {
  console.warn(
    '⚠ Runner result carries no fileKey (progress payload, or the file is unsaved) — existing fileKey anchors are kept as-is.',
  );
}

// Collect { name → { nodeId, key } } from every batch/script entry. Batch
// scripts return { createdNodeIds, results: [{ name, nodeId, key, … }] };
// tolerate entries that returned something else (e.g. the tokens script).
const byName = new Map();
for (const entry of scriptResults) {
  if (!entry || entry.ok === false) continue;
  const inner = entry.result && Array.isArray(entry.result.results) ? entry.result.results : [];
  for (const comp of inner) {
    if (comp && typeof comp.name === 'string' && typeof comp.key === 'string') {
      byName.set(comp.name, { nodeId: typeof comp.nodeId === 'string' ? comp.nodeId : null, key: comp.key });
    }
  }
}

if (byName.size === 0) {
  console.error('✖ Runner result contains no per-component { name, nodeId, key } entries — nothing to write back.');
  process.exit(1);
}

const contractFiles = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.contract.json'));
const matchedNames = new Set();
let updated = 0;
let unchanged = 0;

/** Replace the sole `"key": <string|null>` occurrence in the raw contract
 *  text, in place — everything else (indent, one-line objects) is preserved. */
function replaceAnchorValue(raw, file, key, value) {
  const pattern = new RegExp(`("${key}"\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*"|null)`, 'g');
  const matches = raw.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${file}: expected exactly one "${key}" occurrence, found ${matches ? matches.length : 0} — refusing to edit`);
  }
  return raw.replace(pattern, `$1${JSON.stringify(value)}`);
}

for (const file of contractFiles) {
  const filePath = path.join(CONTRACTS_DIR, file);
  const raw = readFileSync(filePath, 'utf8');
  const contract = JSON.parse(raw);
  const hit = byName.get(contract.name);
  if (!hit) continue;
  matchedNames.add(contract.name);

  const anchor = contract.anchors?.figma;
  if (!anchor) {
    console.warn(`⚠ ${file}: no anchors.figma object — skipped.`);
    continue;
  }
  const next = {
    fileKey: fileKey ?? anchor.fileKey ?? null,
    componentSetKey: hit.key,
    nodeId: hit.nodeId ?? anchor.nodeId ?? null,
  };
  const changed =
    anchor.fileKey !== next.fileKey ||
    anchor.componentSetKey !== next.componentSetKey ||
    anchor.nodeId !== next.nodeId;

  if (!changed) {
    unchanged++;
    continue;
  }
  let out = raw;
  try {
    for (const key of /** @type {const} */ (['fileKey', 'componentSetKey', 'nodeId'])) {
      out = replaceAnchorValue(out, file, key, next[key]);
    }
  } catch (e) {
    console.warn(`⚠ ${String(e && e.message ? e.message : e)} — skipped.`);
    continue;
  }
  // Sanity: the edited text must still parse and carry exactly the new anchor.
  const check = JSON.parse(out).anchors.figma;
  if (check.fileKey !== next.fileKey || check.componentSetKey !== next.componentSetKey || check.nodeId !== next.nodeId) {
    console.warn(`⚠ ${file}: post-edit verification failed — skipped.`);
    continue;
  }
  writeFileSync(filePath, out.endsWith('\n') ? out : out + '\n');
  updated++;
  console.log(`  ✎ ${file}: anchors.figma → { fileKey: ${next.fileKey}, componentSetKey: ${next.componentSetKey}, nodeId: ${next.nodeId} }`);
}

const unmatched = [...byName.keys()].filter((n) => !matchedNames.has(n));
console.log(
  `✔ Anchors write-back: ${updated} updated, ${unchanged} unchanged, ${unmatched.length} unmatched runner result(s)${
    unmatched.length > 0 ? ` (${unmatched.join(', ')})` : ''
  }.`,
);
