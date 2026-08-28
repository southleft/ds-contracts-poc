import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { adaptReviewedButton } from "./adapters/button.js";
import { readRepositoryJson } from "./evidence-path.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import type { ComponentSetNode } from "./figma-ir.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  buttonRecipe,
  collapseButtonRecipe,
  compileButtonRecipe,
} from "./recipes/button.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  verifySceneDerivedFixedPoint,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneFixedPointReport,
  type SceneNodeSnapshot,
} from "./scene-readback.js";

export const BUTTON_SCENE_INVERSION_VERSION = "button-scene-inversion-v1";
export const BUTTON_SCENE_INVERSION_ROOT =
  "recipe/evidence/button-scene-inversion-v1";
export const BUTTON_V4_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const BUTTON_V4_FILE_NAME = "Scratch Project";
export const BUTTON_V4_PAGE_ID = "85:6781";
export const BUTTON_V4_PAGE_NAME =
  "Recipe Pivot / Button / e6a61d04-b04f4059-v4";
export const BUTTON_V4_RUN_IDENTITY = "e6a61d04-b04f4059-v4";
export const BUTTON_V4_NAMESPACE = "ds.contracts.recipe.v4";
export const INPUT_V85_PAGE_ID = "115:295378";
export const HISTORICAL_BUTTON_READBACK_PATH =
  "recipe/evidence/button-live-pivot-v4/normalized-live-readback.json";

export const BUTTON_INVERSION_SOURCES = [
  {
    source: "altitude",
    adapterIdentity: "altitude-button-reviewed-v2",
    setId: "85:7406",
    contractPath: "examples/altitude/contracts/button.contract.json",
    config: altitudeButtonAdapterConfig,
  },
  {
    source: "fluent",
    adapterIdentity: "fluent-button-reviewed-v2",
    setId: "85:8054",
    contractPath: "examples/fluent/contracts/button.contract.json",
    config: fluentButtonAdapterConfig,
  },
] as const;

export const FORBIDDEN_OBSERVE_KEYS = [
  "ir",
  "sourceIr",
  "expected",
  "expectedPlan",
  "facts",
  "typedReceipts",
  "comparedIrFacts",
  "cells",
  "irFontFamily",
  "irFontStyle",
  "irCell",
] as const;

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const variantKey = (properties: Record<string, string>): string =>
  ["Variant", "Size", "State", "Icons"]
    .map((name) => `${name}=${properties[name] ?? ""}`)
    .join(",");

const parseVariantName = (name: string): Record<string, string> =>
  Object.fromEntries(
    name
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const at = part.indexOf("=");
        return [part.slice(0, at), part.slice(at + 1)];
      }),
  );

export function buttonV4LiveTokenName(
  tokenIdentity: string,
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
): string {
  const segment = tokenIdentity
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return `token/${type.toLowerCase()}/${segment}`;
}

export function decodeButtonHexTokenName(name: string): string | undefined {
  const match = name.match(
    /^token\/(?:color|float|string|boolean)\/id-([0-9a-f]+)$/,
  );
  if (!match || (match[1] ?? "").length % 2 !== 0) return undefined;
  const decoded = Buffer.from(match[1]!, "hex").toString("utf8");
  if (Buffer.from(decoded, "utf8").toString("hex") !== match[1]) return undefined;
  return decoded;
}

export function sceneRoleFromName(
  name: string,
  variantProperties?: Record<string, string>,
): string | undefined {
  const head = name.split(" :: ", 1)[0] ?? "";
  if (head.includes("/") && !head.includes("=")) return head;
  const props = variantProperties ?? parseVariantName(name);
  if (props.Variant && props.Size && props.State && props.Icons) {
    return `button/variant/${props.Variant}/${props.Size}/${props.State}/${props.Icons}`;
  }
  return undefined;
}

const collectCompileTokenIdentities = (
  node: { bindings?: Array<{ variable: string; type: string }>; children?: readonly unknown[] },
): Array<{ variable: string; type: string }> => [
  ...(node.bindings ?? []),
  ...(node.children ?? []).flatMap((child) =>
    collectCompileTokenIdentities(
      child as {
        bindings?: Array<{ variable: string; type: string }>;
        children?: readonly unknown[];
      },
    ),
  ),
];

export function compileButtonTokenIdentityMap(
  compileRoot: ComponentSetNode,
): Map<string, string> {
  const unique = new Map<string, string>();
  const collisions = new Set<string>();
  for (const binding of collectCompileTokenIdentities(compileRoot)) {
    const type = binding.type as "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    const live = buttonV4LiveTokenName(binding.variable, type);
    const hex = `token/${type.toLowerCase()}/id-${Buffer.from(binding.variable, "utf8").toString("hex")}`;
    for (const key of [live, hex]) {
      const previous = unique.get(key);
      if (previous !== undefined && previous !== binding.variable) {
        collisions.add(key);
        unique.delete(key);
        continue;
      }
      if (!collisions.has(key)) unique.set(key, binding.variable);
    }
  }
  return unique;
}

export function canonicalizeButtonObserveTokenName(
  liveName: string,
  identityByLiveName: ReadonlyMap<string, string>,
): string {
  const mapped = identityByLiveName.get(liveName);
  if (mapped !== undefined) return mapped;
  const decoded = decodeButtonHexTokenName(liveName);
  if (
    decoded !== undefined &&
    [...identityByLiveName.values()].includes(decoded)
  ) {
    return decoded;
  }
  return liveName;
}

export function refuseHistoricalReadbackAsObserve(value: unknown): string[] {
  const failures: string[] = [];
  if (!Array.isArray(value)) {
    return ["historical Button readback is not a SceneNodeSnapshot tree"];
  }
  for (const row of value) {
    if (row === null || typeof row !== "object") {
      failures.push("historical Button readback row is not an object");
      continue;
    }
    const record = row as Record<string, unknown>;
    if (record.ownershipKey !== undefined || record.type === "COMPONENT_SET") {
      continue;
    }
    if ("cells" in record && "axes" in record) {
      failures.push(
        "historical Button readback is a self-selected axes/cells projection, not a complete scene-derived IR",
      );
    }
  }
  if (failures.length === 0 && value.length > 0) {
    const first = value[0] as Record<string, unknown>;
    if (first.cells !== undefined && first.ownershipKey === undefined) {
      failures.push(
        "historical Button readback lacks scene ownership keys and complete node snapshots",
      );
    }
  }
  return failures;
}

export function forbiddenObserveKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      forbiddenObserveKeys(child, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(FORBIDDEN_OBSERVE_KEYS.includes(
        key as (typeof FORBIDDEN_OBSERVE_KEYS)[number],
      )
        ? [`${path}.${key}`]
        : []),
      ...forbiddenObserveKeys(child, `${path}.${key}`),
    ],
  );
}

export interface ButtonExpectedPlanSource {
  source: "altitude" | "fluent";
  adapterIdentity: string;
  setId: string;
  recipeHash: string;
  envelopeHash: string;
  variants: number;
  compileRoot: ComponentSetNode;
  expectedScenePlan: ExpectedScenePlan;
}

export function compileButtonExpectedScenePlans(): ButtonExpectedPlanSource[] {
  return BUTTON_INVERSION_SOURCES.map((source) => {
    const instance = adaptReviewedButton(
      JSON.parse(readFileSync(source.contractPath, "utf8")),
      source.config,
    );
    const envelope = compileButtonRecipe(instance);
    if (envelope.ir.kind !== "component-set") {
      throw new TypeError(`${source.source}: compile IR is not a component-set`);
    }
    const root = envelope.ir as ComponentSetNode;
    if (root.children.length !== 144) {
      throw new TypeError(
        `${source.source}: compile variants ${root.children.length}, expected 144`,
      );
    }
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      setId: source.setId,
      recipeHash: hashRecipeInstance(buttonRecipe, instance),
      envelopeHash: envelope.integrity.canonicalHash,
      variants: root.children.length,
      compileRoot: root,
      expectedScenePlan: compileExpectedScenePlan(root),
    };
  });
}

const COMPILE_ABSENT_STROKE_SIDE_FIELDS = new Set([
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
]);

export function normalizeButtonObserveScene(
  scene: SceneNodeSnapshot,
  identityByLiveName?: ReadonlyMap<string, string>,
): SceneNodeSnapshot {
  return {
    ...scene,
    boundVariables: scene.boundVariables
      .filter((binding) => !COMPILE_ABSENT_STROKE_SIDE_FIELDS.has(binding.field))
      .map((binding) =>
        identityByLiveName === undefined
          ? binding
          : {
              ...binding,
              variableName: canonicalizeButtonObserveTokenName(
                binding.variableName,
                identityByLiveName,
              ),
            },
      ),
    children: scene.children.map((child) =>
      normalizeButtonObserveScene(child, identityByLiveName),
    ),
  };
}

export function assignButtonSceneOwnership(
  raw: SceneNodeSnapshot,
  compileRoot: ComponentSetNode,
): SceneNodeSnapshot {
  if (raw.type !== "COMPONENT_SET") {
    throw new TypeError("Button observe root must be a component-set");
  }
  const byVariant = new Map(
    raw.children.map((child) => [
      variantKey(child.variantProperties ?? parseVariantName(child.name)),
      child,
    ]),
  );
  const children = compileRoot.children.map((component, index) => {
    const live = byVariant.get(variantKey(component.variantProperties));
    if (!live) {
      throw new TypeError(
        `BUTTON-OBSERVE-VARIANT-ABSENT:${variantKey(component.variantProperties)}`,
      );
    }
    return stampOwnership(live, `root/children/${index}`);
  });
  return {
    ...raw,
    ownershipKey: "root",
    semanticRole: raw.semanticRole ?? sceneRoleFromName(raw.name, raw.variantProperties),
    children,
  };
}

const stampOwnership = (
  node: SceneNodeSnapshot,
  key: string,
): SceneNodeSnapshot => ({
  ...node,
  ownershipKey: key,
  semanticRole: node.semanticRole ?? sceneRoleFromName(node.name, node.variantProperties),
  children: node.children.map((child, index) =>
    stampOwnership(child, `${key}/children/${index}`),
  ),
});

export interface ButtonInversionRootReport {
  source: "altitude" | "fluent";
  adapterIdentity: string;
  setId: string;
  variants: number;
  expectedFacts: number;
  accounting: SceneComparison;
  fixedPoint: SceneFixedPointReport;
  channelDrift: Array<{
    channel: string;
    missing: number;
    extra: number;
    mismatched: number;
  }>;
  fixedPointError?: string;
}

export interface ButtonInversionReport {
  version: typeof BUTTON_SCENE_INVERSION_VERSION;
  method: "expected-plan-vs-observe";
  sourceIrRead: false;
  silentAssigned: false;
  silentDerived: true;
  historicalReadbackRefusedAsObserve: true;
  figmaWrites: 0;
  inputPageUntouched: true;
  overallButtonSuccess: false;
  humanSignoff: "pending";
  ok: boolean;
  roots: ButtonInversionRootReport[];
}

const channelDrift = (
  accounting: SceneComparison,
): ButtonInversionRootReport["channelDrift"] => {
  const counts = new Map<
    string,
    { missing: number; extra: number; mismatched: number }
  >();
  const bump = (
    channel: string,
    field: "missing" | "extra" | "mismatched",
  ): void => {
    const current = counts.get(channel) ?? {
      missing: 0,
      extra: 0,
      mismatched: 0,
    };
    current[field] += 1;
    counts.set(channel, current);
  };
  for (const fact of accounting.missing) bump(fact.channel, "missing");
  for (const fact of accounting.extra) bump(fact.channel, "extra");
  for (const pair of accounting.mismatched)
    bump(pair.expected.channel, "mismatched");
  return [...counts.entries()]
    .map(([channel, value]) => ({ channel, ...value }))
    .sort((left, right) => left.channel.localeCompare(right.channel));
};

export function compareButtonSceneInversion(
  plans: readonly ButtonExpectedPlanSource[],
  observes: readonly {
    source: "altitude" | "fluent";
    scene: SceneNodeSnapshot;
  }[],
  options: { canonicalizeTokens?: boolean } = {},
): ButtonInversionReport {
  const historical = refuseHistoricalReadbackAsObserve(
    readRepositoryJson<unknown>(HISTORICAL_BUTTON_READBACK_PATH),
  );
  if (historical.length === 0) {
    throw new TypeError(
      "historical Button readback was accepted as a scene-derived observe",
    );
  }
  if (plans.length !== 2 || observes.length !== 2) {
    throw new TypeError("Button inversion requires two independent roots");
  }
  const roots = plans.map((plan) => {
    const observe = observes.find((row) => row.source === plan.source);
    if (!observe) throw new TypeError(`Button observe omitted ${plan.source}`);
    const scene = normalizeButtonObserveScene(
      observe.scene,
      options.canonicalizeTokens === false
        ? undefined
        : compileButtonTokenIdentityMap(plan.compileRoot),
    );
    const stamped = forbiddenObserveKeys(scene);
    if (stamped.length > 0) {
      throw new TypeError(
        `${plan.source}: observe contains stamped IR keys ${stamped.join(",")}`,
      );
    }
    const instance = adaptReviewedButton(
      JSON.parse(
        readFileSync(
          BUTTON_INVERSION_SOURCES.find(
            (source) => source.source === plan.source,
          )!.contractPath,
          "utf8",
        ),
      ),
      BUTTON_INVERSION_SOURCES.find((source) => source.source === plan.source)!
        .config,
    );
    const envelope = compileButtonRecipe(instance);
    const accounting = compareSceneToExpectedPlan(
      plan.expectedScenePlan,
      scene,
    );
    let fixedPoint: SceneFixedPointReport;
    let fixedPointError: string | undefined;
    try {
      fixedPoint = verifySceneDerivedFixedPoint(
        scene,
        envelope,
        instance.provenance.selection,
        collapseButtonRecipe,
        compileButtonRecipe,
      );
    } catch (error) {
      fixedPointError =
        error instanceof Error ? error.message : String(error);
      fixedPoint = {
        comparison: accounting,
        cycle1: "",
        cycle2: "",
        stable: false,
      };
    }
    return {
      source: plan.source,
      adapterIdentity: plan.adapterIdentity,
      setId: plan.setId,
      variants: plan.variants,
      expectedFacts: plan.expectedScenePlan.facts.length,
      accounting,
      fixedPoint,
      channelDrift: channelDrift(accounting),
      ...(fixedPointError === undefined ? {} : { fixedPointError }),
    };
  });
  return {
    version: BUTTON_SCENE_INVERSION_VERSION,
    method: "expected-plan-vs-observe",
    sourceIrRead: false,
    silentAssigned: false,
    silentDerived: true,
    historicalReadbackRefusedAsObserve: true,
    figmaWrites: 0,
    inputPageUntouched: true,
    overallButtonSuccess: false,
    humanSignoff: "pending",
    ok: roots.every(
      (root) => root.accounting.ok && root.fixedPoint.stable,
    ),
    roots,
  };
}

export function inversionSummary(report: ButtonInversionReport): {
  ok: boolean;
  silentAssigned: false;
  silentDerived: true;
  sourceIrRead: false;
  overallButtonSuccess: false;
  humanSignoff: "pending";
  roots: Array<{
    source: string;
    expectedFacts: number;
    matched: number;
    silent: number;
    missing: number;
    extra: number;
    mismatched: number;
    fixedPointStable: boolean;
    ok: boolean;
  }>;
} {
  return {
    ok: report.ok,
    silentAssigned: false,
    silentDerived: true,
    sourceIrRead: false,
    overallButtonSuccess: false,
    humanSignoff: "pending",
    roots: report.roots.map((root) => ({
      source: root.source,
      expectedFacts: root.expectedFacts,
      matched: root.accounting.matched,
      silent: root.accounting.silent,
      missing: root.accounting.missing.length,
      extra: root.accounting.extra.length,
      mismatched: root.accounting.mismatched.length,
      fixedPointStable: root.fixedPoint.stable,
      ok: root.accounting.ok && root.fixedPoint.stable,
    })),
  };
}

export function serializeButtonInversionReport(
  report: ButtonInversionReport,
): Record<string, unknown> {
  return {
    ...inversionSummary(report),
    version: report.version,
    method: report.method,
    historicalReadbackRefusedAsObserve:
      report.historicalReadbackRefusedAsObserve,
    figmaWrites: report.figmaWrites,
    inputPageUntouched: report.inputPageUntouched,
    measuredClasses: [
      "observe role() takes the first :: name segment before testing =, and recovers button/variant/... from live Variant=/Size=/State=/Icons= properties (Input V74 class); live names still have no button/variant/ first segment",
      "live token/{type}/{sanitized} names canonicalize to compile identities only when the v4 writer sanitizer is unique for the same key; collisions are left live",
      "live set name is Button / button@1 proof; compile name is button/set :: Button / button@1 proof",
      "live text type uses resolved family/style (Fluent Roboto / SemiBold); compile names the source stack — not taught",
      "per-side stroke weight bindings are compile-absent host extras and were omitted from observe, not restamped onto the plan",
    ],
    roots: report.roots.map((root) => ({
      source: root.source,
      adapterIdentity: root.adapterIdentity,
      setId: root.setId,
      variants: root.variants,
      expectedFacts: root.expectedFacts,
      matched: root.accounting.matched,
      silent: root.accounting.silent,
      missing: root.accounting.missing.length,
      extra: root.accounting.extra.length,
      mismatched: root.accounting.mismatched.length,
      duplicateCollapsed: root.accounting.duplicateCollapsed.length,
      unobserved: root.accounting.unobserved.length,
      denominator: root.accounting.denominator,
      ok: root.accounting.ok && root.fixedPoint.stable,
      fixedPointStable: root.fixedPoint.stable,
      ...(root.fixedPointError === undefined
        ? {}
        : { fixedPointError: root.fixedPointError }),
      channelDrift: root.channelDrift,
      sampleFailures: root.accounting.failures.slice(0, 12),
    })),
  };
}

export function hashBytes(value: string | Uint8Array): string {
  return sha256(value);
}

export function validateButtonSceneInversionEvidence(
  inversion: Record<string, any>,
): string[] {
  const failures: string[] = [];
  if (inversion.overallButtonSuccess !== false)
    failures.push("Button overall must stay false");
  if (inversion.humanSignoff !== "pending")
    failures.push("Button human signoff must stay pending");
  if (inversion.silentAssigned !== false)
    failures.push("silent must not be assigned");
  if (inversion.silentDerived !== true)
    failures.push("silent must be derived from expected-plan vs observe");
  if (inversion.sourceIrRead !== false)
    failures.push("inversion must not read stamped source IR");
  if (inversion.ok !== false)
    failures.push("inversion ok must stay false while silent is nonzero");
  if (inversion.figmaWrites !== 0)
    failures.push("Button inversion must be 0 writes");
  if (!Array.isArray(inversion.roots) || inversion.roots.length !== 2)
    failures.push("inversion must report two roots");
  for (const root of inversion.roots ?? []) {
    if (
      typeof root.silent !== "number" ||
      root.silent !== root.expectedFacts - root.matched
    ) {
      failures.push(`${root.source}: silent is not expectedFacts-matched`);
    }
    if (root.silent === 0 || root.ok === true) {
      failures.push(`${root.source}: do not claim silent-zero`);
    }
  }
  return failures;
}

export function validateButtonStatusPlant(button: Record<string, any>): string[] {
  const inversion = readRepositoryJson<Record<string, any>>(
    `${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`,
  );
  const index = readRepositoryJson<Record<string, any>>(
    `${BUTTON_SCENE_INVERSION_ROOT}/index.json`,
  );
  const failures = validateButtonSceneInversionEvidence(inversion);
  if (button.overallSuccess !== false)
    failures.push("Button overallSuccess must stay false");
  if (button.status !== "pending") failures.push("Button status must stay pending");
  if (button.humanSignoff !== "pending")
    failures.push("Button humanSignoff must stay pending");
  const plant = button.sceneDerivedInversion;
  if (plant?.method !== "expected-plan-vs-observe")
    failures.push("Button inversion method must be expected-plan-vs-observe");
  if (plant?.sourceIrRead !== false) failures.push("Button inversion sourceIrRead");
  if (plant?.silentAssigned !== false)
    failures.push("Button inversion silentAssigned");
  if (plant?.silentDerived !== true) failures.push("Button inversion silentDerived");
  if (plant?.ok !== false) failures.push("Button inversion ok must stay false");
  if (plant?.figmaWrites !== 0) failures.push("Button inversion figmaWrites");
  if (plant?.inputPageUntouched !== true)
    failures.push("Button inversion must leave the Input page untouched");
  if (plant?.historicalReadbackRefusedAsObserve !== true)
    failures.push("historical readback must stay refused as observe");
  const altitude = inversion.roots.find((root: { source: string }) => root.source === "altitude");
  const fluent = inversion.roots.find((root: { source: string }) => root.source === "fluent");
  if (plant?.roots?.altitude?.silent !== altitude?.silent)
    failures.push("Button altitude silent plant does not match evidence");
  if (plant?.roots?.fluent?.silent !== fluent?.silent)
    failures.push("Button fluent silent plant does not match evidence");
  if (plant?.roots?.altitude?.expectedFacts !== altitude?.expectedFacts)
    failures.push("Button altitude expectedFacts plant does not match evidence");
  if (plant?.roots?.fluent?.expectedFacts !== fluent?.expectedFacts)
    failures.push("Button fluent expectedFacts plant does not match evidence");
  if (plant?.roots?.altitude?.matched !== altitude?.matched)
    failures.push("Button altitude matched plant does not match evidence");
  if (plant?.roots?.fluent?.matched !== fluent?.matched)
    failures.push("Button fluent matched plant does not match evidence");
  if (plant?.indexSha256 !== indexHash() || plant?.inversionSha256 !== inversionHash())
    failures.push("Button inversion artifact hash plant does not match disk");
  if (
    !Array.isArray(button.blockers) ||
    !button.blockers.includes("no attributable human signoff")
  )
    failures.push("Button blockers must keep no attributable human signoff");
  if (index.overallButtonSuccess !== false || index.humanSignoff !== "pending")
    failures.push("Button inversion index must stay overall false / signoff pending");
  return failures;
}

const indexHash = (): string =>
  sha256(readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/index.json`));
const inversionHash = (): string =>
  sha256(readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`));

export function buildButtonSceneObserveProgram(setId: string): string {
  if (!/^\d+:\d+$/.test(setId)) {
    throw new TypeError(`invalid Button set id ${setId}`);
  }
  return String.raw`
await figma.loadAllPagesAsync();
if(figma.fileKey!==${JSON.stringify(BUTTON_V4_FILE_KEY)})throw new Error("WRONG-FILE");
if(figma.root.name!==${JSON.stringify(BUTTON_V4_FILE_NAME)})throw new Error("WRONG-NAME");
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR");
const page=await figma.getNodeByIdAsync(${JSON.stringify(BUTTON_V4_PAGE_ID)});
if(!page||page.type!=="PAGE")throw new Error("BUTTON-PAGE-ABSENT");
const inputPage=await figma.getNodeByIdAsync(${JSON.stringify(INPUT_V85_PAGE_ID)});
const set=await figma.getNodeByIdAsync(${JSON.stringify(setId)});
if(!set||set.type!=="COMPONENT_SET")throw new Error("BUTTON-SET-ABSENT");
const NS=${JSON.stringify(BUTTON_V4_NAMESPACE)};
const adapterIdentity=set.getSharedPluginData(NS,"adapterIdentity");
const runIdentity=set.getSharedPluginData(NS,"runIdentity");
if(runIdentity!==${JSON.stringify(BUTTON_V4_RUN_IDENTITY)})throw new Error("BUTTON-RUN-IDENTITY");
const hex=value=>Math.round(Math.max(0,Math.min(1,value))*255).toString(16).padStart(2,"0");
const color=(paintColor,opacity=1)=>"#"+hex(paintColor.r)+hex(paintColor.g)+hex(paintColor.b)+hex((paintColor.a===undefined?1:paintColor.a)*opacity);
const paint=item=>{
  if(item.type==="SOLID")return{type:"SOLID",color:color(item.color,item.opacity===undefined?1:item.opacity)};
  if(item.type==="GRADIENT_LINEAR"||item.type==="GRADIENT_RADIAL")return{type:item.type,angle:0,gradientStops:(item.gradientStops||[]).map(stop=>({position:stop.position,color:color(stop.color)}))};
  if(item.type==="IMAGE")return{type:"IMAGE",assetRef:item.imageHash||"unresolved-image",scaleMode:item.scaleMode};
  throw new Error("UNSUPPORTED-SCENE-PAINT:"+item.type);
};
const effect=item=>{
  const common={type:item.type,radius:item.radius,visible:item.visible!==false};
  if(item.type==="DROP_SHADOW"||item.type==="INNER_SHADOW")return{...common,offset:item.offset,spread:item.spread||0,color:color(item.color)};
  return common;
};
const bindings=async node=>{
  const out=[];
  for(const [field,alias] of Object.entries(node.boundVariables||{})){
    if(Array.isArray(alias)){
      for(let index=0;index<alias.length;index++){
        if(!alias[index]||!alias[index].id)continue;
        const variable=await figma.variables.getVariableByIdAsync(alias[index].id);
        if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+field+"."+index);
        out.push({field:field+"."+index,variableName:variable.name,resolvedType:variable.resolvedType});
      }
    }else if(alias&&alias.id){
      const variable=await figma.variables.getVariableByIdAsync(alias.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+field);
      out.push({field,variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.fills)?node.fills:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:fills."+index+".color");
      out.push({field:"fills."+index+".color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.strokes)?node.strokes:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:strokes."+index+".paint.color");
      out.push({field:"strokes."+index+".paint.color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.effects)?node.effects:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:effects."+index+".color");
      out.push({field:"effects."+index+".color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  return out.sort((a,b)=>(a.field+"\\0"+a.variableName).localeCompare(b.field+"\\0"+b.variableName));
};
const role=node=>{
  const description=typeof node.description==="string"?node.description:"";
  const match=description.match(/(?:^|\\n)recipe-role:([^\\n]+)/);
  if(match)return match[1];
  const head=(node.name||"").split(" :: ",1)[0]||"";
  if(head.includes("/")&&!head.includes("="))return head;
  const props=node.variantProperties||Object.fromEntries((node.name||"").split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
  if(props.Variant&&props.Size&&props.State&&props.Icons)return "button/variant/"+props.Variant+"/"+props.Size+"/"+props.State+"/"+props.Icons;
  return undefined;
};
const snapshot=async(node,walkChildren)=>{
  const row={
    ownershipKey:"pending",
    type:node.type,
    name:node.name,
    semanticRole:role(node),
    width:node.width,
    height:node.height,
    visible:node.visible!==false,
    opacity:node.opacity===undefined?1:node.opacity,
    boundVariables:await bindings(node),
    children:[]
  };
  for(const field of ["layoutMode","layoutSizingHorizontal","layoutSizingVertical","primaryAxisAlignItems","counterAxisAlignItems","itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","minWidth","minHeight","clipsContent","strokeWeight","strokeAlign","characters","fontName","fontSize","lineHeight","textAlignHorizontal","textAlignVertical"]){
    if(field in node&&node[field]!==figma.mixed)row[field]=node[field];
  }
  if(Array.isArray(node.fills))row.fills=node.fills.map(paint);
  if(Array.isArray(node.strokes))row.strokes=node.strokes.map(paint);
  if(Array.isArray(node.effects))row.effects=node.effects.map(effect);
  if("topLeftRadius" in node)row.cornerRadius={topLeft:node.topLeftRadius,topRight:node.topRightRadius,bottomRight:node.bottomRightRadius,bottomLeft:node.bottomLeftRadius};
  if(node.type==="COMPONENT"){
    row.variantProperties=Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
  }
  if(node.type==="COMPONENT_SET"){
    row.variantGroupProperties=Object.fromEntries(Object.entries(node.variantGroupProperties).map(([name,axis])=>[name,{values:[...axis.values]}]));
  }
  if(node.type==="INSTANCE"){
    const main=await node.getMainComponentAsync();
    row.componentRef=main?main.name:null;
    row.componentProperties=Object.fromEntries(Object.entries(node.componentProperties||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
  }
  if(walkChildren&&"children" in node){
    for(const child of node.children)row.children.push(await snapshot(child,child.type!=="INSTANCE"));
  }
  return row;
};
const scene=await snapshot(set,true);
return{
  writes:0,
  currentPageUnchanged:figma.currentPage.id===${JSON.stringify(INPUT_V85_PAGE_ID)},
  inputPagePresent:!!(inputPage&&inputPage.type==="PAGE"),
  pageId:page.id,
  setId:set.id,
  adapterIdentity,
  runIdentity,
  variants:set.children.length,
  scene
};`;
}
