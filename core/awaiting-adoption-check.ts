/**
 * Wave 3 — awaiting-code-adoption silent-revert guard (docs/18 G4).
 * Pins extract/static-promotion + markAwaitingCodeAdoption together.
 *   npx tsx core/awaiting-adoption-check.ts
 */
import assert from "node:assert/strict";
import {
  canonicalRevisionOf,
  markAwaitingCodeAdoption,
  revisionOf,
  type ProvenancedContract,
} from "./contract-provenance.js";
import { promoteStaticArtifact } from "../extract/static-promotion.js";

function bare(id: string, padding: string): ProvenancedContract {
  return {
    id,
    name: "Button",
    version: "0.1.0",
    anatomy: { root: { tokens: { paddingTop: padding } } },
  };
}

const codeRev1 = revisionOf({ anatomy: { root: { tokens: { paddingTop: "6" } } } });
const designBare = bare("mui.button", "8");
const codeBase: ProvenancedContract = {
  ...bare("mui.button", "6"),
  provenance: {
    version: 1,
    canonicalRevision: canonicalRevisionOf(bare("mui.button", "6")),
    source: { kind: "code", adapter: "react-tsx", revision: codeRev1 },
  },
};

const awaiting = markAwaitingCodeAdoption(codeBase, designBare);
assert.ok(awaiting.provenance?.awaitingCodeAdoption);
assert.equal(
  awaiting.provenance!.awaitingCodeAdoption!.sourceRevision,
  codeRev1,
);

// Unchanged source extraction that would revert design → REFUSED
{
  let refused = false;
  try {
    promoteStaticArtifact(
      awaiting,
      bare("mui.button", "6"),
      { adapter: "react-tsx", revision: codeRev1 },
    );
  } catch (e) {
    refused = /stale-source REFUSED/.test(String(e));
  }
  assert.ok(refused, "unchanged code extract must refuse silent revert");
}

// Same unchanged extract that matches awaiting canonical returns prior
{
  const kept = promoteStaticArtifact(
    awaiting,
    structuredClone(awaiting),
    { adapter: "react-tsx", revision: codeRev1 },
  );
  assert.equal(
    kept.provenance?.awaitingCodeAdoption?.designRevision,
    awaiting.provenance!.awaitingCodeAdoption!.designRevision,
  );
}

// Source actually changed → adoption clears
{
  const codeRev2 = revisionOf({
    anatomy: { root: { tokens: { paddingTop: "8" } } },
  });
  const adopted = promoteStaticArtifact(
    awaiting,
    bare("mui.button", "8"),
    { adapter: "react-tsx", revision: codeRev2 },
  );
  assert.equal(adopted.provenance?.awaitingCodeAdoption, undefined);
  assert.equal(adopted.provenance?.source.revision, codeRev2);
}

console.log(
  "✔ awaiting-adoption-check: silent-revert refused; source change adopts",
);
