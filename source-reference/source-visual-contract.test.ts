import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { revisionOf } from "../core/contract-provenance.js";
import { emitReact } from "../core/emit-react.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import { flattenTokens } from "../core/tokens.js";
import {
  ContractSchema,
  walkAnatomy,
  resolveTokens,
} from "../scripts/contract-schema.js";
import {
  buildSourceVisualContractCandidate,
  type SourceVisualContractInput,
} from "./source-visual-contract.js";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function fixture(): SourceVisualContractInput {
  // Byte-preserved current source/preparation evidence, no captures/builds.
  // The runtime remains unaccepted; this tests pure candidate construction.
  const pack = read("./fixtures/source-visual-button-recorded.json");
  const bytes = gunzipSync(Buffer.from(pack.payload, "base64"));
  assert.equal(bytes.length, pack.payloadBytes);
  assert.equal(sha(bytes), pack.payloadSha256);
  return JSON.parse(bytes.toString());
}

test("existing fusion produces styled canonical candidate without promoting sample anatomy", () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const out = buildSourceVisualContractCandidate(input);
  assert.equal(out.status, "measured-candidate", JSON.stringify(out.problems));
  assert.equal(out.acceptedContract, null);
  assert.equal(out.qualification, "observed-values-only");
  assert.equal(
    JSON.stringify(input),
    before,
    "pure stage must not rewrite original evidence",
  );
  assert.deepEqual(
    buildSourceVisualContractCandidate(input),
    out,
    "byte-shape deterministic",
  );
  const contract = ContractSchema.parse(out.contract);
  assert.deepEqual(contract.props, input.semantics.projectedProps);
  assert.deepEqual(contract.states, []);
  assert.equal(out.contractRevision, revisionOf(contract));
  assert.equal(out.tokenRevision, revisionOf(out.tokens));
  assert.equal(out.unqualifiedRuntimeBinding!.version, 0);
  assert.equal(
    contract.bindings.code.runtime!.bindingRevision,
    revisionOf(out.unqualifiedRuntimeBinding),
  );
  assert.equal(
    out.seed!.contract!.bindings.code.runtime!.bindingRevision,
    revisionOf(out.seed!.unqualifiedRuntimeBinding),
    "seed remains internally self-consistent",
  );
  const parts = walkAnatomy(contract);
  assert.equal(parts.length, 7);
  assert.deepEqual(
    parts.filter((p) => p.part.slot).map((p) => p.part.slot),
    [{ name: "before" }, { name: "children" }, { name: "after" }],
  );
  for (const { part } of parts) {
    assert.equal(part.text, undefined);
    assert.equal(part.content, undefined);
    assert.equal(part.visibleWhen, undefined);
    assert.equal(part.optional, undefined);
    assert.ok(
      !part.tokens?.width &&
        !part.tokens?.height &&
        !part.literals?.width &&
        !part.literals?.height,
    );
  }
  assert.ok(
    Object.keys(resolveTokens(contract.anatomy.root, {})).length > 0,
    "real measured root styling survives",
  );
  assert.ok(out.fusion!.enrichmentNotes.length > 0);
  assert.ok(
    out.channels.some(
      (c) => c.channel === "background-color" && c.status === "candidate",
    ),
  );
  assert.ok(
    out.channels.some(
      (c) =>
        c.channel === "width" &&
        c.reason === "sample-dependent-geometry-unqualified",
    ),
  );
  assert.ok(
    out.problems.includes(
      "source-visual-authored-versus-ua-controls-unmeasured",
    ),
  );
  assert.ok(
    out.problems.includes("source-visual-token-identities-unqualified"),
  );
  assert.ok(
    out.problems.includes("source-visual-native-projection-unqualified"),
  );
  assert.ok(
    out.stylePlanes.every((p) => p.caseId),
    "every declared appearance is observed",
  );
  assert.equal(out.cases.length, input.semantics.cases.length);
  assert.ok(
    out.cases.some((c) => c.status === "refused"),
    "disabled refusal remains in denominator",
  );
});

test("canonical styling never bypasses retained runtime refusal", () => {
  const out = buildSourceVisualContractCandidate(fixture());
  assert.equal(out.status, "measured-candidate", JSON.stringify(out.problems));
  const contract = out.contract!;
  assert.throws(
    () =>
      emitReact(contract, {
        tokens: new Set(flattenTokens(out.tokens!).keys()),
        icons: new Map(),
        contracts: new Map([[contract.id, contract]]),
      }),
    /TRUSTED-CONTEXT-MISSING/,
  );
  assert.throws(
    () =>
      createFigmaEngine({
        tokens: {
          primitives: out.tokens!,
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        },
        icons: new Map(),
      }).compileComponentData(contract, new Map()),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
});

test("all five measured paint planes resolve to the pinned original dark appearance", () => {
  const out = buildSourceVisualContractCandidate(fixture());
  assert.equal(out.status, "measured-candidate");
  const contract = out.contract!,
    inventory = flattenTokens(out.tokens!);
  // Independent literal answer key from the pinned original, not values
  // recomputed through the fusion/mint implementation under test.
  const expected = [
    {
      value: undefined,
      background: "#4375ff",
      color: "#000b29",
      border: "0px",
    },
    {
      value: "secondary",
      background: "#a49981",
      color: "#191306",
      border: "0px",
    },
    {
      value: "tertiary",
      background: "#00000000",
      color: "#f8f8f6",
      border: "1px",
    },
    { value: "bare", background: "#00000000", color: "#f8f8f6", border: "0px" },
    { value: "danger", background: "#f05735", color: "#1f0600", border: "0px" },
  ];
  for (const plane of expected) {
    const props: Record<string, string> = plane.value
      ? { variant: plane.value }
      : {};
    for (const { part } of walkAnatomy(contract)) {
      for (const ref of Object.values(resolveTokens(part, props))) {
        assert.match(ref, /^\{imported\.[^{}]+\}$/);
        assert.ok(inventory.has(ref.slice(1, -1)), `unresolved ${ref}`);
      }
    }
    const tokens = resolveTokens(contract.anatomy.root, props);
    const value = (channel: string) =>
      inventory.get(tokens[channel].slice(1, -1))!.value;
    assert.equal(value("background-color"), plane.background);
    assert.equal(value("color"), plane.color);
    assert.equal(value("border-top-width"), plane.border);
    assert.equal(value("font-size"), "16px");
    assert.equal(value("font-weight"), "600");
    assert.equal(value("line-height"), "24px");
    assert.equal(value("padding-top"), "8px");
    assert.equal(value("padding-right"), "16px");
    assert.equal(value("border-top-left-radius"), "4px");
  }
  assert.equal(
    contract.anatomy.root.declared!["font-family"],
    '"IBM Plex Sans", sans-serif',
  );
  assert.equal(contract.props[0].bindings.figma.unsetValue, "(unset)");
  assert.deepEqual(contract.props[0].type, {
    enum: ["secondary", "tertiary", "bare", "danger"],
  });
});

test("case and original tree tampering cannot produce a partial accepted contract", async (t) => {
  for (const mutation of [
    "duplicate",
    "foreign",
    "tree",
    "source",
    "missing-base",
  ])
    await t.test(mutation, () => {
      const input = fixture();
      if (mutation === "duplicate")
        input.cases.push(structuredClone(input.cases[0]));
      if (mutation === "foreign")
        input.cases[0].expectedCaseId = "foreign-case";
      if (mutation === "tree")
        input.cases[0].tree.root.style.color = "rgb(255, 0, 0)";
      if (mutation === "source") input.source.source += "changed";
      if (mutation === "missing-base") input.cases = [];
      const result = buildSourceVisualContractCandidate(input);
      assert.equal(result.status, "refused", JSON.stringify(result.problems));
      assert.equal(result.acceptedContract, null);
      assert.equal(result.contract, undefined);
      assert.equal(result.tokens, undefined);
    });
});

test("altered stylesheet candidate references cannot bypass original tree identity", () => {
  const input = fixture();
  // A stale vref does not become a token binding through style-value fusion.
  // Keep the original hash unchanged: it must also reject visual mutation.
  input.cases[0].tree.root.vrefs = {
    color: [["--al-made-up", "#000b29", ".anything"]],
  };
  const out = buildSourceVisualContractCandidate(input);
  assert.equal(out.status, "refused");
  assert.equal(out.contract, undefined);
});

test("missing appearance cannot extrapolate even a uniform style to an unobserved variant", () => {
  const input = fixture();
  const danger = input.semantics.cases.find(
    (c) => c.variant?.kind === "value" && c.variant.value === "danger",
  )!;
  input.cases = input.cases.filter((c) => c.expectedCaseId !== danger.id);
  const out = buildSourceVisualContractCandidate(input);
  assert.equal(out.status, "refused");
  assert.equal(out.contract, undefined);
  assert.equal(out.tokens, undefined);
  assert.ok(
    out.problems.includes(
      "source-visual-contract-appearance-coverage-incomplete",
    ),
  );
  assert.equal(out.cases.length, input.semantics.cases.length);
});

test("malformed input returns a named refusal", () => {
  for (const input of [{}, null, undefined]) {
    const out = buildSourceVisualContractCandidate(input as any);
    assert.equal(out.status, "refused");
    assert.equal(out.contract, undefined);
  }
});
