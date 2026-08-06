import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const readJson = (root, relativePath) =>
  JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));

const countBy = (values) => {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

const sameCounts = (actual, expected) => {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  return [...keys].every((key) => actual[key] === expected[key]);
};

const sameStrings = (actual, expected) =>
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

const parentPath = (value) =>
  value.includes("/") ? value.slice(0, value.lastIndexOf("/")) : "";
const leafPath = (value) => value.split("/").pop() ?? value;
const stripDigitSuffix = (value) => value.replace(/\d+$/, "");
const relatedRestructurePaths = (left, right) => {
  if (left === right) return false;
  const ancestor =
    (left === "" && right !== "") ||
    (right === "" && left !== "") ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`);
  const leftLeaf = leafPath(left);
  const rightLeaf = leafPath(right);
  const relatedLeaf =
    leftLeaf === rightLeaf ||
    stripDigitSuffix(leftLeaf) === stripDigitSuffix(rightLeaf) ||
    leftLeaf.startsWith(rightLeaf) ||
    rightLeaf.startsWith(leftLeaf) ||
    leftLeaf.endsWith(rightLeaf) ||
    rightLeaf.endsWith(leftLeaf);
  return ancestor || (parentPath(left) === parentPath(right) && relatedLeaf);
};

const restructureRelationValid = (
  basis,
  lossFact,
  inventedFact,
  mappingIndex,
) => {
  const relation = String(basis).slice(0, String(basis).indexOf(":"));
  if (relation === "same-leaf") {
    return leafPath(lossFact.path) === leafPath(inventedFact.path);
  }
  if (relation === "same-parent") {
    return (
      parentPath(lossFact.path) === parentPath(inventedFact.path) &&
      relatedRestructurePaths(lossFact.path, inventedFact.path)
    );
  }
  if (relation === "ancestor") {
    return relatedRestructurePaths(lossFact.path, inventedFact.path);
  }
  if (relation === "mapped-path" || relation === "mapped-prefix") {
    let rewritten = inventedFact.path;
    const mappings = mappingIndex.get(inventedFact.variant) ?? new Map();
    for (let attempt = 0; attempt <= mappings.size; attempt++) {
      if (
        rewritten === lossFact.path ||
        (attempt > 0 && relatedRestructurePaths(rewritten, lossFact.path))
      ) {
        return true;
      }
      const segments = rewritten === "" ? [] : rewritten.split("/");
      let mapping;
      for (let count = segments.length; count >= 0; count--) {
        const candidate = mappings.get(segments.slice(0, count).join("/"));
        if (candidate?.baseLoss.basis !== basis) {
          mapping = candidate;
          break;
        }
      }
      if (!mapping) return false;
      const suffix =
        mapping.baseInvented.path === ""
          ? rewritten
          : rewritten === mapping.baseInvented.path
            ? ""
            : rewritten.slice(mapping.baseInvented.path.length + 1);
      rewritten = mapping.baseLoss.path
        ? suffix
          ? `${mapping.baseLoss.path}/${suffix}`
          : mapping.baseLoss.path
        : suffix;
    }
    return rewritten === lossFact.path;
  }
  return false;
};

const exactTupleHash = (tuples) =>
  createHash("sha256")
    .update(JSON.stringify([...tuples].sort()))
    .digest("hex");

const npmRunScriptName = (command) => {
  const normalized = command.trim().replace(/\s+/g, " ");
  for (const pattern of [
    /^npm run ([\w:-]+)(?: --silent| -s)?$/,
    /^npm run (?:--silent|-s) ([\w:-]+)$/,
    /^npm (?:--silent|-s) run ([\w:-]+)$/,
  ]) {
    const match = pattern.exec(normalized);
    if (match) return match[1];
  }
  return null;
};

const resolveEvidenceTerminal = (command, scripts, seen = new Set()) => {
  const name = npmRunScriptName(command);
  if (!name) return command.trim().replace(/\s+/g, " ");
  if (seen.has(name)) return `CYCLE:${[...seen, name].join("→")}`;
  const target = scripts?.[name];
  if (typeof target !== "string") return `MISSING:${name}`;
  return resolveEvidenceTerminal(target, scripts, new Set([...seen, name]));
};

const deriveSourceTupleEvidence = (dump) => {
  const key = Object.keys(dump).find(
    (name) => !["_provenance", "_degradations", "_variables"].includes(name),
  );
  const set = key ? dump[key] : undefined;
  if (!set || typeof set !== "object") return { status: "invalid" };
  if (
    !set.propertyDefinitions &&
    !(set.variants ?? []).some((row) => row.variantProperties)
  ) {
    return { status: "legacy" };
  }
  const axes = Object.entries(set.propertyDefinitions ?? {})
    .filter(([, definition]) => definition?.type === "VARIANT")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (axes.length === 0) return { status: "invalid" };
  const propertyNames = axes.map(([name]) => name);
  let expectedCount = 1;
  for (const [, definition] of axes) {
    if (
      !Array.isArray(definition.variantOptions) ||
      definition.variantOptions.length === 0 ||
      new Set(definition.variantOptions).size !==
        definition.variantOptions.length ||
      !definition.variantOptions.includes(definition.defaultValue)
    ) {
      return { status: "invalid" };
    }
    expectedCount *= definition.variantOptions.length;
  }
  const tuples = [];
  for (const row of set.variants ?? []) {
    const tuple = row.variantProperties;
    if (
      !tuple ||
      !sameStrings(Object.keys(tuple).sort(), propertyNames) ||
      propertyNames.some((name, index) => {
        const definition = axes[index][1];
        return !definition.variantOptions.includes(tuple[name]);
      })
    ) {
      return { status: "invalid" };
    }
    tuples.push(
      JSON.stringify(propertyNames.map((name) => [name, tuple[name]])),
    );
  }
  tuples.sort();
  if (new Set(tuples).size !== tuples.length) return { status: "invalid" };
  return {
    status: tuples.length === expectedCount ? "complete" : "ragged",
    propertyNames,
    expectedCount,
    tuples,
    tupleSetHash: exactTupleHash(tuples),
  };
};

const validateExactReceipt = (receipt, refusalCodes, where) => {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return [`${where}: exactProjection must be an object`];
  }
  if (receipt.status === "legacy-unverified") {
    if (receipt.reason !== "structured-exact-evidence-absent") {
      errors.push(`${where}: legacy-unverified receipt has an unknown reason`);
    }
    return errors;
  }
  if (
    receipt.status === "source-matrix-verified" ||
    receipt.status === "verified-exact"
  ) {
    if (
      !Array.isArray(receipt.propertyNames) ||
      receipt.propertyNames.length === 0 ||
      receipt.propertyNames.some((value) => typeof value !== "string") ||
      new Set(receipt.propertyNames).size !== receipt.propertyNames.length
    ) {
      errors.push(`${where}: verified receipt requires unique propertyNames`);
    }
    if (
      !Number.isInteger(receipt.expectedCount) ||
      !Number.isInteger(receipt.observedCount) ||
      !Array.isArray(receipt.tuples) ||
      receipt.tuples.some((tuple) => typeof tuple !== "string") ||
      receipt.expectedCount !== receipt.tuples.length ||
      receipt.observedCount !== receipt.tuples.length
    ) {
      errors.push(`${where}: verified receipt counts must equal its tuple set`);
    }
    if (
      Array.isArray(receipt.tuples) &&
      (new Set(receipt.tuples).size !== receipt.tuples.length ||
        receipt.tuples.some((tuple) => {
          try {
            const parsed = JSON.parse(tuple);
            return (
              !Array.isArray(parsed) ||
              parsed.length !== receipt.propertyNames?.length ||
              parsed.some(
                (pair, index) =>
                  !Array.isArray(pair) ||
                  pair.length !== 2 ||
                  pair[0] !== receipt.propertyNames[index] ||
                  typeof pair[1] !== "string",
              )
            );
          } catch {
            return true;
          }
        }))
    ) {
      errors.push(
        `${where}: verified receipt tuples are malformed or duplicated`,
      );
    }
    if (
      !/^[a-f0-9]{64}$/.test(String(receipt.tupleSetHash)) ||
      receipt.tupleSetHash !== exactTupleHash(receipt.tuples ?? [])
    ) {
      errors.push(`${where}: verified receipt tupleSetHash is invalid`);
    }
    if (
      Array.isArray(receipt.tuples) &&
      !sameStrings(receipt.tuples, [...receipt.tuples].sort())
    ) {
      errors.push(`${where}: verified receipt tuples must be canonical-sorted`);
    }
    return errors;
  }
  if (receipt.status === "refused") {
    if (
      !refusalCodes.includes(receipt.code) ||
      !Array.isArray(receipt.refusals) ||
      receipt.refusals.length === 0 ||
      receipt.refusals.some(
        (refusal) =>
          !refusal ||
          typeof refusal !== "object" ||
          !refusalCodes.includes(refusal.code) ||
          typeof refusal.message !== "string",
      )
    ) {
      errors.push(`${where}: refused receipt has malformed refusal evidence`);
    }
    return errors;
  }
  return [
    `${where}: unknown exactProjection status ${JSON.stringify(receipt.status)}`,
  ];
};

const allFacts = (results, kind) =>
  results.flatMap((result) =>
    Array.isArray(result[kind]) ? result[kind] : [],
  );

export function deriveRoundTripMetrics(report, grammar) {
  const diffed = report.results.filter((result) => result.status === "diffed");
  const diverged = allFacts(diffed, "diverged");
  const loss = allFacts(diffed, "loss");
  const invented = allFacts(diffed, "invented");
  const countEqualComponents = diffed.filter(
    (result) => result.originalVariants === result.roundTripVariants,
  ).length;
  const verifiedExactComponents = diffed.filter(
    (result) => result.exactProjection?.status === "verified-exact",
  ).length;
  const sourceMatrixVerifiedComponents = diffed.filter(
    (result) => result.exactProjection?.status === "source-matrix-verified",
  ).length;
  const legacyUnverifiedComponents = diffed.filter(
    (result) =>
      !result.exactProjection ||
      result.exactProjection.status === "legacy-unverified",
  ).length;
  const refusedExactComponents = diffed.filter(
    (result) => result.exactProjection?.status === "refused",
  ).length;
  const identityViolations =
    diverged.filter(
      (fact) =>
        fact.channel === "instanceOf" ||
        (fact.channel === "kind" &&
          /^instance\s*→\s*(?!instance(?:\s|$))/.test(String(fact.value))),
    ).length +
    loss.filter(
      (fact) =>
        fact.channel === "instanceOf" ||
        (fact.channel === "kind" && fact.value === "instance"),
    ).length;
  const textStyleIdentityLosses =
    loss.filter(
      (fact) =>
        fact.tag === "text-style-identity" || fact.channel === "text.style",
    ).length +
    diverged.filter((fact) => fact.channel === "text.style").length +
    invented.filter((fact) => fact.channel === "text.style").length;
  const unclassifiedSourceFacts = [...diverged, ...loss].filter(
    (fact) => !fact.tag,
  ).length;
  const unclassifiedInventedFacts = invented.filter((fact) => !fact.tag).length;
  const usedTags = [
    ...new Set(
      [...diverged, ...loss, ...invented]
        .map((fact) => fact.tag)
        .filter((tag) => typeof tag === "string"),
    ),
  ].sort();

  return {
    components: diffed.length,
    R1: {
      countEqualComponents,
      countMismatchedComponents: diffed.length - countEqualComponents,
      verifiedExactComponents,
      sourceMatrixVerifiedComponents,
      legacyUnverifiedComponents,
      refusedExactComponents,
    },
    R2: { identityViolations },
    R3: { textStyleIdentityLosses },
    R4: {
      evidenceCommands: grammar.evidenceCommands?.R4?.length ?? 0,
    },
    R5: {
      unclassifiedSourceFacts,
      originalFacts: diffed.reduce(
        (sum, result) => sum + (result.originalFacts ?? 0),
        0,
      ),
      conservationViolations: diffed.filter(
        (result) =>
          result.originalFacts !==
          (result.matched ?? 0) +
            (result.diverged?.length ?? 0) +
            (result.loss?.length ?? 0),
      ).length,
      returnConservationViolations: diffed.filter(
        (result) =>
          result.roundTripFacts !==
          (result.matched ?? 0) +
            (result.diverged?.length ?? 0) +
            (result.invented?.length ?? 0),
      ).length,
    },
    R6: { unclassifiedInventedFacts },
    usedTags,
  };
}

export function validateAccuracyContract({
  grammar,
  baseline,
  report,
  cssDom,
  canvas,
  closure,
  packageJson,
  sourceDumps = {},
}) {
  const errors = [];
  const metrics = deriveRoundTripMetrics(report, grammar);
  const results = report.results ?? [];
  const diffedResults = results.filter((result) => result.status === "diffed");

  if (grammar.version !== 1)
    errors.push("accuracy/grammar.json: version must be 1");
  if (baseline.version !== 1)
    errors.push("accuracy/baseline.json: version must be 1");

  const invariantIds = (grammar.roundTripInvariants ?? []).map(
    (invariant) => invariant.id,
  );
  if (
    invariantIds.length !== 6 ||
    new Set(invariantIds).size !== 6 ||
    ["R1", "R2", "R3", "R4", "R5", "R6"].some(
      (id) => !invariantIds.includes(id),
    )
  ) {
    errors.push(
      "accuracy/grammar.json: roundTripInvariants must contain R1 through R6 exactly once",
    );
  }

  const sources = new Map(
    (grammar.independentDenominators ?? []).map((source) => [
      source.id,
      source,
    ]),
  );
  const cssSource = sources.get("css-dom");
  const canvasSource = sources.get("canvas");
  const closureSource = sources.get("draw-read-closure");
  if (!cssSource || !canvasSource || !closureSource) {
    errors.push(
      "accuracy/grammar.json: css-dom, canvas, and draw-read-closure denominators are required",
    );
  } else {
    const cssCounts = countBy(cssDom.cases.map((entry) => entry.expect));
    if (
      cssDom.cases.length !== cssSource.count ||
      !sameCounts(cssCounts, cssSource.expectations)
    ) {
      errors.push(
        `css-dom denominator drift: expected ${cssSource.count} ${JSON.stringify(cssSource.expectations)}, got ${cssDom.cases.length} ${JSON.stringify(cssCounts)}`,
      );
    }

    const canvasCounts = countBy(canvas.cases.map((entry) => entry.expect));
    if (
      canvas.cases.length !== canvasSource.count ||
      !sameCounts(canvasCounts, canvasSource.expectations)
    ) {
      errors.push(
        `canvas denominator drift: expected ${canvasSource.count} ${JSON.stringify(canvasSource.expectations)}, got ${canvas.cases.length} ${JSON.stringify(canvasCounts)}`,
      );
    }

    if (
      closure.summary?.total !== closureSource.count ||
      closure.summary?.silent !== closureSource.requiredSilent
    ) {
      errors.push(
        `draw-read closure drift: expected total=${closureSource.count} silent=${closureSource.requiredSilent}, got total=${closure.summary?.total} silent=${closure.summary?.silent}`,
      );
    }
  }

  const declaredTags = Object.keys(grammar.normalizationRules ?? {}).sort();
  const predicateTags = Object.keys(grammar.factRulePredicates ?? {}).sort();
  if (!sameStrings(declaredTags, predicateTags)) {
    errors.push(
      "accuracy grammar fact descriptions and executable predicates must name the same classes",
    );
  }
  const unknownTags = metrics.usedTags.filter(
    (tag) => !declaredTags.includes(tag),
  );
  const staleTags = declaredTags.filter(
    (tag) => !metrics.usedTags.includes(tag),
  );
  if (unknownTags.length > 0) {
    errors.push(
      `round-trip report uses undeclared normalization tag(s): ${unknownTags.join(", ")}`,
    );
  }
  if (staleTags.length > 0) {
    errors.push(
      `accuracy grammar declares unused normalization tag(s): ${staleTags.join(", ")}`,
    );
  }
  for (const result of diffedResults) {
    const factsByKind = [
      ["diverged", result.diverged ?? []],
      ["loss", result.loss ?? []],
      ["invented", result.invented ?? []],
    ];
    const groupRestructuredByBasis = (facts) => {
      const grouped = new Map();
      for (const fact of facts) {
        if (fact.tag !== "restructured" || typeof fact.basis !== "string") {
          continue;
        }
        const rows = grouped.get(fact.basis) ?? [];
        rows.push(fact);
        grouped.set(fact.basis, rows);
      }
      return grouped;
    };
    const restructuredLossByBasis = groupRestructuredByBasis(result.loss ?? []);
    const restructuredInventedByBasis = groupRestructuredByBasis(
      result.invented ?? [],
    );
    const allRestructureBases = new Set([
      ...restructuredLossByBasis.keys(),
      ...restructuredInventedByBasis.keys(),
    ]);
    for (const basis of allRestructureBases) {
      const lossCount = restructuredLossByBasis.get(basis)?.length ?? 0;
      const inventedCount = restructuredInventedByBasis.get(basis)?.length ?? 0;
      if (lossCount !== 1 || inventedCount !== 1) {
        errors.push(
          `${result.contractId}: restructured basis ${basis} must pair exactly one loss with one invention (got ${lossCount}:${inventedCount})`,
        );
      }
    }
    const restructurePairs = [...allRestructureBases]
      .filter(
        (basis) =>
          restructuredLossByBasis.get(basis)?.length === 1 &&
          restructuredInventedByBasis.get(basis)?.length === 1,
      )
      .map((basis) => ({
        baseLoss: restructuredLossByBasis.get(basis)[0],
        baseInvented: restructuredInventedByBasis.get(basis)[0],
      }));
    const restructureMappingIndex = new Map();
    for (const pair of restructurePairs) {
      const byPath =
        restructureMappingIndex.get(pair.baseInvented.variant) ?? new Map();
      if (!byPath.has(pair.baseInvented.path)) {
        byPath.set(pair.baseInvented.path, pair);
      }
      restructureMappingIndex.set(pair.baseInvented.variant, byPath);
    }
    const extraVariants = new Set(
      (result.invented ?? [])
        .filter(
          (fact) =>
            fact.channel === "variant" &&
            fact.value === "extra variant in round trip",
        )
        .map((fact) => fact.variant),
    );
    for (const [kind, facts] of factsByKind) {
      for (const fact of facts) {
        if (!fact.tag) continue;
        const rule = grammar.factRulePredicates?.[fact.tag];
        if (!rule) continue;
        const channelAllowed =
          !rule.channels ||
          rule.channels.includes(fact.channel) ||
          (rule.channelPrefixes ?? []).some((prefix) =>
            fact.channel.startsWith(prefix),
          );
        const pairedBasisValid =
          !rule.requiresPairedBasis ||
          (() => {
            if (typeof fact.basis !== "string") return false;
            const opposites =
              kind === "loss"
                ? restructuredInventedByBasis.get(fact.basis)
                : restructuredLossByBasis.get(fact.basis);
            if (opposites?.length !== 1) return false;
            const opposite = opposites[0];
            if (
              opposite?.tag !== fact.tag ||
              opposite?.basis !== fact.basis ||
              opposite?.variant !== fact.variant ||
              opposite?.channel !== fact.channel ||
              opposite?.value !== fact.value
            ) {
              return false;
            }
            const lossFact = kind === "loss" ? fact : opposite;
            const inventedFact = kind === "invented" ? fact : opposite;
            return restructureRelationValid(
              fact.basis,
              lossFact,
              inventedFact,
              restructureMappingIndex,
            );
          })();
        const wrapperBasis = String(fact.basis ?? "");
        const descendantBasis = wrapperBasis.startsWith("ancestor-of:")
          ? wrapperBasis.slice("ancestor-of:".length)
          : "";
        const restructuredDescendantValid =
          !rule.requiresRestructuredDescendant ||
          (descendantBasis.length > 0 &&
            (() => {
              const candidates =
                restructuredInventedByBasis.get(descendantBasis);
              if (candidates?.length !== 1) return false;
              const candidate = candidates[0];
              return (
                candidate?.variant === fact.variant &&
                (candidate.path === fact.path ||
                  candidate.path.startsWith(
                    fact.path === "" ? "" : `${fact.path}/`,
                  ))
              );
            })());
        const valid =
          (rule.appliesTo ?? []).includes(kind) &&
          channelAllowed &&
          pairedBasisValid &&
          restructuredDescendantValid &&
          (!rule.valuePattern ||
            new RegExp(rule.valuePattern).test(String(fact.value))) &&
          (!rule.pathPattern ||
            new RegExp(rule.pathPattern).test(String(fact.path))) &&
          (!rule.requiresStateVariant ||
            /(^|,\s*)State=/.test(String(fact.variant))) &&
          (!rule.requiresExtraVariant || extraVariants.has(fact.variant));
        if (!valid) {
          errors.push(
            `${result.contractId}: ${kind} fact ${fact.variant} ▸ ${fact.path || "(root)"} ▸ ${fact.channel} does not satisfy rule ${fact.tag}`,
          );
        }
      }
    }
  }

  const refusalCodes = grammar.variantRecoveryRefusals ?? [];
  if (
    refusalCodes.length === 0 ||
    refusalCodes.length !== new Set(refusalCodes).size
  ) {
    errors.push(
      "accuracy/grammar.json: variantRecoveryRefusals must be non-empty and unique",
    );
  }
  results.forEach((result, index) => {
    errors.push(
      ...validateExactReceipt(
        result.exactProjection,
        refusalCodes,
        `round-trip result ${result.contractId ?? index}`,
      ),
    );
    const sourceEvidence = deriveSourceTupleEvidence(
      sourceDumps[result.component] ?? {},
    );
    const receipt = result.exactProjection;
    if (
      sourceEvidence.status === "legacy" &&
      receipt?.status !== "legacy-unverified"
    ) {
      errors.push(
        `${result.contractId ?? index}: exact receipt is not bound to the legacy source dump`,
      );
    } else if (
      (sourceEvidence.status === "invalid" ||
        sourceEvidence.status === "ragged") &&
      receipt?.status !== "refused"
    ) {
      errors.push(
        `${result.contractId ?? index}: non-exact source evidence requires a refusal receipt`,
      );
    } else if (sourceEvidence.status === "complete") {
      if (
        !["source-matrix-verified", "verified-exact"].includes(
          receipt?.status,
        ) ||
        !sameStrings(
          receipt.propertyNames ?? [],
          sourceEvidence.propertyNames,
        ) ||
        receipt.expectedCount !== sourceEvidence.expectedCount ||
        receipt.observedCount !== sourceEvidence.tuples.length ||
        receipt.tupleSetHash !== sourceEvidence.tupleSetHash
      ) {
        errors.push(
          `${result.contractId ?? index}: exact receipt does not match independently derived source tuples`,
        );
      }
      if (
        receipt?.status === "verified-exact" &&
        (receipt.expectedCount !== result.originalVariants ||
          receipt.expectedCount !== result.roundTripVariants)
      ) {
        errors.push(
          `${result.contractId ?? index}: returned projection count is not bound to exact receipt evidence`,
        );
      }
    }
  });

  const expectedComponentIds = [...(baseline.componentIds ?? [])].sort();
  const actualComponentIds = results
    .map((result) => result.contractId)
    .filter((id) => typeof id === "string")
    .sort();
  if (
    expectedComponentIds.length !== baseline.components ||
    new Set(expectedComponentIds).size !== expectedComponentIds.length
  ) {
    errors.push(
      "accuracy/baseline.json: componentIds must uniquely name the complete denominator",
    );
  }
  if (!sameStrings(actualComponentIds, expectedComponentIds)) {
    errors.push(
      `round-trip component identity drift: expected ${expectedComponentIds.join(", ")}, got ${actualComponentIds.join(", ")}`,
    );
  }
  if (results.some((result) => result.status !== "diffed")) {
    errors.push(
      "round-trip report contains a component that did not reach the fact diff",
    );
  }

  const computedTotals = {
    components: results.length,
    roundTripClosed: diffedResults.length,
    matched: diffedResults.reduce(
      (sum, result) => sum + (result.matched ?? 0),
      0,
    ),
    diverged: diffedResults.reduce(
      (sum, result) => sum + (result.diverged?.length ?? 0),
      0,
    ),
    loss: diffedResults.reduce(
      (sum, result) => sum + (result.loss?.length ?? 0),
      0,
    ),
    invented: diffedResults.reduce(
      (sum, result) => sum + (result.invented?.length ?? 0),
      0,
    ),
    originalFacts: diffedResults.reduce(
      (sum, result) => sum + (result.originalFacts ?? 0),
      0,
    ),
    roundTripFacts: diffedResults.reduce(
      (sum, result) => sum + (result.roundTripFacts ?? 0),
      0,
    ),
    exactVerified: metrics.R1.verifiedExactComponents,
    exactSourceMatrixVerified: metrics.R1.sourceMatrixVerifiedComponents,
    exactLegacyUnverified: metrics.R1.legacyUnverifiedComponents,
    exactRefused: metrics.R1.refusedExactComponents,
  };
  for (const [key, value] of Object.entries(computedTotals)) {
    if (report.totals?.[key] !== value) {
      errors.push(
        `round-trip totals drift at ${key}: report ${report.totals?.[key]}, computed ${value}`,
      );
    }
  }

  const evidenceCommands = grammar.evidenceCommands?.R4 ?? [];
  if (
    new Set(evidenceCommands).size !== evidenceCommands.length ||
    !sameStrings(
      [...evidenceCommands].sort(),
      [...(baseline.metrics.R4.commands ?? [])].sort(),
    )
  ) {
    errors.push(
      "R4 evidence commands must be unique and match the committed command set",
    );
  }
  for (const command of evidenceCommands) {
    const name = npmRunScriptName(command);
    if (!name || !packageJson.scripts?.[name]) {
      errors.push(`R4 evidence command is not a package script: ${command}`);
    }
  }
  const evidenceTerminals = evidenceCommands.map((command) =>
    resolveEvidenceTerminal(command, packageJson.scripts),
  );
  if (new Set(evidenceTerminals).size !== evidenceTerminals.length) {
    errors.push(
      `R4 evidence commands do not resolve to independent terminal checks: ${evidenceTerminals.join(" | ")}`,
    );
  }

  if (metrics.components !== baseline.components) {
    errors.push(
      `round-trip component denominator changed: baseline ${baseline.components}, current ${metrics.components}`,
    );
  }
  if (
    baseline.metrics.R1.countEqualComponents +
      baseline.metrics.R1.countMismatchedComponents !==
    baseline.components
  ) {
    errors.push(
      "accuracy/baseline.json: R1 count-equal + count-mismatched must equal components",
    );
  }
  if (
    metrics.R1.verifiedExactComponents +
      metrics.R1.sourceMatrixVerifiedComponents +
      metrics.R1.legacyUnverifiedComponents +
      metrics.R1.refusedExactComponents !==
    metrics.components
  ) {
    errors.push(
      "R1 exact-projection statuses must account for every diffed component",
    );
  }
  if (
    metrics.R1.verifiedExactComponents <
    baseline.metrics.R1.verifiedExactComponents
  ) {
    errors.push(
      `R1 verified exact components regressed: ${metrics.R1.verifiedExactComponents} below baseline ${baseline.metrics.R1.verifiedExactComponents}`,
    );
  }

  const ratchets = [
    [
      "R1 mismatched components",
      metrics.R1.countMismatchedComponents,
      baseline.metrics.R1.maxCountMismatchedComponents,
    ],
    [
      "R2 identity violations",
      metrics.R2.identityViolations,
      baseline.metrics.R2.maxIdentityViolations,
    ],
    [
      "R3 text-style identity losses",
      metrics.R3.textStyleIdentityLosses,
      baseline.metrics.R3.maxTextStyleIdentityLosses,
    ],
    [
      "R5 unclassified source facts",
      metrics.R5.unclassifiedSourceFacts,
      baseline.metrics.R5.maxUnclassifiedSourceFacts,
    ],
    [
      "R5 conservation violations",
      metrics.R5.conservationViolations,
      baseline.metrics.R5.maxConservationViolations,
    ],
    [
      "R5 return conservation violations",
      metrics.R5.returnConservationViolations,
      baseline.metrics.R5.maxReturnConservationViolations,
    ],
    [
      "R6 unclassified invented facts",
      metrics.R6.unclassifiedInventedFacts,
      baseline.metrics.R6.maxUnclassifiedInventedFacts,
    ],
  ];
  for (const [name, actual, maximum] of ratchets) {
    if (!Number.isInteger(maximum) || actual > maximum) {
      errors.push(
        `${name} regressed: ${actual} exceeds baseline maximum ${maximum}`,
      );
    }
  }
  if (
    metrics.R4.evidenceCommands < baseline.metrics.R4.requiredEvidenceCommands
  ) {
    errors.push(
      `R4 evidence regressed: ${metrics.R4.evidenceCommands} command(s), requires ${baseline.metrics.R4.requiredEvidenceCommands}`,
    );
  }
  if (metrics.R5.originalFacts < baseline.metrics.R5.minOriginalFacts) {
    errors.push(
      `R5 source denominator regressed: ${metrics.R5.originalFacts} below baseline minimum ${baseline.metrics.R5.minOriginalFacts}`,
    );
  }

  return { errors, metrics };
}

export function loadAccuracyInputs(root = ROOT) {
  const report = readJson(root, "extract/figma/roundtrip-uui/report.json");
  const sourceDumps = Object.fromEntries(
    report.results.map((result) => [
      result.component,
      readJson(
        root,
        `examples/untitled-ui/dumps-v2/${result.component}.dump.json`,
      ),
    ]),
  );
  return {
    grammar: readJson(root, "accuracy/grammar.json"),
    baseline: readJson(root, "accuracy/baseline.json"),
    report,
    cssDom: readJson(root, "conformance/MANIFEST.json"),
    canvas: readJson(root, "extract/figma/conformance/MANIFEST.json"),
    closure: readJson(root, "extract/figma/channel-closure.json"),
    packageJson: readJson(root, "package.json"),
    sourceDumps,
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = validateAccuracyContract(loadAccuracyInputs());
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { metrics } = result;
    console.log(
      `accuracy contract: ${metrics.components} component(s) · ` +
        `R1 count parity ${metrics.R1.countEqualComponents}/${metrics.components}, verified exact ${metrics.R1.verifiedExactComponents}/${metrics.components} · ` +
        `R2 ${metrics.R2.identityViolations} identity violation(s) · ` +
        `R3 ${metrics.R3.textStyleIdentityLosses} text-style loss(es) · ` +
        `R5 ${metrics.R5.unclassifiedSourceFacts} unclassified source fact(s) · ` +
        `R6 ${metrics.R6.unclassifiedInventedFacts} unclassified invention(s)`,
    );
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`✘ ${error}`);
    process.exit(1);
  }
  console.log("✔ accuracy contract and ratchets hold");
}
