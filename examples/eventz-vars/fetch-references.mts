/**
 * references/*.png — per-variant canvas ground truth for the Eventz kit,
 * fetched from Figma's own REST images renderer (the visual-truth Track-1
 * approach: extract/figma/visual-truth/rest.mjs — batched ids, fixed
 * inter-call politeness delay, 429 backoff, version-keyed PNG cache under the
 * gitignored extract/figma/visual-parity/out/).
 *
 * The dump (dumps/MERGED.json, v1.11) records each SET's nodeId but not the
 * variant nodes' own ids, so the per-variant ids are recovered live: one
 * depth-1 /nodes call over the 7 set ids enumerates each set's child
 * COMPONENT nodes, and the child NAME ("variant=primary, state=default, …")
 * is matched byte-for-byte against the dump's own variant names. A variant
 * the live file no longer holds under that exact name is a named SKIP, never
 * a silent substitution.
 *
 * SCALE 1, deliberately: like-for-like with the bridge lane's cell-capture
 * discipline (see rest.mjs — scale 2 + downscale was measured to inject
 * resampling noise the canvas never had). The fidelity kernel therefore
 * scores these references at scale s=1, not the untitled-ui shooter's
 * min(2, 600/w) rule — those references were hand-exported at up to 2x.
 *
 *   source .env && npx tsx examples/eventz-vars/fetch-references.mts
 *
 * Requires FIGMA_TOKEN (env / .env / .env.local) with read access to
 * E7oXr98i91HYQGZxA2USOQ; on 403/404 it reports and exits 1 — it never
 * substitutes another source of truth.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-ignore — untyped committed helper, the same import scripts/visual-truth-run.mjs uses
import { figmaToken, fetchNodes, fetchImages } from '../../extract/figma/visual-truth/rest.mjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(ROOT, 'extract', 'figma', 'visual-parity', 'out', 'eventz-vars-refs');
const REFS = path.join(HERE, 'references');

const dump = JSON.parse(readFileSync(path.join(HERE, 'dumps', 'MERGED.json'), 'utf8')) as Record<string, any>;
const fileKey: string | undefined = dump._provenance?.fileKey;
if (!fileKey) {
  console.error('FATAL: dumps/MERGED.json carries no _provenance.fileKey — cannot address the source file');
  process.exit(1);
}

const kebabSet = (s: string): string => s.replace(/^_/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const varSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const sets = Object.keys(dump).filter((k) => !k.startsWith('_'));
const token = figmaToken(ROOT);

const nodesRes = await fetchNodes(CACHE, token, fileKey, sets.map((s) => dump[s].nodeId), { depth: 1 });
if (!nodesRes.ok) {
  console.error(
    `FATAL: /v1/files/${fileKey}/nodes answered ${nodesRes.status} — the token cannot read the Eventz file. ` +
      'No reference is substituted; fix access and re-run.',
  );
  process.exit(1);
}

interface Want {
  setName: string;
  variantName: string;
  nodeId: string;
  file: string;
}
const wanted: Want[] = [];
const skips: string[] = [];
for (const setName of sets) {
  const doc = nodesRes.nodes.get(String(dump[setName].nodeId));
  if (!doc) {
    skips.push(`SET ${setName} (${dump[setName].nodeId}) — REST no longer knows the id`);
    continue;
  }
  const byName = new Map<string, string>((doc.children ?? []).map((c: any) => [String(c.name), String(c.id)]));
  for (const v of dump[setName].variants as Array<{ name: string }>) {
    const id = byName.get(v.name);
    if (!id) {
      skips.push(`${setName} :: ${v.name} — no live child with that exact name`);
      continue;
    }
    wanted.push({ setName, variantName: v.name, nodeId: id, file: `var--${kebabSet(setName)}--${varSlug(v.name)}.png` });
  }
}

const imgRes = await fetchImages(CACHE, token, fileKey, nodesRes.version, wanted.map((w) => w.nodeId), { scale: 1 });
if (!imgRes.ok) {
  console.error(`FATAL: /v1/images/${fileKey} answered ${imgRes.status} — no reference fetched.`);
  process.exit(1);
}

mkdirSync(REFS, { recursive: true });
let copied = 0;
for (const w of wanted) {
  const src = imgRes.paths.get(w.nodeId);
  if (!src) {
    skips.push(`${w.setName} :: ${w.variantName} — images API declined to render ${w.nodeId}`);
    continue;
  }
  copyFileSync(src, path.join(REFS, w.file));
  copied++;
}

console.log(`file ${fileKey} @ version ${nodesRes.version}`);
console.log(`✔ ${copied}/${wanted.length + skips.length} variant references → examples/eventz-vars/references/ (scale 1)`);
for (const s of skips) console.log(`  SKIP ${s}`);
if (skips.length > 0) process.exit(2);
