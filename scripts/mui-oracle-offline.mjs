/**
 * Wave 2 — offline MUI oracle.
 *
 * Scores the frozen corpus against independent disposition sidecars using
 * local artifacts only (contracts, extensions, figma scripts, capture outs,
 * compile receipt). Does not shrink accuracy denominators. Prefer PENDING
 * with a named reason over invented green; fail-closed on negative-control
 * and pending-seed silent promotion.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORACLE = path.join(ROOT, "examples", "mui", "oracle");
const MUI = path.join(ROOT, "examples", "mui");
const CONTRACTS = path.join(MUI, "contracts");
const FIGMA = path.join(MUI, "figma");
const CAPTURE_OUT = path.join(ROOT, "extract", "computed", "out", "mui");
const COMPILE_RECEIPT = path.join(MUI, "receipts", "figma", "COMPILE-RECEIPT.md");
const CAPTURE_CONFIG = path.join(ROOT, "extract", "computed", "configs", "mui.json");
const REPORT_JSON = path.join(ORACLE, "report.json");
const REPORT_MD = path.join(ORACLE, "REPORT.md");

/** Map disposition expectName → receipt / prose fragments that prove it. */
const REFUSAL_ALIASES = {
  "portal-inert-child": ["portal-inert-children-dropped"],
  "sticky-header-excluded": ["stickyHeader", "sticky-header", "-stickyHeader$"],
  "portal-single-root-drops-in-stage": [
    "single-portaled-root",
    "row overflow MENU is captured CLOSED",
    "menu is captured CLOSED",
    "captured CLOSED",
  ],
  "full-bleed-scrim-stage-width": [
    "boundFullBleedScrimRoot",
    "CAPTURE STAGE",
    "D5 CAPTURE STAGE",
    "full-bleed scrim",
  ],
  "portal-states-empty": ["states: []", "portal-states-empty"],
  "autocomplete-listbox-closed-capture": [
    "listbox",
    "NOT captured",
    "captured CLOSED",
    "open listbox",
  ],
  "table-box-to-accessible-structure": [
    "table-geometry-excluded",
    "table-box",
    "lowered flex",
  ],
  "mui-speed-dial-outside-grammar": [],
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const safeRead = (filePath) =>
  existsSync(filePath) ? readFileSync(filePath, "utf8") : null;

const walkStrings = (value, out = []) => {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, out);
  }
  return out;
};

const hasDrawableAnatomy = (contract) => {
  const root = contract?.anatomy?.root;
  if (!root || typeof root !== "object") return false;
  const parts = root.parts && Object.keys(root.parts).length > 0;
  const tokens = root.tokens && Object.keys(root.tokens).length > 0;
  const content = root.content != null;
  const component = root.component != null;
  return Boolean(parts || tokens || content || component);
};

const collectComponentRefs = (node, out = []) => {
  if (!node || typeof node !== "object") return out;
  if (node.component) out.push(node.component);
  if (node.parts) {
    for (const part of Object.values(node.parts)) collectComponentRefs(part, out);
  }
  return out;
};

const getPath = (value, dottedPath) => {
  let cursor = value;
  for (const segment of dottedPath.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) return null;
    cursor = cursor[segment];
  }
  return cursor;
};

const expandTokenRef = (ref, contract) => {
  if (typeof ref !== "string" || !ref.startsWith("{") || !ref.endsWith("}")) {
    return [];
  }
  let paths = [ref.slice(1, -1)];
  const axes = new Map(
    (contract?.props ?? [])
      .filter((prop) => Array.isArray(prop.type?.enum))
      .map((prop) => [prop.name, prop.type.enum]),
  );
  for (const placeholder of paths[0].matchAll(/\{([^{}]+)\}/g)) {
    const values = axes.get(placeholder[1]);
    if (!values?.length) return [];
    paths = paths.flatMap((candidate) =>
      values.map((value) => candidate.replace(placeholder[0], value)),
    );
  }
  return paths;
};

const findCheckedTranslateBinding = (contract, mintedTokens) => {
  const visit = (node, nodePath, eligiblePart) => {
    if (!node || typeof node !== "object") return null;
    for (const [index, binding] of (node.tokensByProp ?? []).entries()) {
      if (eligiblePart && binding?.prop === "checked" && binding.map?.checked) {
        for (const property of ["translate-x", "translate"]) {
          const ref = binding.map.checked[property];
          if (!ref) continue;
          const checkedPath = `${nodePath}.tokensByProp[${index}].map.checked.${property}`;
          const mapRefs = Object.values(binding.map)
            .map((entry) => entry?.[property])
            .filter(Boolean);
          const expandedRefs = mapRefs.flatMap((candidate) =>
            expandTokenRef(candidate, contract),
          );
          if (
            expandedRefs.length > 0 &&
            expandedRefs.every((tokenPath) => getPath(mintedTokens, tokenPath)?.$value != null)
          ) {
            return { bindingPath: checkedPath, refs: expandedRefs };
          }
        }
      }
    }
    for (const [partName, part] of Object.entries(node.parts ?? {})) {
      const result = visit(
        part,
        `${nodePath}.parts.${partName}`,
        /thumb|buttonbase/i.test(partName),
      );
      if (result) return result;
    }
    return null;
  };
  return visit(contract?.anatomy?.root, "anatomy.root", false);
};

const parseCompileReceipt = (text) => {
  const rows = new Map();
  if (!text) return rows;
  for (const line of text.split("\n")) {
    const match = /^\|\s*([a-z0-9-]+)\.figma\.js\s*\|\s*(mui\.[a-z0-9.-]+)\s*\|/i.exec(
      line,
    );
    if (match) rows.set(match[1], { script: match[1], contractId: match[2] });
  }
  return rows;
};

const flattenNamedReceipts = (extension) => {
  if (!extension) return [];
  const bags = [
    extension.structureReceipts,
    extension.frontierReceipts,
    extension.enrichmentNotes,
    extension.anatomyPromotion?.receipts,
    extension.anatomyPromotion?.refusals,
    extension.readBoundaryReceipts,
    extension.namedResiduals,
  ];
  const out = [];
  for (const bag of bags) {
    if (Array.isArray(bag)) {
      for (const line of bag) {
        if (typeof line === "string") out.push(line);
      }
    }
  }
  // Geometry / exclusion lines often live as object-keyed string maps.
  for (const [key, value] of Object.entries(extension)) {
    if (key.endsWith("Receipts") || key.endsWith("Notes") || key === "classAllow") {
      walkStrings(value, out);
    }
  }
  return [...new Set(out)];
};

const findAliasHit = (expectName, haystacks) => {
  const aliases = REFUSAL_ALIASES[expectName] ?? [expectName];
  if (aliases.length === 0) return null;
  const joined = haystacks.filter(Boolean).join("\n");
  for (const alias of aliases) {
    if (alias && joined.includes(alias)) return alias;
  }
  return null;
};

/**
 * Collect local evidence for one corpus member. Cheap only — no headless
 * compile re-run; exact projection only when a dump file is present.
 */
export function collectEvidence(stem, root = ROOT) {
  const contractsDir = path.join(root, "examples", "mui", "contracts");
  const figmaDir = path.join(root, "examples", "mui", "figma");
  const captureDir = path.join(root, "extract", "computed", "out", "mui", stem);
  const contractPath = path.join(contractsDir, `${stem}.contract.json`);
  const extensionPath = path.join(contractsDir, `${stem}.extension.json`);
  const figmaPath = path.join(figmaDir, `${stem}.figma.js`);
  const dumpCandidates = [
    path.join(figmaDir, `${stem}.dump.json`),
    path.join(root, "examples", "mui", "dumps", `${stem}.dump.json`),
    path.join(captureDir, "figma.dump.json"),
  ];
  const dumpPath = dumpCandidates.find((p) => existsSync(p)) ?? null;

  const contract = existsSync(contractPath) ? readJson(contractPath) : null;
  const mintedPath = path.join(root, "examples", "mui", "tokens", "mui-minted.dtcg.json");
  const mintedTokens = existsSync(mintedPath) ? readJson(mintedPath) : null;
  const extension = existsSync(extensionPath) ? readJson(extensionPath) : null;
  const figmaSrc = safeRead(figmaPath);
  const compileRows = parseCompileReceipt(
    safeRead(path.join(root, "examples", "mui", "receipts", "figma", "COMPILE-RECEIPT.md")),
  );
  const captureConfig = existsSync(
    path.join(root, "extract", "computed", "configs", "mui.json"),
  )
    ? readJson(path.join(root, "extract", "computed", "configs", "mui.json"))
    : null;

  const variantAxes = (contract?.props ?? []).filter(
    (p) => p.bindings?.figma?.kind === "VARIANT" && p.type?.enum,
  );
  const namedReceipts = flattenNamedReceipts(extension);
  const description = String(contract?.description ?? "");
  const componentRefs = contract ? collectComponentRefs(contract.anatomy?.root) : [];

  return {
    stem,
    contractPath,
    contractExists: Boolean(contract),
    contract,
    mintedPath,
    mintedTokens,
    extensionPath,
    extensionExists: Boolean(extension),
    extension,
    figmaPath,
    figmaExists: Boolean(figmaSrc),
    figmaSrc,
    captureOutExists: existsSync(captureDir),
    captureDir,
    dumpPath,
    dumpExists: Boolean(dumpPath),
    compileReceipt: compileRows.get(stem) ?? null,
    genesisPresent: existsSync(path.join(figmaDir, "GENESIS-BATCH.figma.js")),
    captureConfig,
    namedReceipts,
    description,
    variantAxisCount: variantAxes.length,
    variantAxes: variantAxes.map((p) => p.name),
    hasDrawableAnatomy: hasDrawableAnatomy(contract),
    states: Array.isArray(contract?.states) ? contract.states : null,
    statesEmpty: Array.isArray(contract?.states) && contract.states.length === 0,
    componentRefs,
    promoted: Boolean(contract || figmaSrc),
    classAllow: captureConfig?.defaults?.classAllow ?? captureConfig?.classAllow ?? "",
  };
}

const scoreUnsupportedControl = (fact, evidence, component) => {
  const status = component.status;
  if (evidence.promoted) {
    return {
      result: "FAIL",
      observed: "PROMOTED",
      reason: `silent-success: ${status} member has contract and/or figma artifacts but expect UNSUPPORTED (${fact.expectName ?? "unnamed"})`,
      fatal: true,
    };
  }
  return {
    result: "MATCH",
    observed: "UNSUPPORTED",
    reason:
      status === "pending-seed"
        ? "pending-seed remains unpromoted (blocked; absence is not a green pass)"
        : "negative-control remains unpromoted (fail-closed)",
    fatal: false,
  };
};

const scoreRefusedOrLedgered = (fact, evidence) => {
  const haystacks = [
    ...evidence.namedReceipts,
    evidence.description,
    evidence.classAllow,
    evidence.figmaSrc?.slice(0, 20_000) ?? "",
    safeRead(COMPILE_RECEIPT) ?? "",
  ];

  // Dialog full-bleed: emission must not bake fixedWidth 900 on roots.
  if (fact.expectName === "full-bleed-scrim-stage-width" && evidence.figmaSrc) {
    const bakedStage = /"fixedWidth"\s*:\s*\{\s*"px"\s*:\s*900/.test(
      evidence.figmaSrc,
    );
    const rootHugs = evidence.figmaSrc.includes('"blockRoot": true');
    if (bakedStage) {
      return {
        result: "FAIL",
        observed: "CARRIED",
        reason:
          "silent-success: dialog figma still bakes fixedWidth 900 (capture stage) against REFUSED full-bleed-scrim-stage-width",
        fatal: true,
      };
    }
    if (rootHugs || findAliasHit(fact.expectName, haystacks)) {
      return {
        result: "MATCH",
        observed: "REFUSED",
        reason: "figma emission omits capture-stage 900px root width (boundFullBleedScrimRoot / blockRoot)",
        fatal: false,
      };
    }
  }

  if (fact.expectName === "sticky-header-excluded") {
    const stickyAxis = (evidence.contract?.props ?? []).some(
      (p) => /sticky/i.test(p.name),
    );
    if (stickyAxis) {
      return {
        result: "FAIL",
        observed: "CARRIED",
        reason: "silent-success: stickyHeader appears as a contract prop/axis",
        fatal: true,
      };
    }
  }

  if (fact.expectName === "portal-inert-child" && evidence.contract) {
    const partNames = Object.keys(evidence.contract.anatomy?.root?.parts ?? {});
    const sentinelParts = partNames.filter((n) => /^part-\d+$/.test(n));
    if (sentinelParts.length > 0) {
      return {
        result: "FAIL",
        observed: "CARRIED",
        reason: `silent-success: focus-trap sentinel parts present (${sentinelParts.join(", ")})`,
        fatal: true,
      };
    }
  }

  if (fact.expect === "LEDGERED" && fact.expectName === "portal-states-empty") {
    if (evidence.statesEmpty) {
      return {
        result: "MATCH",
        observed: "LEDGERED",
        reason: "contract declares states: [] (portal capture boundary)",
        fatal: false,
      };
    }
  }

  const hit = findAliasHit(fact.expectName, haystacks);
  if (hit) {
    return {
      result: "MATCH",
      observed: fact.expect,
      reason: `named receipt/prose hit: ${hit}`,
      fatal: false,
    };
  }

  // Fail-closed: REFUSED without a named receipt is not green.
  if (fact.expect === "REFUSED") {
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: `missing-named-refusal-receipt:${fact.expectName ?? fact.channel}`,
      fatal: false,
    };
  }

  return {
    result: "PENDING",
    observed: "UNKNOWN",
    reason: `missing-ledger-receipt:${fact.expectName ?? fact.channel}`,
    fatal: false,
  };
};

const scoreLowered = (fact, evidence) => {
  const haystacks = [...evidence.namedReceipts, evidence.description];
  const hit = findAliasHit(fact.expectName, haystacks);
  if (hit) {
    return {
      result: "MATCH",
      observed: "LOWERED",
      reason: `named lowering receipt: ${hit}`,
      fatal: false,
    };
  }
  return {
    result: "PENDING",
    observed: "UNKNOWN",
    reason: `missing-lowering-receipt:${fact.expectName ?? fact.channel}`,
    fatal: false,
  };
};

const scoreCarried = (fact, evidence, component) => {
  // Future CARRIED rows on pending-seed must never read as success.
  if (component.status === "pending-seed") {
    return {
      result: "PENDING",
      observed: "UNSUPPORTED",
      reason: "awaiting-seed: CARRIED claim deferred until TextField is seeded",
      fatal: false,
    };
  }

  if (!component.inPilot) {
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: "not-in-pilot",
      fatal: false,
    };
  }

  if (!evidence.promoted && !evidence.captureOutExists) {
    return {
      result: "FAIL",
      observed: "MISSING",
      reason: "missing-required-evidence: in-pilot member lacks contract/figma/capture artifacts",
      fatal: true,
    };
  }

  if (fact.channel === "component") {
    if (evidence.contractExists && evidence.extensionExists && evidence.figmaExists) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: `structural: promoted contract + extension + figma${evidence.compileReceipt ? " + compile receipt" : ""}`,
        fatal: false,
      };
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason: "missing-required-evidence: component needs promoted contract + extension + figma",
      fatal: true,
    };
  }

  if (fact.channel === "anatomy.adornment") {
    const refs = evidence.componentRefs.filter(
      (ref) => ref?.id === "mui.input-adornment",
    );
    const contractIdentity = refs.length >= 2;
    const emittedContractIds =
      evidence.figmaSrc?.match(/"depContractId"\s*:\s*"mui\.input-adornment"/g)
        ?.length ?? 0;
    const emittedAnchorKeys =
      evidence.figmaSrc?.match(/"depAnchorKey"\s*:\s*"mui\.input-adornment"/g)
        ?.length ?? 0;
    if (contractIdentity && emittedContractIds >= 2 && emittedAnchorKeys >= 2) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason:
          "nested identity: two mui.input-adornment refs + emitted depContractId/depAnchorKey pairs",
        fatal: false,
      };
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason:
        `missing-required-evidence: adornments need two contract refs and two emitted identity pairs ` +
        `(refs=${refs.length}, depContractId=${emittedContractIds}, depAnchorKey=${emittedAnchorKeys})`,
      fatal: true,
    };
  }

  if (fact.channel === "text.style") {
    const anatomyText = JSON.stringify(evidence.contract?.anatomy ?? {});
    const hasLabel = /label/i.test(anatomyText);
    const hasHelperOrError = /helper|error/i.test(anatomyText);
    const styleSpecs =
      evidence.figmaSrc?.match(/"textStyle"\s*:\s*"[^"]+"/g)?.length ?? 0;
    const hasLabelStyle =
      evidence.figmaSrc?.includes('"textStyle": "MUI/Input Label/Regular"') ??
      false;
    const hasHelperErrorStyle =
      evidence.figmaSrc?.includes(
        '"textStyle": "MUI/Helper and Error/Regular"',
      ) ?? false;
    const failClosedRuntime =
      evidence.figmaSrc?.includes("text-style-identity-refused") ?? false;
    if (
      hasLabel &&
      hasHelperOrError &&
      hasLabelStyle &&
      hasHelperErrorStyle &&
      styleSpecs >= 2 &&
      failClosedRuntime
    ) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: `named text identity: label + helper/error anatomy, ${styleSpecs} emitted textStyle specs, fail-closed runtime`,
        fatal: false,
      };
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason:
        `missing-required-evidence: text.style needs label/helper anatomy + named label/helper styles + refusal runtime ` +
        `(label=${hasLabel}, helper/error=${hasHelperOrError}, labelStyle=${hasLabelStyle}, helperStyle=${hasHelperErrorStyle}, styles=${styleSpecs}, failClosed=${failClosedRuntime})`,
      fatal: true,
    };
  }

  if (fact.channel === "variant-space") {
    if (evidence.contractExists && evidence.variantAxisCount > 0 && evidence.figmaExists) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: `structural: ${evidence.variantAxisCount} VARIANT axis(es) + figma script${evidence.compileReceipt ? " + compile receipt" : ""}`,
        fatal: false,
      };
    }
    if (evidence.contractExists && evidence.figmaExists && evidence.variantAxisCount === 0) {
      // Standalone / no enum axes — still a carried identity if anatomy exists.
      if (evidence.hasDrawableAnatomy) {
        return {
          result: "MATCH",
          observed: "CARRIED",
          reason: "structural: standalone contract + drawable anatomy + figma (no VARIANT product)",
          fatal: false,
        };
      }
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason: "missing-required-evidence: variant-space needs VARIANT axes (or standalone anatomy) + figma",
      fatal: true,
    };
  }

  if (fact.channel === "anatomy" || fact.channel === "anatomy.root") {
    if (evidence.hasDrawableAnatomy) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: "structural: drawable anatomy present on contract root",
        fatal: false,
      };
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason: "missing-required-evidence: drawable anatomy absent",
      fatal: true,
    };
  }

  if (fact.channel === "anatomy.inlined-checkbox") {
    const anatomyText = JSON.stringify(evidence.contract?.anatomy ?? {});
    const hasCheckbox = /checkbox/i.test(anatomyText);
    const nestedCheckboxRef = evidence.componentRefs.some((ref) =>
      /checkbox/i.test(JSON.stringify(ref)),
    );
    if (hasCheckbox && !nestedCheckboxRef) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: "inlined checkbox anatomy without nested component identity",
        fatal: false,
      };
    }
    if (!hasCheckbox) {
      return {
        result: "FAIL",
        observed: "MISSING",
        reason: "missing-required-evidence: no inlined checkbox anatomy",
        fatal: true,
      };
    }
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: "checkbox-present-but-component-ref-shape-unclear",
      fatal: false,
    };
  }

  if (fact.channel === "states.disabled") {
    const states = evidence.states ?? [];
    const hasDisabled = states.some((s) => /disabled/i.test(String(s)));
    if (hasDisabled) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: "disabled listed in contract.states",
        fatal: false,
      };
    }
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: "disabled-state-not-listed-or-preview-only",
      fatal: false,
    };
  }

  if (fact.channel === "props.checked") {
    const checked = (evidence.contract?.props ?? []).find((p) => p.name === "checked");
    if (checked?.bindings?.figma?.kind === "VARIANT") {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: "checked is a VARIANT axis (not -state-checked name invention)",
        fatal: false,
      };
    }
    return {
      result: "FAIL",
      observed: "MISSING",
      reason: "missing-required-evidence: checked VARIANT axis absent",
      fatal: true,
    };
  }

  if (fact.channel === "prototype.change-to") {
    const hasHoverTrigger = /(?:["'](?:trigger|type)["']|(?:trigger|type))\s*:\s*["']ON_HOVER["']/.test(
      evidence.figmaSrc ?? "",
    );
    const hasChangeTo = /(?:["']navigation["']|navigation)\s*:\s*["']CHANGE_TO["']/.test(
      evidence.figmaSrc ?? "",
    );
    if (hasHoverTrigger && hasChangeTo) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: "figma-script:CHANGE_TO with ON_HOVER reaction wiring",
        fatal: false,
      };
    }
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: "figma-script:CHANGE_TO wiring absent",
      fatal: false,
    };
  }

  if (fact.channel === "layout.thumb-translate") {
    const proof = findCheckedTranslateBinding(
      evidence.contract,
      evidence.mintedTokens,
    );
    if (proof) {
      return {
        result: "MATCH",
        observed: "CARRIED",
        reason: `contract/mint binding path: ${proof.bindingPath} (${proof.refs.length} minted leaves)`,
        fatal: false,
      };
    }
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason:
        "missing contract/mint proof: checked thumb/buttonbase translate binding with minted leaves",
      fatal: false,
    };
  }

  // Default CARRIED: require contract + figma when pilot artifacts exist; else PENDING.
  if (evidence.contractExists && evidence.figmaExists) {
    return {
      result: "PENDING",
      observed: "PARTIAL",
      reason: `channel-not-yet-instrumented:${fact.channel}`,
      fatal: false,
    };
  }

  return {
    result: "FAIL",
    observed: "MISSING",
    reason: `missing-required-evidence:${fact.channel}`,
    fatal: true,
  };
};

export function scoreFact(fact, evidence, component) {
  if (fact.expect === "UNSUPPORTED") {
    if (
      component.status === "negative-control" ||
      component.status === "pending-seed" ||
      fact.expectName?.includes("pending-seed") ||
      fact.expectName?.includes("outside-grammar")
    ) {
      return scoreUnsupportedControl(fact, evidence, component);
    }
    // Generic UNSUPPORTED (reader never looked): MATCH only with named receipt.
    const hit = findAliasHit(fact.expectName, [
      ...evidence.namedReceipts,
      evidence.description,
    ]);
    if (hit) {
      return {
        result: "MATCH",
        observed: "UNSUPPORTED",
        reason: `named unsupported receipt: ${hit}`,
        fatal: false,
      };
    }
    if (evidence.promoted && fact.channel === "component") {
      return {
        result: "FAIL",
        observed: "PROMOTED",
        reason: "silent-success against UNSUPPORTED component expectation",
        fatal: true,
      };
    }
    return {
      result: "PENDING",
      observed: "UNKNOWN",
      reason: `unsupported-unproven:${fact.expectName ?? fact.channel}`,
      fatal: false,
    };
  }

  if (fact.expect === "REFUSED" || fact.expect === "LEDGERED") {
    return scoreRefusedOrLedgered(fact, evidence);
  }
  if (fact.expect === "LOWERED") {
    return scoreLowered(fact, evidence);
  }
  if (fact.expect === "CARRIED") {
    return scoreCarried(fact, evidence, component);
  }
  return {
    result: "FAIL",
    observed: "UNKNOWN",
    reason: `illegal-expect:${fact.expect}`,
    fatal: true,
  };
}

export function runCorpusGate(root = ROOT) {
  const script = path.join(root, "scripts", "mui-oracle-corpus-check.mjs");
  try {
    execFileSync(process.execPath, [script], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { ok: true, output: "" };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`,
    };
  }
}

export function scoreCorpus(root = ROOT) {
  const gate = runCorpusGate(root);
  if (!gate.ok) {
    return {
      ok: false,
      fatal: true,
      errors: [`corpus-check-failed: ${gate.output.trim()}`],
      components: [],
      summary: { match: 0, pending: 0, fail: 0, facts: 0 },
    };
  }

  const corpus = readJson(path.join(root, "examples", "mui", "oracle", "corpus.json"));
  const components = [];
  const errors = [];
  let match = 0;
  let pending = 0;
  let fail = 0;
  let facts = 0;

  for (const component of corpus.components) {
    const dispPath = path.join(
      root,
      "examples",
      "mui",
      "oracle",
      "dispositions",
      `${component.stem}.json`,
    );
    const disposition = readJson(dispPath);
    const evidence = collectEvidence(component.stem, root);
    const factScores = [];

    for (const fact of disposition.facts ?? []) {
      facts += 1;
      const scored = scoreFact(fact, evidence, component);
      factScores.push({
        channel: fact.channel,
        expect: fact.expect,
        expectName: fact.expectName ?? null,
        ...scored,
      });
      if (scored.result === "MATCH") match += 1;
      else if (scored.result === "PENDING") pending += 1;
      else {
        fail += 1;
        if (scored.fatal) {
          errors.push(`${component.stem}/${fact.channel}: ${scored.reason}`);
        }
      }
    }

    components.push({
      id: component.id,
      stem: component.stem,
      status: component.status ?? (component.inPilot ? "in-pilot" : "out-of-pilot"),
      inPilot: Boolean(component.inPilot),
      evidence: {
        contract: evidence.contractExists,
        extension: evidence.extensionExists,
        figma: evidence.figmaExists,
        captureOut: evidence.captureOutExists,
        compileReceipt: Boolean(evidence.compileReceipt),
        dump: evidence.dumpExists,
        promoted: evidence.promoted,
        variantAxisCount: evidence.variantAxisCount,
        namedReceiptCount: evidence.namedReceipts.length,
      },
      facts: factScores,
    });
  }

  const ok = errors.length === 0 && fail === 0;
  return {
    ok,
    fatal: !ok,
    version: 1,
    runId: corpus.runId,
    library: corpus.library,
    scoredAt: new Date().toISOString(),
    accuracyDenominatorsUntouched: true,
    summary: { match, pending, fail, facts },
    errors,
    components,
    limits: [
      "No MUI Figma dumps in-tree — exact projection remains unscored.",
      "Prototype CHANGE_TO uses committed figma-script emission evidence; Switch checked translation uses promoted contract bindings plus minted leaves.",
      "Compile/genesis not re-executed; COMPILE-RECEIPT.md row presence is the cheap compile signal.",
      "CARRIED claims are structural (contract/figma/extension) unless a named receipt proves LOWERED/REFUSED/LEDGERED.",
      "Seeded TextField is scored from promoted contract/emission identity only; negative-control SpeedDial fails closed on any promotion.",
    ],
  };
}

export function renderReportMarkdown(report) {
  const lines = [
    "# MUI oracle — offline report",
    "",
    `Run: \`${report.runId}\` · scored ${report.scoredAt}`,
    "",
    `Summary: **${report.summary.match}** MATCH · **${report.summary.pending}** PENDING · **${report.summary.fail}** FAIL / ${report.summary.facts} facts`,
    "",
    report.ok
      ? "Verdict: **PASS** (no silent success against UNSUPPORTED/REFUSED; no missing required CARRIED evidence)."
      : "Verdict: **FAIL** — see errors below.",
    "",
    "Accuracy denominators: untouched (`accuracy/baseline.json` / grammar counts not modified).",
    "",
    "## Limits (honest v1)",
    "",
    ...(report.limits ?? []).map((l) => `- ${l}`),
    "",
  ];

  if (report.errors?.length) {
    lines.push("## Fatal errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push("");
  }

  lines.push("## Components", "");
  for (const component of report.components) {
    const ev = component.evidence;
    lines.push(
      `### ${component.stem} (\`${component.id}\`, ${component.status})`,
      "",
      `Evidence: contract=${ev.contract} extension=${ev.extension} figma=${ev.figma} captureOut=${ev.captureOut} compileReceipt=${ev.compileReceipt} dump=${ev.dump} promoted=${ev.promoted}`,
      "",
      "| channel | expect | result | observed | reason |",
      "|---|---|---|---|---|",
    );
    for (const fact of component.facts) {
      lines.push(
        `| ${fact.channel} | ${fact.expect}${fact.expectName ? ` (${fact.expectName})` : ""} | ${fact.result} | ${fact.observed} | ${fact.reason.replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function writeReports(report, root = ROOT) {
  const oracleDir = path.join(root, "examples", "mui", "oracle");
  mkdirSync(oracleDir, { recursive: true });
  const jsonPath = path.join(oracleDir, "report.json");
  const mdPath = path.join(oracleDir, "REPORT.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderReportMarkdown(report));
  return { jsonPath, mdPath };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const report = scoreCorpus(ROOT);
  const { jsonPath, mdPath } = writeReports(report, ROOT);
  const { summary } = report;
  console.log(
    `mui-oracle-offline: ${summary.match} MATCH · ${summary.pending} PENDING · ${summary.fail} FAIL / ${summary.facts} facts`,
  );
  console.log(`wrote ${path.relative(ROOT, mdPath)} and ${path.relative(ROOT, jsonPath)}`);
  if (!report.ok) {
    for (const error of report.errors) console.error(`✘ ${error}`);
    process.exit(1);
  }
  console.log("✔ mui-oracle-offline: no silent UNSUPPORTED/REFUSED success; CARRIED gaps are PENDING or evidenced");
}
