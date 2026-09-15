import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import type { CapturedNode } from "../extract/computed/lib.js";
import { semanticHash } from "./semantics.js";
import {
  resolveSourceTokenBindings,
  type SourceTokenBindingsInput,
} from "./source-token-bindings.js";

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
  assert.equal(bytes.length, pack.payloadBytes);
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
function first(input: SourceTokenBindingsInput) {
  return input.source.cases[0];
}
/** Mutations are synthetic counterexamples, not replacements for the original
 * source key. Rebind only the visual hash seam to exercise name/value checks. */
function rebind(input: SourceTokenBindingsInput) {
  const raw = first(input),
    id = raw.expectedCaseId;
  raw.tree.sha256 = sha(JSON.stringify(raw.tree.root));
  raw.semantics.sourceTreeSha256 = raw.tree.sha256;
  raw.boundTopology.sourceTreeSha256 = raw.tree.sha256;
  raw.boundTopology.topology!.sourceTreeSha256 = raw.tree.sha256;
  input.source.semantics.cases.find((c) => c.id === id)!.sourceTreeSha256 =
    raw.tree.sha256;
}
function replaceTokens(
  input: SourceTokenBindingsInput,
  change: (tree: Record<string, any>) => void,
) {
  const tree = JSON.parse(input.tokens.json);
  change(tree);
  input.tokens.json = JSON.stringify(tree);
  input.tokens.sha256 = sha(input.tokens.json);
}
const outcomes = (out: ReturnType<typeof resolveSourceTokenBindings>) =>
  out.cases.flatMap((c) => c.outcomes);

test("six actual original cases bind only source-owned recorded names; seven-row denominator remains", () => {
  const input = fixture(),
    before = JSON.stringify(input),
    out = resolveSourceTokenBindings(input);
  assert.equal(
    out.status,
    "source-bindings-observed",
    JSON.stringify(out.problems),
  );
  assert.equal(out.acceptedContract, null);
  assert.equal(out.tokensSha256, input.tokens.sha256);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(resolveSourceTokenBindings(input), out);
  assert.equal(out.cases.length, 7);
  assert.equal(out.cases.filter((c) => c.status === "observed").length, 6);
  assert.ok(
    out.cases.find((c) => c.id.endsWith("--default-disabled"))!.problems.length,
  );
  assert.equal(outcomes(out).filter((o) => o.status === "bound").length, 18);
  const expected = new Map([
    ["--default", "theme-color-background-primary-default"],
    ["--secondary", "theme-color-background-secondary-default"],
    ["--tertiary", "theme-color-background-transparent-default"],
    ["--bare", "theme-color-background-transparent-default"],
    ["--danger", "theme-color-background-danger-default"],
    ["--default-icon-before", "theme-color-background-primary-default"],
  ]);
  for (const [suffix, token] of expected) {
    const row = out.cases.find((c) => c.id.endsWith(suffix))!;
    assert.equal(row.environment.checked, 322);
    assert.equal(row.environment.mismatches.length, 0);
    assert.equal(
      row.outcomes.find((o) => o.channel === "background-color")!.binding!
        .tokenPath,
      token,
    );
    assert.equal(
      row.outcomes.find((o) => o.channel === "font-weight")!.binding!.tokenPath,
      "font-weight-bold",
    );
    assert.ok(row.outcomes.every((o) => o.visualPath === ""));
    assert.ok(
      row.unreferencedChannels.some((e) => e.channels.includes("padding-top")),
    );
    assert.ok(
      row.unreferencedChannels.some(
        (e) => e.visualPath !== "" && e.channels.includes("color"),
      ),
    );
    assert.equal(
      row.outcomes.some((o) =>
        /padding|font-family|line-height/.test(o.channel),
      ),
      false,
    );
  }
  const icon = out.cases.find((c) => c.id.endsWith("--default-icon-before"))!;
  const sampleChannels = (node: CapturedNode): string[] => [
    ...Object.keys(node.vrefs ?? {}),
    ...node.nodes.flatMap((child) =>
      child.t === "el" ? sampleChannels(child.el) : [],
    ),
  ];
  const recordedIconChannels = sampleChannels(
    input.source.cases.find((c) => c.expectedCaseId === icon.id)!.tree.root,
  );
  assert.ok(
    recordedIconChannels.includes("width") &&
      recordedIconChannels.includes("height"),
    "recorded icon actually contains token references that must be excluded",
  );
  assert.equal(icon.excludedSampleIds.length, 3);
  assert.equal(
    icon.outcomes.some((o) => o.channel === "width" || o.channel === "height"),
    false,
  );
  assert.equal("contract" in out, false);
});

test("wrong context, digest and relabeled light token bytes refuse without bound outcomes", async (t) => {
  for (const mutation of [
    "mode",
    "brand",
    "hash",
    "light",
    "value",
    "missing-leaf",
  ])
    await t.test(mutation, () => {
      const input = fixture();
      if (mutation === "mode") input.tokens.mode = "light" as never;
      if (mutation === "brand") input.tokens.brand = "southleft" as never;
      if (mutation === "hash") input.tokens.sha256 = "a".repeat(64);
      if (mutation === "light") {
        input.tokens.json = readFileSync(
          new URL(
            "../examples/altitude/tokens/modes/altitude.light.dtcg.json",
            import.meta.url,
          ),
          "utf8",
        );
        input.tokens.sha256 = sha(input.tokens.json);
      }
      if (mutation === "value")
        replaceTokens(input, (tree) => {
          tree["theme-color-background-primary-default"].$value = "#ffffff";
        });
      if (mutation === "missing-leaf")
        replaceTokens(input, (tree) => {
          delete tree["theme-color-background-primary-default"];
        });
      const out = resolveSourceTokenBindings(input);
      assert.equal(out.status, "refused");
      assert.equal(out.cases.length, 7);
      assert.equal(outcomes(out).filter((o) => o.status === "bound").length, 0);
      assert.ok(
        out.problems.length || out.cases.some((c) => c.problems.length),
      );
    });
});

test("two recorded same-value source names are ambiguous, never sorted-first or value-guessed", () => {
  const input = fixture(),
    raw = first(input);
  raw.tree.root.vrefs!["background-color"].push([
    "--al-color-brand-blue-500",
    "#4375ff",
    ".synthetic-competing-rule",
  ]);
  rebind(input);
  const out = resolveSourceTokenBindings(input),
    row = out.cases[0];
  const channel = row.outcomes.find((o) => o.channel === "background-color")!;
  assert.equal(channel.status, "ambiguous");
  assert.equal(channel.binding, undefined);
  assert.deepEqual(
    channel.candidates
      .filter((c) => c.matches)
      .map((c) => c.tokenPath)
      .sort(),
    ["color-brand-blue-500", "theme-color-background-primary-default"],
  );
  assert.equal(row.outcomes.filter((o) => o.status === "bound").length, 2);
});

test("repeated same-name selectors retain all evidence without inventing a winning selector", () => {
  const input = fixture();
  first(input).tree.root.vrefs!["background-color"].push([
    "--al-theme-color-background-primary-default",
    "#4375ff",
    ".another-matching-rule",
  ]);
  rebind(input);
  const channel = resolveSourceTokenBindings(input).cases[0].outcomes.find(
    (o) => o.channel === "background-color",
  )!;
  assert.equal(channel.status, "bound");
  assert.deepEqual(channel.binding!.selectors, [
    ".al-c-button",
    ".another-matching-rule",
  ]);
});

test("candidate raw value must equal the separately recorded variable and the computed channel", async (t) => {
  for (const mutation of [
    "raw",
    "computed",
    "unknown-name",
    "relative-unit",
    "shorthand",
  ])
    await t.test(mutation, () => {
      const input = fixture(),
        node = first(input).tree.root;
      let channel = "background-color";
      if (mutation === "raw") node.vrefs![channel][0][1] = "#ffffff";
      if (mutation === "computed") node.style[channel] = "rgb(255, 255, 255)";
      if (mutation === "unknown-name")
        node.vrefs![channel] = [
          ["--al-no-such-token", "#4375ff", ".al-c-button"],
        ];
      if (mutation === "relative-unit") {
        channel = "padding-top";
        node.vrefs![channel] = [
          ["--al-theme-space-xs", "0.5rem", ".al-c-button"],
        ];
      }
      if (mutation === "shorthand") {
        channel = "padding";
        node.vshorthands = {
          padding: ["--al-theme-space-xs", "--al-theme-space"],
        };
      }
      rebind(input);
      const row = resolveSourceTokenBindings(input).cases[0],
        outcome = row.outcomes.find((o) => o.channel === channel)!;
      assert.equal(outcome.status, "unresolved");
      assert.equal(outcome.binding, undefined);
      assert.ok(
        outcome.problems.length ||
          outcome.candidates.some((c) => c.problems.length),
      );
    });
});

test("name-bound DTCG aliases reuse the resolver but cycles and missing targets refuse", async (t) => {
  const input = fixture();
  replaceTokens(input, (tree) => {
    tree["theme-color-background-primary-default"].$value =
      "{color-brand-blue-500}";
  });
  assert.equal(
    resolveSourceTokenBindings(input).cases[0].outcomes.find(
      (o) => o.channel === "background-color",
    )!.status,
    "bound",
  );
  for (const alias of [
    "{no-such-leaf}",
    "{theme-color-background-primary-default}",
  ])
    await t.test(alias, () => {
      const broken = fixture();
      replaceTokens(broken, (tree) => {
        tree["theme-color-background-primary-default"].$value = alias;
      });
      const out = resolveSourceTokenBindings(broken);
      assert.equal(out.status, "refused");
      assert.equal(outcomes(out).filter((o) => o.status === "bound").length, 0);
    });
});

test("source/tree/semantic tampering and omitted original rows stay refused with no borrowed identity", async (t) => {
  for (const mutation of [
    "tree",
    "source",
    "semantic",
    "missing-row",
    "duplicate-row",
    "foreign-row",
  ])
    await t.test(mutation, () => {
      const input = fixture(),
        id = first(input).expectedCaseId;
      if (mutation === "tree")
        first(input).tree.root.style.color = "rgb(255, 0, 0)";
      if (mutation === "source") input.source.source.source += "\n// changed";
      if (mutation === "semantic") {
        first(input).semantics.observation.properties.variant = {
          kind: "value",
          value: "danger",
        };
        first(input).semantics.observationSha256 = semanticHash(
          first(input).semantics.observation,
        );
      }
      if (mutation === "missing-row") input.source.cases.shift();
      if (mutation === "duplicate-row")
        input.source.cases.push(structuredClone(first(input)));
      if (mutation === "foreign-row") first(input).expectedCaseId = "unknown";
      const out = resolveSourceTokenBindings(input);
      assert.equal(out.cases.length, 7);
      assert.equal(out.cases.find((c) => c.id === id)!.status, "refused");
      assert.equal(out.cases.find((c) => c.id === id)!.outcomes.length, 0);
    });
});

test("malformed requests return refusal, never throw or mint an accepted contract", () => {
  for (const value of [
    undefined,
    null,
    {},
    { source: {} },
    { ...fixture(), tokens: {} },
  ]) {
    const out = resolveSourceTokenBindings(value as never);
    assert.equal(out.status, "refused");
    assert.equal(out.acceptedContract, null);
  }
});

test("unsupported expressions and indirect records never become direct bindings", async (t) => {
  for (const mutation of [
    "calc",
    "indirect",
    "empty-selector",
    "malformed-record",
  ])
    await t.test(mutation, () => {
      const input = fixture(),
        node = first(input).tree.root;
      if (mutation === "calc")
        node.vcalcs = {
          "background-color": [
            [
              ["--al-theme-color-background-primary-default"],
              "calc(var(--al-theme-color-background-primary-default))",
            ],
          ],
        };
      if (mutation === "indirect")
        node.vrefs!["background-color"][0].push(1 as never);
      if (mutation === "empty-selector")
        node.vrefs!["background-color"][0][2] = "";
      if (mutation === "malformed-record")
        node.vrefs!["font-weight"].push(["bad"] as never);
      rebind(input);
      const row = resolveSourceTokenBindings(input).cases[0];
      if (mutation === "malformed-record") {
        assert.equal(row.status, "refused");
        assert.deepEqual(
          row.outcomes,
          [],
          "a malformed later channel must clear earlier bound outcomes",
        );
      } else {
        const outcome = row.outcomes.find(
          (o) => o.channel === "background-color",
        )!;
        assert.equal(outcome.status, "unresolved");
        assert.equal(outcome.binding, undefined);
      }
    });
});

test("color normalization never rounds alpha to make two unequal values bind", () => {
  const input = fixture(),
    node = first(input).tree.root;
  replaceTokens(input, (tree) => {
    tree["theme-color-background-primary-default"].$value = "#00000080";
  });
  node.style["--al-theme-color-background-primary-default"] = "#00000080";
  node.vrefs!["background-color"][0][1] = "#00000080";
  node.style["background-color"] = "rgba(0, 0, 0, 0.502)";
  rebind(input);
  const outcome = resolveSourceTokenBindings(input).cases[0].outcomes.find(
    (o) => o.channel === "background-color",
  )!;
  assert.equal(outcome.status, "unresolved");
  assert.ok(
    outcome.candidates.some((c) =>
      c.problems.includes("source-token-computed-value-mismatch"),
    ),
  );
});
