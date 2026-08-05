import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertContractProvenance,
  canonicalJson,
  canonicalRevisionOf,
  markAwaitingCodeAdoption,
  revisionOf,
  type ProvenancedContract,
} from "./contract-provenance.js";
import {
  extractionRevision,
  promoteStaticCandidate,
} from "../extract/static-promotion.js";
import type { ExtractedComponent } from "../extract/types.js";

const extracted = (tone: string): ExtractedComponent => ({
  name: "Button",
  source: `/tmp/${tone}/Button.tsx`, // path is deliberately not revision input
  adapter: "react-tsx",
  props: [
    {
      name: "tone",
      kind: "enum",
      values: [tone],
      optional: false,
      confidence: "declared",
    },
  ],
});
const contract = (tone: string): ProvenancedContract => ({
  id: "ds.button",
  name: "Button",
  tone,
});

// Deterministic canonicalization/hash, including a real SHA-256 oracle.
assert.equal(
  canonicalJson({ z: 1, a: { y: 2, x: 3 } }),
  '{"a":{"x":3,"y":2},"z":1}',
);
assert.equal(revisionOf({ b: 2, a: 1 }), revisionOf({ a: 1, b: 2 }));
assert.equal(
  revisionOf("abc"),
  `sha256:${createHash("sha256").update(JSON.stringify("abc")).digest("hex")}`,
);
assert.equal(
  extractionRevision(extracted("old")),
  extractionRevision({ ...extracted("old"), source: "/elsewhere/Button.tsx" }),
);

// C0/S0 bootstrap → design C1 awaiting S0.
const s0 = extracted("old");
const c0 = promoteStaticCandidate(null, contract("old"), s0);
const c1 = markAwaitingCodeAdoption(c0, contract("new"));
assert.equal(
  c1.provenance?.awaitingCodeAdoption?.sourceRevision,
  c0.provenance?.source.revision,
);
assert.equal(c1.provenance?.canonicalRevision, canonicalRevisionOf(c1));

// Unchanged C0/S0 hard-refuses before the caller's write phase.
let writes = 0;
assert.throws(() => {
  promoteStaticCandidate(c1, contract("old"), s0);
  writes++;
}, /stale-source REFUSED.*silently revert/);
assert.equal(writes, 0);

// Changed contract-relevant S1 may be reviewed/promoted and clears awaiting.
const s1 = extracted("new");
const adopted = promoteStaticCandidate(c1, contract("new"), s1);
assert.equal(adopted.provenance?.source.revision, extractionRevision(s1));
assert.equal(adopted.provenance?.awaitingCodeAdoption, undefined);

// Malformed and content-mismatched provenance refuse by field name.
assert.throws(
  () =>
    assertContractProvenance({
      ...contract("x"),
      provenance: { version: 1 },
    } as never),
  /provenance\.canonicalRevision/,
);
const mismatched = structuredClone(c0);
mismatched.tone = "tampered";
assert.throws(
  () => assertContractProvenance(mismatched),
  /provenance\.canonicalRevision does not match/,
);
const sourceRevisionBypass = structuredClone(c1);
sourceRevisionBypass.provenance!.awaitingCodeAdoption!.sourceRevision =
  revisionOf("different source");
assert.throws(
  () => assertContractProvenance(sourceRevisionBypass),
  /provenance\.awaitingCodeAdoption\.sourceRevision must equal source\.revision/,
);
const designSourceBypass = structuredClone(c1);
designSourceBypass.provenance!.source.kind = "design";
assert.throws(
  () => assertContractProvenance(designSourceBypass),
  /provenance\.source\.kind must equal "code" while awaitingCodeAdoption is present/,
);
const malformedAwaiting = structuredClone(c1) as Record<string, unknown>;
(malformedAwaiting.provenance as Record<string, unknown>).awaitingCodeAdoption =
  null;
assert.throws(
  () => assertContractProvenance(malformedAwaiting as ProvenancedContract),
  /provenance\.awaitingCodeAdoption must be an object/,
);

// Old artifacts: equal extraction bootstraps silently; a mismatch needs the
// explicit acknowledgement and then receives provenance.
const old = contract("old");
assert.doesNotThrow(() => promoteStaticCandidate(old, contract("old"), s0));
assert.throws(
  () => promoteStaticCandidate(old, contract("new"), s1),
  /existing canonical has no provenance.*explicit acknowledgement/,
);
const acknowledged = promoteStaticCandidate(old, contract("new"), s1, {
  acknowledgeUnprovenancedMismatch: true,
});
assert.ok(acknowledged.provenance);

console.log(
  "✔ contract provenance: deterministic revisions, stale-source refusal, adoption clearing, source-binding bypass refusals, malformed/mismatch and old-artifact behavior",
);
