/**
 * Stage 3a emit script — derive the Button canvas-facts document from the
 * COMMITTED observe substrate and write it under
 * recipe/evidence/canvas-to-code-v1/. Entirely offline: zero Figma reads or
 * writes; the substrate is the same committed observe the perturbation exam
 * uses (recipe/evidence/button-scene-inversion-v2/observe-altitude.json.gz).
 *
 *   tsx recipe/emit-canvas-facts.ts --write   derive + write the artifact
 *   tsx recipe/emit-canvas-facts.ts --check   derive + compare against the
 *                                             committed artifact (fail closed)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  deriveCanvasFacts,
  sha256OfBytes,
  type CanvasFactsDocument,
} from "./canvas-facts.js";
import { canonicalJson } from "./normalize.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

export const CANVAS_TO_CODE_ROOT = "recipe/evidence/canvas-to-code-v1";
export const BUTTON_OBSERVE_PATH =
  "recipe/evidence/button-scene-inversion-v2/observe-altitude.json.gz";
export const BUTTON_CANVAS_FACTS_PATH = `${CANVAS_TO_CODE_ROOT}/canvas-facts-button.json.gz`;

export function deriveButtonCanvasFacts(): CanvasFactsDocument {
  const bytes = readFileSync(BUTTON_OBSERVE_PATH);
  const raw = JSON.parse(
    gunzipSync(bytes).toString("utf8"),
  ) as SceneNodeSnapshot;
  return deriveCanvasFacts(raw, {
    observePath: BUTTON_OBSERVE_PATH,
    observeSha256: sha256OfBytes(bytes),
  });
}

export function writeButtonCanvasFacts(): CanvasFactsDocument {
  const doc = deriveButtonCanvasFacts();
  mkdirSync(CANVAS_TO_CODE_ROOT, { recursive: true });
  writeFileSync(
    BUTTON_CANVAS_FACTS_PATH,
    gzipSync(Buffer.from(`${canonicalJson(doc)}\n`, "utf8"), { level: 9 }),
  );
  return doc;
}

export function checkButtonCanvasFacts(): CanvasFactsDocument {
  const derived = deriveButtonCanvasFacts();
  const committed = gunzipSync(
    readFileSync(BUTTON_CANVAS_FACTS_PATH),
  ).toString("utf8");
  if (committed !== `${canonicalJson(derived)}\n`) {
    throw new Error(
      `canvas-facts: committed ${BUTTON_CANVAS_FACTS_PATH} does not match the derivation from ${BUTTON_OBSERVE_PATH} — re-run \`tsx recipe/emit-canvas-facts.ts --write\` and review the diff`,
    );
  }
  return derived;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = process.argv.includes("--write")
    ? writeButtonCanvasFacts()
    : checkButtonCanvasFacts();
  process.stdout.write(
    `${canonicalJson({
      version: doc.version,
      source: doc.source,
      nodes: doc.counts.nodes,
      facts: doc.counts.facts,
      tokenIdentities: doc.tokenIdentities.length,
      normalizations: doc.normalizations.length,
      mode: process.argv.includes("--write") ? "written" : "checked",
    })}\n`,
  );
}
