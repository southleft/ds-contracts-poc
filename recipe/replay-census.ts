/**
 * Archetype-generic offline replay census (H1).
 *
 * Generalizes `recipe/table-tail-census.ts` so each archetype can replay a
 * persisted substrate through the CURRENT read-side host-normalize layer and
 * enumerate the remaining tail in one offline pass — zero Figma writes.
 *
 * Substrate kinds:
 * - table, calendar: `private/*-live-vNN-transaction/004-extract.raw.json`
 * - button: committed observe snapshots under `recipe/evidence/button-scene-inversion-v1/`
 *   (v4 page; role-only writer naming — the B2j teaching substrate)
 *
 * HONEST LIMIT (same as table tail census): extract/observe substrates were
 * captured under their version's writer. This instrument predicts the
 * READ-SIDE tail only. Writer-side refusals still surface only in a live run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { adaptReviewedCalendar } from "./adapters/calendar.js";
import {
  assignButtonSceneOwnership,
  buttonFontByOwnershipKey,
  buttonPlanNamesByOwnershipKey,
  buttonPlanRootChrome,
  compileButtonBindingsByOwnershipKey,
  compileButtonComponentRefMap,
  compileButtonExpectedScenePlans,
  compileButtonTokenIdentityMap,
  normalizeButtonObserveScene,
  type ButtonExpectedPlanSource,
} from "./button-scene-inversion.js";
import { validateCalendarLiveV42ExtractPayload } from "./calendar-live-v42-contract.js";
import { normalizeCalendarLiveV42Scene } from "./calendar-live-v42-verifier.js";
import {
  astryxCalendarAdapterConfig,
  astryxCalendarSource,
} from "./fixtures/library-calendars.js";
import type { IRNode } from "./figma-ir.js";
import { hashRecipeEnvelope } from "./hash.js";
import {
  collapseCalendarRecipe,
  compileCalendarRecipe,
} from "./recipes/calendar.js";
import {
  allDifferences,
  type TableIrDifference,
} from "./recipes/table.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type SceneComparison,
  type SceneFact,
  type SceneNodeSnapshot,
} from "./scene-readback-calendar-v1.js";
import {
  buildTableTailCensus,
  TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL,
  type TableTailCensus,
} from "./table-tail-census.js";

export const REPLAY_CENSUS_VERSION = "replay-census-v1";

/** Table v23 live refusal — the table census validation anchor. */
export const REPLAY_CENSUS_TABLE_KNOWN_V23_REFUSAL =
  TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL;

/** Calendar v42 live refusal at day-button binding compile-order. */
export const REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL =
  "$.children[2].children[0].children[0].bindings[0].field";

/** Button B2j v4 role-only name recovery — root set name channel. */
export const REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL = "name";

export type ReplayCensusArchetype = "table" | "calendar" | "button";

export interface ReplayCensusAccountingEntry {
  class: "missing" | "extra" | "mismatched";
  ownershipKey: string;
  channel: string;
  expected?: unknown;
  observed?: unknown;
}

export interface ReplayCensusIrEntry {
  path: string;
  reason: TableIrDifference["reason"];
  property: string;
  compiled?: unknown;
  observed?: unknown;
}

export interface ReplayCensusRoot {
  source: string;
  adapterIdentity: string;
  preDiffRefusal: string | null;
  accountingProblems: number;
  accounting: ReplayCensusAccountingEntry[];
  differences: number;
  entries: ReplayCensusIrEntry[];
}

export interface ReplayCensus {
  artifactVersion: typeof REPLAY_CENSUS_VERSION;
  archetype: ReplayCensusArchetype;
  substrate: {
    kind: "extract-transaction" | "observe-evidence";
    path: string;
    pageId?: string;
  };
  predicts: "read-side tail only";
  doesNotPredict: string;
  knownHistoricalRefusal: string;
  reproducesKnownHistoricalRefusal: boolean;
  predictedNextLiveRefusal: {
    source: string;
    path: string;
    property: string;
  } | null;
  totalAccountingProblems: number;
  totalDifferences: number;
  classFamilies: Array<{
    property: string;
    reason: TableIrDifference["reason"];
    count: number;
  }>;
  roots: ReplayCensusRoot[];
}

export interface ReplayCensusOptions {
  /** extract transaction dir (table/calendar) or observe evidence root (button) */
  substrate?: string;
  /** calendar only: replay Figma alphabetical bind order to reproduce v42 refusal */
  revertDayButtonBindingCompileOrder?: boolean;
  /** button only: omit B2j role-only name recovery to reproduce historical mismatches */
  revertB2jRoleOnlyNameRecovery?: boolean;
}

const FIGMA_DAY_BUTTON_BINDING_ORDER = [
  "fills.0.color",
  "layout.height.value",
  "cornerRadius.topLeft",
  "layout.width.value",
] as const;

const resolveIrProperty = (root: unknown, path: string): string => {
  const steps = path
    .replace(/^\$/, "")
    .split(/(?=\[)|\./)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  let node: any = root;
  let property = "";
  for (const step of steps) {
    const index = step.match(/^\[(\d+)\]$/);
    const next = index ? node?.[Number(index[1])] : node?.[step];
    if (!index && step !== "children") property = property ? `${property}.${step}` : step;
    node = next;
    if (node === undefined) break;
  }
  return property || "(node)";
};

const flattenAccounting = (
  comparison: SceneComparison,
): ReplayCensusAccountingEntry[] => {
  const entries: ReplayCensusAccountingEntry[] = [];
  for (const group of ["missing", "extra", "mismatched"] as const) {
    for (const raw of comparison[group] ?? []) {
      // A missing/extra row is a fact; a mismatched row is an expected/observed pair.
      const entry = raw as Partial<SceneFact> & Partial<{ expected: SceneFact; observed: SceneFact }>;
      entries.push({
        class: group,
        ownershipKey:
          entry.expected?.nodeOwnershipKey ??
          entry.observed?.nodeOwnershipKey ??
          entry.nodeOwnershipKey ??
          "(unknown)",
        channel:
          entry.expected?.channel ??
          entry.observed?.channel ??
          entry.channel ??
          "(unknown)",
        ...(entry.expected?.value === undefined
          ? {}
          : { expected: entry.expected.value }),
        ...(entry.observed?.value === undefined
          ? {}
          : { observed: entry.observed.value }),
      });
    }
  }
  return entries;
};

const shuffleCalendarDayButtonBindings = (node: any): any => {
  if (node?.role === "calendar/day/button" && Array.isArray(node.bindings)) {
    const byField = Object.fromEntries(
      node.bindings.map((binding: { field: string }) => [
        binding.field,
        binding,
      ]),
    );
    return {
      ...node,
      bindings: FIGMA_DAY_BUTTON_BINDING_ORDER.map(
        (field) => byField[field],
      ).filter(Boolean),
    };
  }
  if (Array.isArray(node?.children)) {
    return {
      ...node,
      children: node.children.map(shuffleCalendarDayButtonBindings),
    };
  }
  return node;
};

export function buildTableReplayCensus(
  transactionDir = "private/table-live-v27-transaction",
): ReplayCensus {
  const table = buildTableTailCensus(transactionDir);
  return tableTailToReplay(table, transactionDir);
}

const tableTailToReplay = (
  table: TableTailCensus,
  transactionDir: string,
): ReplayCensus => ({
  artifactVersion: REPLAY_CENSUS_VERSION,
  archetype: "table",
  substrate: {
    kind: "extract-transaction",
    path: transactionDir,
    pageId: table.substrate.pageId,
  },
  predicts: "read-side tail only",
  doesNotPredict: table.doesNotPredict,
  knownHistoricalRefusal: REPLAY_CENSUS_TABLE_KNOWN_V23_REFUSAL,
  reproducesKnownHistoricalRefusal: table.reproducesKnownV23Refusal,
  predictedNextLiveRefusal: table.predictedNextLiveRefusal
    ? {
        source: table.predictedNextLiveRefusal.source,
        path: table.predictedNextLiveRefusal.path,
        property: table.predictedNextLiveRefusal.property,
      }
    : null,
  totalAccountingProblems: table.totalAccountingProblems,
  totalDifferences: table.totalDifferences,
  classFamilies: table.classFamilies.map((family) => ({
    property: family.property,
    reason: family.reason,
    count: family.count,
  })),
  roots: table.roots.map((root) => ({
    source: root.source,
    adapterIdentity: root.adapterIdentity,
    preDiffRefusal: root.preDiffRefusal,
    accountingProblems: root.accountingProblems,
    accounting: root.accounting.flatMap((row) =>
      row.entries.map((entry) => ({
        class: entry.class,
        ownershipKey: entry.ownershipKey,
        channel: entry.channel,
        ...(entry.expected === undefined ? {} : { expected: entry.expected }),
        ...(entry.observed === undefined ? {} : { observed: entry.observed }),
      })),
    ),
    differences: root.differences,
    entries: root.entries.map((entry) => ({
      path: entry.path,
      reason: entry.reason,
      property: entry.property,
      ...(entry.compiled === undefined ? {} : { compiled: entry.compiled }),
      ...(entry.observed === undefined ? {} : { observed: entry.observed }),
    })),
  })),
});

export function buildCalendarReplayCensus(
  transactionDir = "private/calendar-live-v42-transaction",
  options: Pick<
    ReplayCensusOptions,
    "revertDayButtonBindingCompileOrder"
  > = {},
): ReplayCensus {
  const rawText = readFileSync(
    `${transactionDir}/004-extract.raw.json`,
    "utf8",
  );
  const raw = JSON.parse(rawText) as { result?: { payload?: unknown } };
  const ownership = JSON.parse(
    readFileSync(`${transactionDir}/writer-ownership.json`, "utf8"),
  );
  const extract = validateCalendarLiveV42ExtractPayload(
    raw.result?.payload,
    ownership,
  );
  const instance = adaptReviewedCalendar(
    astryxCalendarSource,
    astryxCalendarAdapterConfig,
  );
  const envelope = compileCalendarRecipe(instance);
  const root = extract.roots[0]!;
  const variableTable = extract.variableTable;

  const calendarScene = normalizeCalendarLiveV42Scene(
    root.calendarScene,
    variableTable,
  ).scene;
  const weekScene = normalizeCalendarLiveV42Scene(
    root.weekScene,
    variableTable,
  ).scene;
  let dayScene = normalizeCalendarLiveV42Scene(
    root.dayScene,
    variableTable,
  ).scene;
  let dayIr = sceneToNormalizedIr(dayScene);
  if (options.revertDayButtonBindingCompileOrder) {
    dayIr = shuffleCalendarDayButtonBindings(dayIr);
  }

  const tableIr = sceneToNormalizedIr(calendarScene);
  const weekIr = sceneToNormalizedIr(weekScene);

  const compiledCalendarSet = (envelope.ir as { children: IRNode[] }).children.find(
    (child) => child.role === "calendar/set",
  );
  const compiledWeekSet = (envelope.ir as { children: IRNode[] }).children.find(
    (child) => child.role === "calendar/week-set",
  );
  const compiledDaySet = (envelope.ir as { children: IRNode[] }).children.find(
    (child) => child.role === "calendar/day-set",
  );
  if (!compiledCalendarSet || !compiledWeekSet || !compiledDaySet) {
    throw new TypeError("calendar replay census: compile lost owned sets");
  }

  const accountingRows: Array<{
    comparison: SceneComparison;
    compiledSet: NonNullable<typeof compiledCalendarSet>;
    scene: SceneNodeSnapshot;
    rootOwnershipKey: "calendar" | "week" | "day";
  }> = [
    {
      comparison: compareSceneToExpectedPlan(
        compileExpectedScenePlan(compiledCalendarSet, {
          rootOwnershipKey: "calendar",
        }),
        calendarScene,
      ),
      compiledSet: compiledCalendarSet,
      scene: calendarScene,
      rootOwnershipKey: "calendar",
    },
    {
      comparison: compareSceneToExpectedPlan(
        compileExpectedScenePlan(compiledWeekSet, {
          rootOwnershipKey: "week",
        }),
        weekScene,
      ),
      compiledSet: compiledWeekSet,
      scene: weekScene,
      rootOwnershipKey: "week",
    },
    {
      comparison: compareSceneToExpectedPlan(
        compileExpectedScenePlan(compiledDaySet, { rootOwnershipKey: "day" }),
        dayScene,
        {
          omitOpacityOwnershipKeys:
            contentTextOwnershipKeysWithoutCompileOpacity(
              compiledDaySet,
              "day",
            ),
        },
      ),
      compiledSet: compiledDaySet,
      scene: dayScene,
      rootOwnershipKey: "day",
    },
  ];

  const observed = structuredClone(envelope);
  observed.ir = { ...observed.ir, children: [tableIr, weekIr, dayIr] } as typeof observed.ir;
  observed.integrity.canonicalHash = hashRecipeEnvelope(observed);

  const sink: TableIrDifference[] = [];
  let preDiffRefusal: string | null = null;
  try {
    const collapsed = collapseCalendarRecipe(
      observed,
      instance.provenance.selection,
    );
    const recompiled = compileCalendarRecipe(collapsed);
    allDifferences(recompiled.ir, observed.ir, "$", sink);
  } catch (error) {
    preDiffRefusal = error instanceof Error ? error.message : String(error);
  }

  const entries: ReplayCensusIrEntry[] = sink.map((difference) => ({
    path: difference.path,
    reason: difference.reason,
    property: resolveIrProperty(observed.ir, difference.path),
    ...(difference.left === undefined ? {} : { compiled: difference.left }),
    ...(difference.right === undefined ? {} : { observed: difference.right }),
  }));

  const accounting = accountingRows.flatMap((row) =>
    flattenAccounting(row.comparison),
  );

  const reproducesKnownHistoricalRefusal =
    options.revertDayButtonBindingCompileOrder === true &&
    preDiffRefusal?.includes(REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL) === true;

  const families = new Map<
    string,
    { property: string; reason: TableIrDifference["reason"]; count: number }
  >();
  for (const entry of entries) {
    const key = `${entry.property}\u0000${entry.reason}`;
    const existing = families.get(key);
    if (existing) existing.count += 1;
    else
      families.set(key, {
        property: entry.property,
        reason: entry.reason,
        count: 1,
      });
  }

  return {
    artifactVersion: REPLAY_CENSUS_VERSION,
    archetype: "calendar",
    substrate: {
      kind: "extract-transaction",
      path: transactionDir,
      pageId: extract.pageId,
    },
    predicts: "read-side tail only",
    doesNotPredict:
      "writer-side refusals (TextEncoder, effect paint order, setBoundVariableForEffect geometry). Substrate captured under its version's writer.",
    knownHistoricalRefusal: REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL,
    reproducesKnownHistoricalRefusal,
    predictedNextLiveRefusal:
      preDiffRefusal !== null
        ? {
            source: root.source,
            path:
              preDiffRefusal.match(/at (\$\.[^;]+)/)?.[1] ??
              REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL,
            property: "bindings[0].field",
          }
        : entries[0]
          ? {
              source: root.source,
              path: entries[0].path,
              property: entries[0].property,
            }
          : null,
    totalAccountingProblems: accounting.length,
    totalDifferences: entries.length,
    classFamilies: [...families.values()].sort(
      (left, right) =>
        right.count - left.count || left.property.localeCompare(right.property),
    ),
    roots: [
      {
        source: root.source,
        adapterIdentity: root.adapterIdentity,
        preDiffRefusal,
        accountingProblems: accounting.length,
        accounting,
        differences: entries.length,
        entries,
      },
    ],
  };
}

const readButtonObserve = (
  path: string,
  plan: ButtonExpectedPlanSource,
  options: Pick<ReplayCensusOptions, "revertB2jRoleOnlyNameRecovery">,
): SceneNodeSnapshot => {
  const raw = JSON.parse(
    gunzipSync(readFileSync(path)).toString("utf8"),
  ) as SceneNodeSnapshot;
  return normalizeButtonObserveScene(
    assignButtonSceneOwnership(raw as unknown as Parameters<typeof assignButtonSceneOwnership>[0], plan.compileRoot),
    compileButtonTokenIdentityMap(plan.compileRoot),
    compileButtonComponentRefMap(plan.compileRoot),
    buttonFontByOwnershipKey(plan.expectedScenePlan),
    undefined,
    options.revertB2jRoleOnlyNameRecovery
      ? undefined
      : buttonPlanNamesByOwnershipKey(plan.expectedScenePlan),
    buttonPlanRootChrome(plan.expectedScenePlan),
    compileButtonBindingsByOwnershipKey(plan.compileRoot),
  );
};

export function buildButtonReplayCensus(
  evidenceRoot = "recipe/evidence/button-scene-inversion-v1",
  options: Pick<ReplayCensusOptions, "revertB2jRoleOnlyNameRecovery"> = {},
): ReplayCensus {
  const plans = compileButtonExpectedScenePlans();
  const roots: ReplayCensusRoot[] = plans.map((plan) => {
    const scene = readButtonObserve(
      `${evidenceRoot}/observe-${plan.source}.json.gz`,
      plan,
      options,
    );
    const accounting = compareSceneToExpectedPlan(
      plan.expectedScenePlan,
      scene,
    );
    const flat = flattenAccounting(accounting);
    return {
      source: plan.source,
      adapterIdentity: plan.adapterIdentity,
      preDiffRefusal: null,
      accountingProblems: flat.length,
      accounting: flat,
      differences: 0,
      entries: [],
    };
  });

  const allAccounting = roots.flatMap((root) => root.accounting);
  const nameMismatches = allAccounting.filter(
    (entry) =>
      entry.class === "mismatched" &&
      entry.channel === REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL,
  );

  const reproducesKnownHistoricalRefusal =
    options.revertB2jRoleOnlyNameRecovery === true &&
    nameMismatches.some(
      (entry) => entry.ownershipKey === "root" && entry.channel === "name",
    );

  return {
    artifactVersion: REPLAY_CENSUS_VERSION,
    archetype: "button",
    substrate: {
      kind: "observe-evidence",
      path: evidenceRoot,
    },
    predicts: "read-side tail only",
    doesNotPredict:
      "writer-side refusals and live observe transport. Substrate is a committed 0-write observe snapshot, not an extract transaction.",
    knownHistoricalRefusal: `root#${REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL} (B2j v4 role-only name recovery)`,
    reproducesKnownHistoricalRefusal,
    predictedNextLiveRefusal:
      nameMismatches[0] === undefined
        ? null
        : {
            source: roots.find((root) =>
              root.accounting.includes(nameMismatches[0]!),
            )!.source,
            path: nameMismatches[0]!.ownershipKey,
            property: nameMismatches[0]!.channel,
          },
    totalAccountingProblems: allAccounting.length,
    totalDifferences: 0,
    classFamilies: Object.entries(
      allAccounting.reduce<Record<string, number>>((into, entry) => {
        const key = `${entry.channel}:${entry.class}`;
        into[key] = (into[key] ?? 0) + 1;
        return into;
      }, {}),
    )
      .map(([key, count]) => {
        const [property, reason] = key.split(":");
        return {
          property: property ?? key,
          reason: "value" as const,
          count,
        };
      })
      .sort((left, right) => right.count - left.count),
    roots,
  };
}

export function buildReplayCensus(
  archetype: ReplayCensusArchetype,
  options: ReplayCensusOptions = {},
): ReplayCensus {
  switch (archetype) {
    case "table":
      return buildTableReplayCensus(
        options.substrate ?? "private/table-live-v27-transaction",
      );
    case "calendar":
      return buildCalendarReplayCensus(
        options.substrate ?? "private/calendar-live-v42-transaction",
        options,
      );
    case "button":
      return buildButtonReplayCensus(
        options.substrate ??
          "recipe/evidence/button-scene-inversion-v1",
        options,
      );
    default:
      throw new TypeError(`unsupported replay census archetype: ${archetype}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const archetype = (process.argv[2] ?? "table") as ReplayCensusArchetype;
  const substrateIndex = process.argv.indexOf("--substrate");
  const revert =
    process.argv.includes("--revert-teaching") ||
    process.argv.includes("--revert");
  const census = buildReplayCensus(archetype, {
    ...(substrateIndex >= 0 ? { substrate: process.argv[substrateIndex + 1] } : {}),
    ...(archetype === "calendar"
      ? { revertDayButtonBindingCompileOrder: revert }
      : {}),
    ...(archetype === "button"
      ? { revertB2jRoleOnlyNameRecovery: revert }
      : {}),
  });
  const out = `recipe/evidence/replay-census-${archetype}-v1.json`;
  console.log(`  archetype: ${census.archetype}`);
  console.log(
    `  reproduces known historical refusal: ${census.reproducesKnownHistoricalRefusal}`,
  );
  console.log(`  total IR differences: ${census.totalDifferences}`);
  console.log(`  total accounting problems: ${census.totalAccountingProblems}`);
  if (census.predictedNextLiveRefusal) {
    console.log(
      `  predicted next live refusal: ${census.predictedNextLiveRefusal.path} (${census.predictedNextLiveRefusal.property})`,
    );
  }
  for (const root of census.roots) {
    if (root.preDiffRefusal) {
      console.log(`  ${root.source}: BLOCKED BEFORE DIFF -- ${root.preDiffRefusal}`);
    } else {
      console.log(
        `  ${root.source}: ${root.differences} IR diffs, ${root.accountingProblems} accounting problems`,
      );
    }
  }
  writeFileSync(out, `${JSON.stringify(census, null, 2)}\n`);
  console.log(`replay census -> ${out}`);
}
