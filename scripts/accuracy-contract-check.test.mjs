import assert from "node:assert/strict";
import test from "node:test";
import {
  loadAccuracyInputs,
  validateAccuracyContract,
} from "./accuracy-contract-check.mjs";

const clone = (value) => structuredClone(value);
const validate = (mutate = () => {}) => {
  const inputs = clone(loadAccuracyInputs());
  mutate(inputs);
  return validateAccuracyContract(inputs);
};
const hasError = (result, fragment) =>
  result.errors.some((error) => error.includes(fragment));

test("the committed accuracy contract passes", () => {
  const result = validate();
  assert.deepEqual(result.errors, []);
  assert.equal(result.metrics.R1.countEqualComponents, 9);
  assert.equal(result.metrics.R1.verifiedExactComponents, 0);
  assert.equal(result.metrics.R5.unclassifiedSourceFacts, 0);
  assert.equal(result.metrics.R6.unclassifiedInventedFacts, 0);
});

test("requires R1 through R6 exactly once", () => {
  const result = validate(({ grammar }) => {
    grammar.roundTripInvariants[5].id = "R5";
  });
  assert.ok(hasError(result, "R1 through R6"));
});

test("rejects CSS/DOM denominator drift", () => {
  const result = validate(({ cssDom }) => {
    cssDom.cases.pop();
  });
  assert.ok(hasError(result, "css-dom denominator drift"));
});

test("rejects canvas expectation drift", () => {
  const result = validate(({ canvas }) => {
    canvas.cases[0].expect = "REFUSED";
  });
  assert.ok(hasError(result, "canvas denominator drift"));
});

test("rejects silent draw-read closure", () => {
  const result = validate(({ closure }) => {
    closure.summary.silent = 1;
  });
  assert.ok(hasError(result, "draw-read closure drift"));
});

test("rejects an undeclared report tag", () => {
  const result = validate(({ report }) => {
    report.results[0].invented[0].tag = "plausible-but-undeclared";
  });
  assert.ok(hasError(result, "undeclared normalization tag"));
});

test("rejects a stale normalization rule", () => {
  const result = validate(({ grammar }) => {
    grammar.normalizationRules["no-longer-observed"] = "stale";
  });
  assert.ok(hasError(result, "unused normalization tag"));
});

test("rejects duplicate variant refusal codes", () => {
  const result = validate(({ grammar }) => {
    grammar.variantRecoveryRefusals.push(grammar.variantRecoveryRefusals[0]);
  });
  assert.ok(hasError(result, "must be non-empty and unique"));
});

test("rejects an R4 evidence command without a package script", () => {
  const result = validate(({ grammar }) => {
    grammar.evidenceCommands.R4.push("npm run missing:accuracy-proof");
  });
  assert.ok(hasError(result, "is not a package script"));
});

test("rejects an R4 evidence-count regression", () => {
  const result = validate(({ baseline }) => {
    baseline.metrics.R4.requiredEvidenceCommands += 1;
  });
  assert.ok(hasError(result, "R4 evidence regressed"));
});

test("rejects duplicate R4 evidence commands", () => {
  const result = validate(({ grammar }) => {
    grammar.evidenceCommands.R4[2] = grammar.evidenceCommands.R4[0];
  });
  assert.ok(hasError(result, "must be unique"));
});

test("rejects unique R4 aliases that resolve to one terminal check", () => {
  const result = validate(({ grammar, baseline, packageJson }) => {
    const aliases = ["proof:a", "proof:b", "proof:c"];
    aliases.forEach((name) => {
      packageJson.scripts[name] = "npm run eval";
    });
    grammar.evidenceCommands.R4 = aliases.map((name) => `npm run ${name}`);
    baseline.metrics.R4.commands = [...grammar.evidenceCommands.R4];
  });
  assert.ok(hasError(result, "do not resolve to independent terminal checks"));
});

test("canonicalizes syntactically varied npm aliases before R4 uniqueness", () => {
  const result = validate(({ grammar, baseline, packageJson }) => {
    packageJson.scripts["proof:a"] = "npm run eval --silent";
    packageJson.scripts["proof:b"] = "npm --silent run eval";
    packageJson.scripts["proof:c"] = "npm run --silent eval";
    grammar.evidenceCommands.R4 = [
      "npm run proof:a",
      "npm run proof:b",
      "npm run proof:c",
    ];
    baseline.metrics.R4.commands = [...grammar.evidenceCommands.R4];
  });
  assert.ok(hasError(result, "do not resolve to independent terminal checks"));
});

test("rejects a changed component denominator", () => {
  const result = validate(({ report }) => {
    report.results.pop();
  });
  assert.ok(hasError(result, "component denominator changed"));
});

test("rejects duplicate or substituted component identities", () => {
  const result = validate(({ report }) => {
    report.results[1].contractId = report.results[0].contractId;
  });
  assert.ok(hasError(result, "component identity drift"));
});

test("rejects report totals that do not reconcile to result rows", () => {
  const result = validate(({ report }) => {
    report.totals.matched += 1;
  });
  assert.ok(hasError(result, "round-trip totals drift at matched"));
});

test("rejects fabricated verified-exact evidence", () => {
  const result = validate(({ report }) => {
    report.results[0].exactProjection = { status: "verified-exact" };
  });
  assert.ok(hasError(result, "verified receipt"));
});

test("rejects a duplicate-tuple exact receipt", () => {
  const result = validate(({ report }) => {
    const tuple = JSON.stringify([["Size", "md"]]);
    report.results[0].exactProjection = {
      status: "verified-exact",
      propertyNames: ["Size"],
      expectedCount: 2,
      observedCount: 2,
      tuples: [tuple, tuple],
      tupleSetHash:
        "b3a420d13f0e6f4e7498f0b86d8ef3b692d35f3317f8796a1b4fceb3aa7aef42",
    };
  });
  assert.ok(hasError(result, "tuples are malformed or duplicated"));
});

test("rejects an R1 variant-count regression", () => {
  const result = validate(({ report }) => {
    const exact = report.results.find(
      (entry) =>
        entry.status === "diffed" &&
        entry.originalVariants === entry.roundTripVariants,
    );
    exact.roundTripVariants += 1;
  });
  assert.ok(hasError(result, "R1 mismatched components regressed"));
});

test("rejects losing previously verified exact projection evidence", () => {
  const result = validate(({ baseline }) => {
    baseline.metrics.R1.verifiedExactComponents = 1;
  });
  assert.ok(hasError(result, "R1 verified exact components regressed"));
});

test("rejects an R2 nested-instance regression", () => {
  const result = validate(({ report }) => {
    report.results[0].diverged.push({
      variant: "Size=md",
      path: "icon",
      channel: "kind",
      value: "instance → box",
    });
  });
  assert.ok(hasError(result, "R2 identity violations regressed"));
});

test("rejects an instance target substitution", () => {
  const result = validate(({ report }) => {
    report.results[0].diverged.push({
      variant: "Size=md",
      path: "icon",
      channel: "instanceOf",
      value: "old-target → new-target",
      tag: "instance-target-loss",
    });
  });
  assert.ok(hasError(result, "R2 identity violations regressed"));
});

test("rejects an R3 text-style regression", () => {
  const result = validate(({ report }) => {
    report.results[0].loss.push({
      variant: "Size=md",
      path: "label",
      channel: "text.style",
      value: "Text sm/Regular",
      tag: "text-style-identity",
    });
  });
  assert.ok(hasError(result, "R3 text-style identity losses regressed"));
});

test("rejects a text-style identity substitution", () => {
  const result = validate(({ report }) => {
    report.results[0].diverged.push({
      variant: "Size=md",
      path: "label",
      channel: "text.style",
      value: "Text sm/Regular → Text sm/Bold",
      tag: "text-style-identity",
    });
  });
  assert.ok(hasError(result, "R3 text-style identity losses regressed"));
});

test("rejects an R5 unclassified source-fact regression", () => {
  const result = validate(({ report }) => {
    report.results[0].loss.push({
      variant: "Size=md",
      path: "root",
      channel: "new-channel",
      value: "lost",
    });
  });
  assert.ok(hasError(result, "R5 unclassified source facts regressed"));
});

test("rejects a broken source-fact conservation equation", () => {
  const result = validate(({ report }) => {
    report.results[0].originalFacts += 1;
    report.totals.originalFacts += 1;
  });
  assert.ok(hasError(result, "R5 conservation violations regressed"));
});

test("rejects a broken returned-fact conservation equation", () => {
  const result = validate(({ report }) => {
    report.results[0].roundTripFacts += 1;
    report.totals.roundTripFacts += 1;
  });
  assert.ok(hasError(result, "R5 return conservation violations regressed"));
});

test("rejects shrinking the source-fact denominator", () => {
  const result = validate(({ baseline }) => {
    baseline.metrics.R5.minOriginalFacts += 1;
  });
  assert.ok(hasError(result, "R5 source denominator regressed"));
});

test("rejects a broad defect tag on a novel channel", () => {
  const result = validate(({ report }) => {
    report.results[0].loss.push({
      variant: "Size=md",
      path: "root",
      channel: "layout.future-channel",
      value: "lost",
      tag: "layout-projection-loss",
    });
    report.results[0].originalFacts += 1;
    report.totals.loss += 1;
    report.totals.originalFacts += 1;
  });
  assert.ok(hasError(result, "does not satisfy rule layout-projection-loss"));
});

test("rejects restructured without an opposite-side paired basis", () => {
  const result = validate(({ report }) => {
    const fact = report.results[0].loss.find(
      (candidate) => candidate.tag !== "restructured",
    );
    fact.tag = "restructured";
    delete fact.basis;
  });
  assert.ok(hasError(result, "does not satisfy rule restructured"));
});

test("rejects duplicate one-sided restructured basis evidence", () => {
  const result = validate(({ report }) => {
    const row = report.results.find((entry) =>
      entry.loss.some((fact) => fact.tag === "restructured"),
    );
    const duplicate = structuredClone(
      row.loss.find((fact) => fact.tag === "restructured"),
    );
    row.loss.push(duplicate);
    row.originalFacts += 1;
    report.totals.loss += 1;
    report.totals.originalFacts += 1;
  });
  assert.ok(hasError(result, "must pair exactly one loss with one invention"));
});

test("rejects arbitrary facts disguised as wrapper evidence", () => {
  const result = validate(({ report }) => {
    const row = report.results.find((entry) =>
      entry.invented.some((fact) => fact.tag === "structure-wrapper-invention"),
    );
    const wrapper = row.invented.find(
      (fact) => fact.tag === "structure-wrapper-invention",
    );
    row.invented.push({
      variant: wrapper.variant,
      path: wrapper.path,
      channel: "future.arbitrary",
      value: "fabricated",
      tag: "structure-wrapper-invention",
      basis: wrapper.basis,
    });
    row.roundTripFacts += 1;
    report.totals.invented += 1;
    report.totals.roundTripFacts += 1;
  });
  assert.ok(
    hasError(result, "does not satisfy rule structure-wrapper-invention"),
  );
});

test("rejects any unclassified invented fact", () => {
  const result = validate(({ report }) => {
    report.results[0].invented[0].tag = undefined;
  });
  assert.ok(hasError(result, "R6 unclassified invented facts regressed"));
});

test("rejects an internally inconsistent R1 baseline", () => {
  const result = validate(({ baseline }) => {
    baseline.metrics.R1.countEqualComponents = 8;
  });
  assert.ok(hasError(result, "R1 count-equal + count-mismatched"));
});

test("rejects a fidelity per-set mean below its floor", () => {
  const result = validate(({ fidelity }) => {
    for (const row of fidelity) {
      if (row.set === "tooltip" && typeof row.score === "number") {
        row.score -= 0.5;
      }
    }
  });
  assert.ok(hasError(result, "fidelity regressed for tooltip"));
});

test("tolerates fidelity jitter inside the declared tolerance", () => {
  const result = validate(({ fidelity }) => {
    for (const row of fidelity) {
      if (row.set === "tooltip" && typeof row.score === "number") {
        row.score -= 0.2;
      }
    }
  });
  assert.ok(!hasError(result, "fidelity regressed"));
});

test("rejects a shrunken fidelity denominator", () => {
  const result = validate(({ fidelity }) => {
    const index = fidelity.findIndex(
      (row) => row.set === "avatar" && typeof row.score === "number",
    );
    fidelity.splice(index, 1);
  });
  assert.ok(hasError(result, "fidelity denominator shrank for avatar"));
});

test("rejects a scored fidelity set with no committed floor", () => {
  const result = validate(({ fidelity }) => {
    fidelity.push({ set: "brand-new-set", variant: "v", score: 99 });
  });
  assert.ok(hasError(result, "fidelity set has no committed floor"));
});

test("rejects a missing fidelity ratchet declaration", () => {
  const result = validate(({ baseline }) => {
    delete baseline.metrics.fidelity;
  });
  assert.ok(hasError(result, "fidelity ratchet"));
});
