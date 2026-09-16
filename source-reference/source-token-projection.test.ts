import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { revisionOf } from "../core/contract-provenance.js";
import { emitReact } from "../core/emit-react.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import {
  resolveRuntimeEmission,
  runtimeProjectionRevision,
} from "../core/runtime-emission.js";
import { flattenTokens, makeResolveLiteral } from "../core/tokens.js";
import { validateContract } from "../packages/core/src/validate.js";
import {
  ContractSchema,
  resolveTokens,
  tokensByPropEntries,
  walkAnatomy,
} from "../scripts/contract-schema.js";
import { semanticHash } from "./semantics.js";
import {
  resolveSourceTokenBindings,
  type SourceTokenBindingsInput,
} from "./source-token-bindings.js";
import { buildSourceVisualContractCandidate } from "./source-visual-contract.js";
import {
  buildSourceTokenProjection,
  type SourceTokenProjection,
} from "./source-token-projection.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function fixture(): SourceTokenBindingsInput {
  const pack = JSON.parse(
    readFileSync(
      new URL("./fixtures/source-visual-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const bytes = gunzipSync(Buffer.from(pack.payload, "base64"));
  assert.equal(sha(bytes), pack.payloadSha256);
  const json = readFileSync(
    new URL(
      "../examples/altitude/tokens/modes/altitude.dark.dtcg.json",
      import.meta.url,
    ),
    "utf8",
  );
  return {
    source: JSON.parse(bytes.toString()),
    tokens: { mode: "dark", brand: "default", json, sha256: sha(json) },
  };
}
function raw(input: SourceTokenBindingsInput, suffix = "--default") {
  const row = input.source.cases.find((c) => c.expectedCaseId.endsWith(suffix));
  assert.ok(row);
  return row;
}
/** Synthetic counterexamples rebind only recorded tree hashes. They are not
 * new authenticated source evidence or additions to the qualified cohort. */
function rebind(input: SourceTokenBindingsInput, suffix = "--default") {
  const row = raw(input, suffix);
  row.tree.sha256 = sha(JSON.stringify(row.tree.root));
  row.semantics.sourceTreeSha256 = row.tree.sha256;
  row.boundTopology.sourceTreeSha256 = row.tree.sha256;
  row.boundTopology.topology!.sourceTreeSha256 = row.tree.sha256;
  input.source.semantics.cases.find(
    (c) => c.id === row.expectedCaseId,
  )!.sourceTreeSha256 = row.tree.sha256;
}
function tokenChange(
  input: SourceTokenBindingsInput,
  change: (tree: Record<string, any>) => void,
) {
  const tree = JSON.parse(input.tokens.json);
  change(tree);
  input.tokens.json = JSON.stringify(tree);
  input.tokens.sha256 = sha(input.tokens.json);
}
function sourceRef(
  input: SourceTokenBindingsInput,
  suffix: string,
  channel: string,
  token: string,
) {
  const tree = JSON.parse(input.tokens.json),
    value = tree[token].$value;
  raw(input, suffix).tree.root.vrefs![channel] = [
    [`--al-${token}`, value, ".synthetic-source-rule"],
  ];
  raw(input, suffix).tree.root.style[`--al-${token}`] = value;
  rebind(input, suffix);
}
function projected(input: SourceTokenBindingsInput): SourceTokenProjection {
  const result = buildSourceTokenProjection(input);
  assert.equal(
    result.status,
    "source-token-projected-candidate",
    JSON.stringify(result.problems),
  );
  return result;
}
function refused(input: SourceTokenBindingsInput, problem?: RegExp) {
  const result = buildSourceTokenProjection(input);
  assert.equal(result.status, "refused");
  assert.equal(result.acceptedContract, null);
  for (const field of [
    "contract",
    "contractRevision",
    "contractProjectionRevision",
    "tokens",
    "tokenRevision",
    "unqualifiedRuntimeBinding",
    "runtimeBindingRevision",
  ])
    assert.equal(
      result[field as keyof SourceTokenProjection],
      undefined,
      field,
    );
  assert.deepEqual(result.rewrites, []);
  assert.deepEqual(result.sourceTokenPaths, []);
  assert.ok(result.problems.length);
  if (problem) assert.match(result.problems.join(" "), problem);
  return result;
}

test("recorded root names replace exactly eleven addresses with nine exact DTCG identities", () => {
  const input = fixture(),
    before = JSON.stringify(input),
    result = projected(input),
    contract = result.contract!;
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(buildSourceTokenProjection(input), result);
  assert.equal(result.acceptedContract, null);
  assert.equal(result.qualification, "recorded-source-token-references-only");
  assert.equal(result.rewrites.length, 11);
  assert.equal(result.sourceTokenPaths.length, 9);
  const expected = [
    [
      undefined,
      "theme-color-background-primary-default",
      "theme-color-content-primary-weak",
    ],
    [
      "secondary",
      "theme-color-background-secondary-default",
      "theme-color-content-secondary-weak",
    ],
    [
      "tertiary",
      "theme-color-background-transparent-default",
      "theme-color-content-default",
    ],
    [
      "bare",
      "theme-color-background-transparent-default",
      "theme-color-content-default",
    ],
    [
      "danger",
      "theme-color-background-danger-default",
      "theme-color-content-danger-weak",
    ],
  ];
  for (const [variant, background, content] of expected) {
    const refs = resolveTokens(
      contract.anatomy.root,
      variant ? { variant } : {},
    );
    assert.equal(refs["background-color"], `{${background}}`);
    assert.equal(refs.color, `{${content}}`);
    assert.equal(refs["font-weight"], "{font-weight-bold}");
  }
  assert.ok(
    result.rewrites.every(
      (r) =>
        r.templateId === "template:6200:7046" &&
        r.sourceNodeId === "element:6214" &&
        JSON.stringify(r.partPath) === '["root"]',
    ),
  );
  assert.equal(
    result.rewrites.find((r) => r.channel === "font-weight")!.caseIds.length,
    6,
  );
  assert.equal(
    result.rewrites.find(
      (r) => r.channel === "background-color" && r.address.storage === "tokens",
    )!.caseIds.length,
    2,
  );
  assert.deepEqual(
    result.sourceTokenPaths,
    [
      ...new Set(
        expected.flatMap(([, bg, fg]) => [bg!, fg!]).concat("font-weight-bold"),
      ),
    ].sort(),
  );
  const sourceTokens = JSON.parse(input.tokens.json);
  for (const [name, value] of Object.entries(sourceTokens))
    assert.deepEqual(result.tokens![name], value);
  assert.deepEqual(result.tokens!.imported, result.visual.tokens!.imported);
  assert.equal(flattenTokens(result.tokens!).size, 412);
  assert.equal(result.visual.cases.length, 7);
  assert.equal(
    result.visual.cases.filter((c) => c.status === "refused").length,
    1,
  );
  assert.equal(
    result.tokenBindings.cases.filter((c) => c.status === "observed").length,
    6,
  );
});

test("all 250 original part/channel/appearance values and every unselected Contract field remain unchanged", () => {
  const result = projected(fixture()),
    old = result.visual.contract!,
    next = result.contract!;
  const oldValue = makeResolveLiteral(flattenTokens(result.visual.tokens!)),
    nextValue = makeResolveLiteral(flattenTokens(result.tokens!));
  let checked = 0,
    transparent = 0;
  const oldParts = walkAnatomy(old),
    nextParts = walkAnatomy(next);
  for (const props of [
    {},
    ...["secondary", "tertiary", "bare", "danger"].map((variant) => ({
      variant,
    })),
  ]) {
    for (const [index, previous] of oldParts.entries()) {
      assert.deepEqual(nextParts[index].path, previous.path);
      const a = resolveTokens(previous.part, props),
        b = resolveTokens(nextParts[index].part, props);
      assert.deepEqual(Object.keys(a), Object.keys(b));
      for (const channel of Object.keys(a)) {
        const left = oldValue(a[channel].slice(1, -1)),
          right = nextValue(b[channel].slice(1, -1));
        if (left !== right) {
          assert.equal(channel, "background-color");
          assert.equal(left, "#00000000");
          assert.equal(right, "rgba(0, 0, 0, 0)");
          transparent++;
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 250);
  assert.equal(transparent, 2);
  const restored = structuredClone(next);
  for (const rewrite of result.rewrites) {
    const address = rewrite.address;
    const target =
      address.storage === "tokens"
        ? restored.anatomy.root.tokens!
        : tokensByPropEntries(restored.anatomy.root).find(
            (e) => e.prop === address.prop,
          )!.map[address.value];
    target[rewrite.channel] = rewrite.previousEffectiveRef;
  }
  restored.bindings.code.runtime!.bindingRevision =
    old.bindings.code.runtime!.bindingRevision;
  assert.deepEqual(
    restored,
    old,
    "the entire Contract differs only at recorded addresses and binding revision",
  );
  assert.deepEqual(
    result.visual,
    buildSourceVisualContractCandidate(fixture().source),
  );
  assert.deepEqual(result.tokenBindings, resolveSourceTokenBindings(fixture()));
});

test("source, upstream, token, projection and runtime identities remain separate and self-consistent", () => {
  const input = fixture(),
    result = projected(input),
    contract = result.contract!,
    binding = result.unqualifiedRuntimeBinding!;
  assert.deepEqual(result.prior, {
    visualRevision: revisionOf(result.visual),
    tokenBindingsRevision: revisionOf(result.tokenBindings),
    contractRevision: result.visual.contractRevision,
    tokenRevision: result.visual.tokenRevision,
    runtimeBindingRevision:
      result.visual.contract!.bindings.code.runtime!.bindingRevision,
  });
  assert.equal(
    result.source!.semanticsRevision,
    revisionOf(input.source.semantics),
  );
  assert.deepEqual(result.context, {
    mode: "dark",
    brand: "default",
    tokensSha256: input.tokens.sha256,
  });
  assert.equal(result.contractRevision, revisionOf(contract));
  assert.equal(result.tokenRevision, revisionOf(result.tokens));
  assert.equal(
    result.contractProjectionRevision,
    runtimeProjectionRevision(contract),
  );
  assert.equal(binding.contractRevision, result.contractProjectionRevision);
  assert.equal(binding.tokenRevision, result.tokenRevision);
  assert.equal(result.runtimeBindingRevision, revisionOf(binding));
  assert.equal(
    contract.bindings.code.runtime!.bindingRevision,
    result.runtimeBindingRevision,
  );
  const {
    contractRevision: _contract,
    tokenRevision: _tokens,
    ...sourceBinding
  } = binding;
  const {
    contractRevision: _priorContract,
    tokenRevision: _priorTokens,
    ...priorBinding
  } = result.visual.unqualifiedRuntimeBinding!;
  assert.deepEqual(sourceBinding, priorBinding);
  assert.equal(binding.version, 0);
  assert.equal(
    result.visual.seed!.contract!.bindings.code.runtime!.bindingRevision,
    revisionOf(result.visual.seed!.unqualifiedRuntimeBinding),
  );
  assert.notEqual(result.contractRevision, result.prior.contractRevision);
  assert.notEqual(result.tokenRevision, result.prior.tokenRevision);
  ContractSchema.parse(contract);
  const errors: string[] = [];
  validateContract(
    contract,
    new Map([[contract.id, contract]]),
    errors,
    new Map(),
  );
  assert.deepEqual(errors, []);
});

test("equal-valued distinct source names preserve variant identity even when value fusion minted one constant", () => {
  const input = fixture();
  tokenChange(input, (tree) => {
    tree["font-weight-synthetic-alt"] = { $type: "number", $value: "600" };
  });
  sourceRef(input, "--bare", "font-weight", "font-weight-synthetic-alt");
  const result = projected(input),
    old = result.visual.contract!.anatomy.root,
    next = result.contract!.anatomy.root;
  assert.equal(
    resolveTokens(old, { variant: "bare" })["font-weight"],
    old.tokens!["font-weight"],
  );
  assert.equal(
    resolveTokens(next, { variant: "bare" })["font-weight"],
    "{font-weight-synthetic-alt}",
  );
  assert.equal(
    resolveTokens(next, { variant: "danger" })["font-weight"],
    "{font-weight-bold}",
  );
  assert.equal(result.rewrites.length, 12);
  assert.equal(result.sourceTokenPaths.length, 10);
  assert.equal(
    next.parts!.node6788.tokens!["font-weight"],
    old.parts!.node6788.tokens!["font-weight"],
    "equal-valued wrapper usage must not be globally renamed",
  );
  assert.equal(
    result.rewrites.find(
      (r) => r.channel === "font-weight" && r.address.storage === "tokens",
    )!.caseIds.length,
    5,
  );
});

test("equal transparent values on two variant planes retain their distinct recorded names", () => {
  const input = fixture();
  sourceRef(input, "--bare", "background-color", "color-transparent-dark-0");
  const result = projected(input),
    root = result.contract!.anatomy.root;
  assert.equal(
    resolveTokens(root, { variant: "bare" })["background-color"],
    "{color-transparent-dark-0}",
  );
  assert.equal(
    resolveTokens(root, { variant: "tertiary" })["background-color"],
    "{theme-color-background-transparent-default}",
  );
});

test("same-variant additional samples must agree on source name, not merely computed value", () => {
  const input = fixture();
  sourceRef(
    input,
    "--default-icon-before",
    "background-color",
    "color-brand-blue-500",
  );
  const result = refused(input, /same-variant-token-name-conflict/);
  assert.equal(result.visual.status, "measured-candidate");
  assert.equal(
    result.tokenBindings.cases.filter((c) => c.status === "observed").length,
    6,
  );
});

test("root-only scope keeps even newly corroborated wrapper bindings provisional and excludes samples", () => {
  const input = fixture(),
    row = raw(input);
  const wrapper = row.tree.root.nodes
    .filter((n) => n.t === "el")
    .map((n) => n.el)
    .find((n) => n.style["font-weight"] === "600")!;
  assert.ok(wrapper);
  wrapper.vrefs = {
    ...wrapper.vrefs,
    "font-weight": [
      ["--al-font-weight-bold", "600", ".synthetic-wrapper-rule"],
    ],
  };
  rebind(input);
  const result = projected(input),
    bound = result.tokenBindings.cases[0].outcomes;
  assert.ok(
    bound.some(
      (o) =>
        o.visualPath !== "" &&
        o.status === "bound" &&
        o.channel === "font-weight",
    ),
  );
  assert.deepEqual(
    result.contract!.anatomy.root.parts,
    result.visual.contract!.anatomy.root.parts,
  );
  assert.ok(result.rewrites.every((r) => r.sourceNodeId === "element:6214"));
  assert.equal(result.rewrites.length, 11);
  assert.equal(
    result.visual.cases.find((c) => c.id.endsWith("--default-icon-before"))!
      .projection!.samples.length,
    3,
  );
});

test("source aliases are preserved as names with their complete original resolution graph", () => {
  const input = fixture();
  tokenChange(input, (tree) => {
    tree["theme-color-background-primary-default"].$value =
      "{color-brand-blue-500}";
  });
  const result = projected(input);
  assert.equal(
    result.contract!.anatomy.root.tokens!["background-color"],
    "{theme-color-background-primary-default}",
  );
  assert.deepEqual(result.tokens!["theme-color-background-primary-default"], {
    $type: "color",
    $value: "{color-brand-blue-500}",
  });
  assert.equal(
    makeResolveLiteral(flattenTokens(result.tokens!))(
      "theme-color-background-primary-default",
    ),
    "#4375ff",
  );
});

test("missing, ambiguous or unresolved root evidence cannot be completed from other cases or equal values", async (t) => {
  for (const mutation of [
    "missing",
    "ambiguous",
    "unresolved",
    "shorthand",
    "extra-sample-missing",
  ])
    await t.test(mutation, () => {
      const input = fixture(),
        suffix =
          mutation === "extra-sample-missing"
            ? "--default-icon-before"
            : "--default",
        node = raw(input, suffix).tree.root;
      if (mutation === "missing" || mutation === "extra-sample-missing")
        delete node.vrefs!["background-color"];
      if (mutation === "ambiguous")
        node.vrefs!["background-color"].push([
          "--al-color-brand-blue-500",
          "#4375ff",
          ".competing-rule",
        ]);
      if (mutation === "unresolved")
        node.vrefs!["background-color"][0][0] = "--al-unrecorded-token";
      if (mutation === "shorthand")
        node.vshorthands = {
          "background-color": ["--al-theme-color-background-primary-default"],
        };
      rebind(input, suffix);
      const result = refused(input, /root-binding-unqualified/);
      assert.equal(result.tokenBindings.cases.length, 7);
      assert.deepEqual(
        result.visual,
        buildSourceVisualContractCandidate(input.source),
      );
    });
});

test("source, case and part mismatches cannot borrow a different observation", async (t) => {
  for (const mutation of [
    "source",
    "tree",
    "semantic-variant",
    "source-span",
    "root-id",
    "missing-plane",
    "missing-extra-sample",
    "duplicate-case",
    "foreign-case",
  ])
    await t.test(mutation, () => {
      const input = fixture();
      if (mutation === "source") input.source.source.source += "\nchanged";
      if (mutation === "tree")
        raw(input).tree.root.style.color = "rgb(255, 0, 0)";
      if (mutation === "semantic-variant") {
        raw(input).semantics.observation.properties.variant = {
          kind: "value",
          value: "danger",
        };
        raw(input).semantics.observationSha256 = semanticHash(
          raw(input).semantics.observation,
        );
      }
      if (mutation === "source-span")
        input.source.semantics.cases[0].nodes[0].sourceSpan.start++;
      if (mutation === "root-id")
        input.source.semantics.cases[0].branch!.sourceNodeId = "element:6788";
      if (mutation === "missing-plane")
        input.source.cases = input.source.cases.filter(
          (c) => !c.expectedCaseId.endsWith("--danger"),
        );
      if (mutation === "missing-extra-sample")
        input.source.cases = input.source.cases.filter(
          (c) => !c.expectedCaseId.endsWith("--default-icon-before"),
        );
      if (mutation === "duplicate-case")
        input.source.cases.push(structuredClone(raw(input)));
      if (mutation === "foreign-case") raw(input).expectedCaseId = "foreign";
      const result = refused(input);
      assert.equal(result.tokenBindings.cases.length, 7);
      assert.deepEqual(
        result.visual,
        buildSourceVisualContractCandidate(input.source),
      );
    });
});

test("token context, schema, alias graph and namespace errors never create a partial projection", async (t) => {
  for (const mutation of [
    "hash",
    "mode",
    "brand",
    "changed-value",
    "missing-leaf",
    "cycle",
    "dangling",
    "wrong-type",
    "namespace",
  ])
    await t.test(mutation, () => {
      const input = fixture();
      if (mutation === "hash") input.tokens.sha256 = "0".repeat(64);
      if (mutation === "mode") input.tokens.mode = "light" as never;
      if (mutation === "brand") input.tokens.brand = "unknown" as never;
      if (mutation === "changed-value")
        tokenChange(input, (tree) => {
          tree["font-weight-bold"].$value = "700";
        });
      if (mutation === "missing-leaf")
        tokenChange(input, (tree) => {
          delete tree["font-weight-bold"];
        });
      if (mutation === "cycle")
        tokenChange(input, (tree) => {
          tree["font-weight-bold"].$value = "{font-weight-bold}";
        });
      if (mutation === "dangling")
        tokenChange(input, (tree) => {
          tree["font-weight-bold"].$value = "{not-a-leaf}";
        });
      if (mutation === "wrong-type")
        tokenChange(input, (tree) => {
          tree["font-weight-bold"].$type = "string";
        });
      if (mutation === "namespace")
        tokenChange(input, (tree) => {
          tree.imported = { $type: "number", $value: "600" };
        });
      refused(
        input,
        mutation === "namespace" ? /namespace-collision/ : undefined,
      );
    });
});

test("lossy minted alpha cannot silently change when replaced by an exact source token", () => {
  const input = fixture();
  tokenChange(input, (tree) => {
    tree["theme-color-background-primary-default"].$value =
      "rgba(0, 0, 0, 0.5)";
  });
  for (const row of input.source.cases) {
    row.tree.root.style["--al-theme-color-background-primary-default"] =
      "rgba(0, 0, 0, 0.5)";
    if (
      row.expectedCaseId.endsWith("--default") ||
      row.expectedCaseId.endsWith("--default-icon-before")
    ) {
      row.tree.root.style["background-color"] = "rgba(0, 0, 0, 0.5)";
      row.tree.root.vrefs!["background-color"][0][1] = "rgba(0, 0, 0, 0.5)";
    }
    rebind(input, row.expectedCaseId);
  }
  const result = refused(input, /resolved-value-changed/);
  assert.equal(result.visual.status, "measured-candidate");
  assert.equal(result.tokenBindings.status, "source-bindings-observed");
});

test("projected refs retain the runtime guard in both emitters, including accidental host registration", () => {
  const result = projected(fixture()),
    contract = result.contract!;
  assert.equal(result.unqualifiedRuntimeBinding!.version, 0);
  assert.throws(
    () =>
      emitReact(contract, {
        tokens: new Set(flattenTokens(result.tokens!).keys()),
        icons: new Map(),
        contracts: new Map([[contract.id, contract]]),
      }),
    /TRUSTED-CONTEXT-MISSING/,
  );
  assert.throws(
    () =>
      createFigmaEngine({
        tokens: {
          primitives: result.tokens!,
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        },
        icons: new Map(),
      }).compileComponentData(contract, new Map()),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
  // Supply otherwise consistent synthetic registry identities to isolate the
  // version-zero fence. This does not claim an original runtime was executed.
  const probe = structuredClone(contract),
    reference = probe.bindings.code.runtime!,
    binding = structuredClone(result.unqualifiedRuntimeBinding!);
  const iface = {
    module: { path: "fixture.js", exportName: "Fixture" },
    declaration: { path: "fixture.d.ts", exportName: "Fixture" },
    writableProperties: [],
    properties: [],
    slots: [],
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  reference.interfaceRevision = binding.interfaceRevision = revisionOf(iface);
  reference.bindingRevision = revisionOf(binding);
  assert.throws(
    () =>
      resolveRuntimeEmission(probe, {
        artifacts: new Map([
          [
            reference.artifactRevision,
            {
              artifactRevision: reference.artifactRevision,
              interfaceRevision: reference.interfaceRevision,
              registrationTag: "fixture-element",
              interface: iface,
              stylesheets: [],
            },
          ],
        ]),
        bindings: new Map([[reference.bindingRevision, binding as never]]),
        tokens: result.tokens,
      }),
    /IDENTITY-MISMATCH/,
  );
});

test("malformed input and caller-supplied verdicts never bypass raw rederivation", () => {
  for (const value of [
    undefined,
    null,
    {},
    { source: {} },
    {
      source: { status: "measured-candidate", acceptedContract: {} },
      tokens: {},
    },
  ])
    refused(value as never);
  const input = fixture();
  delete raw(input).tree.root.vrefs!["font-weight"];
  rebind(input);
  Object.assign(input, {
    acceptedContract: {},
    visual: { status: "measured-candidate" },
    tokenBindings: { status: "source-bindings-observed" },
  });
  refused(input, /root-binding-unqualified/);
});
