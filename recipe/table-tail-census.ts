/**
 * Table tail census -- measurement only, zero Figma writes.
 *
 * `collapseTableRecipe` refuses on the FIRST divergence between the recompiled
 * IR and the IR derived from the live scene (`firstDifference`,
 * `recipe/recipes/table.ts`). That is correct for the live path -- a refusal
 * must be unambiguous -- but it means each live PREPARE/AUTHORIZE/attempt/RECORD
 * cycle can only ever reveal one `(role, property)` gap, so the remaining depth
 * of the climb is unknown.
 *
 * The comparator runs Node-side, after the fact, over a persisted response.
 * Every live attempt already persists its raw extract under
 * `private/table-live-vNN-transaction/004-extract.raw.json`. Replaying that
 * response through the CURRENT host-normalize and collecting every difference
 * instead of the first enumerates the remaining tail in one offline pass.
 *
 * HONEST LIMIT -- state this wherever the census is cited:
 * the substrate was captured under its own version's WRITER. Every teaching
 * from v9 through v24 is read-side (host-normalize / extract); extract bytes
 * have been unchanged since v21 (`scene-readback-runtime-table-v24.ts`). So
 * this census predicts the EXTRACT-SIDE tail only. A writer-side refusal --
 * the class that stopped v1 through v4 -- would still surface only in a live
 * run. This tool does not enumerate those and must not be read as if it did.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { adaptReviewedTable } from "./adapters/table.js";
import {
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
  muiTableAdapterConfig,
  muiTableSource,
} from "./fixtures/library-tables.js";
import {
  compileTableRecipe,
  collapseTableRecipe,
  type TableIrDifference,
} from "./recipes/table.js";
import { hashRecipeEnvelope } from "./hash.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  sceneToNormalizedIr,
} from "./scene-readback-table-v1.js";
import {
  validateTableLiveV24ExtractPayload,
  type TableLiveV24WriterOwnership,
} from "./table-live-v24-contract.js";
import { normalizeTableLiveV24Scene } from "./table-live-v24-verifier.js";

export const TABLE_TAIL_CENSUS_VERSION = "table-tail-census-v1";

/** The refusal v23 actually reported. The census must re-derive it. */
export const TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL = "$.children[1].label";

/**
 * Newest captured live extract. A substrate is only valid for the WRITER that
 * produced it: a writer change (node names, structure) invalidates it, and only
 * a fresh live run restores it. Point `--transaction` elsewhere to compare.
 */
export const TABLE_TAIL_CENSUS_DEFAULT_SUBSTRATE =
  "private/table-live-v27-transaction";

export interface TableTailCensusEntry {
  path: string;
  reason: TableIrDifference["reason"];
  role: string | null;
  parentRole: string | null;
  property: string;
  /** Present only when the compiled side has the fact. */
  compiled?: unknown;
  /** Present only when the observed (live) side has the fact. */
  observed?: unknown;
}

export interface TableTailCensusRoot {
  source: string;
  adapterIdentity: string;
  /**
   * A root can stop BEFORE the IR diff: `collapseTableRecipe` derives the
   * instance first, and that derivation has its own refusals (required
   * bindings, ARIA/data model, axis completeness). When that happens the
   * difference tail for this root is not yet observable, and this field names
   * the blocker instead. Reported, never silently swallowed.
   */
  preDiffRefusal: string | null;
  /**
   * The extract gate has TWO comparisons, and the fixed-point IR diff is only
   * the first. `assertTableLiveVNRootProofs` then runs independent root
   * accounting (`compareSceneToExpectedPlan`) over the expected scene plan.
   * Table live v25 failed there with 2 mismatches per root AFTER the IR diff
   * reached zero, so a census that measured only the IR diff was incomplete.
   * Both are measured here now.
   */
  accounting: Array<{
    kind: "table" | "row" | "cell";
    missing: number;
    extra: number;
    mismatched: number;
    entries: Array<{
      class: "missing" | "extra" | "mismatched";
      ownershipKey: string;
      channel: string;
      expected?: unknown;
      observed?: unknown;
    }>;
  }>;
  accountingProblems: number;
  differences: number;
  entries: TableTailCensusEntry[];
  classes: Array<{ role: string | null; property: string; count: number }>;
}

export interface TableTailCensus {
  artifactVersion: typeof TABLE_TAIL_CENSUS_VERSION;
  substrate: {
    transactionDir: string;
    extractRawBytes: number;
    pageId: string;
    variableTableEntries: number;
  };
  predicts: "extract-side tail only";
  doesNotPredict: string;
  reproducesKnownV23Refusal: boolean;
  totalAccountingProblems: number;
  /**
   * `firstDifference` walks depth-first with sorted keys and returns on the
   * first hit, and `allDifferences` walks identically while collecting. So the
   * first entry of the first root that reaches the diff is the path the NEXT
   * live attempt should refuse at. Recorded before the run so the attempt is a
   * falsifiable predicted-vs-actual test of this instrument, not a narrative
   * written afterwards.
   */
  predictedNextLiveRefusal: {
    source: string;
    path: string;
    role: string | null;
    property: string;
  } | null;
  totalDifferences: number;
  /**
   * Measured rollup across roots: one row per `(property, reason)` with the
   * roles it was observed on. Grouping only -- no interpretation, no invented
   * teaching. Each row is a candidate for ONE PREPARE, in the doctrine's
   * one-teaching-per-version sense.
   */
  classFamilies: Array<{
    property: string;
    reason: TableIrDifference["reason"];
    count: number;
    roles: string[];
  }>;
  roots: TableTailCensusRoot[];
}

const sourceDescriptors = () =>
  [
    {
      source: "first-party" as const,
      adapterIdentity: "first-party-table-reviewed-v1",
      reviewed: firstPartyTableSource,
      config: firstPartyTableAdapterConfig,
    },
    {
      source: "mui" as const,
      adapterIdentity: "material-table-reviewed-v1",
      reviewed: muiTableSource,
      config: muiTableAdapterConfig,
    },
  ].map((descriptor) => {
    const instance = adaptReviewedTable(descriptor.reviewed, descriptor.config);
    return {
      ...descriptor,
      instance,
      envelope: compileTableRecipe(instance),
      selection: (instance as { provenance?: { selection?: unknown } })
        .provenance?.selection,
    };
  });

/** Walk an IR tree along a `$.children[i].prop` path and report the roles. */
const resolveRoles = (
  root: unknown,
  path: string,
): { role: string | null; parentRole: string | null; property: string } => {
  const steps = path
    .replace(/^\$/, "")
    .split(/(?=\[)|\./)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  let node: any = root;
  let role: string | null = (node && node.role) ?? null;
  let parentRole: string | null = null;
  let property = "";
  for (const step of steps) {
    const index = step.match(/^\[(\d+)\]$/);
    const next = index ? node?.[Number(index[1])] : node?.[step];
    if (
      next &&
      typeof next === "object" &&
      !Array.isArray(next) &&
      "role" in next
    ) {
      parentRole = role;
      role = (next.role as string) ?? null;
      property = "";
    } else if (!index) {
      property = property ? `${property}.${step}` : step;
    }
    node = next;
    if (node === undefined) break;
  }
  return { role, parentRole, property: property || "(node)" };
};

export function buildTableTailCensus(
  transactionDir = TABLE_TAIL_CENSUS_DEFAULT_SUBSTRATE,
): TableTailCensus {
  const rawText = readFileSync(
    `${transactionDir}/004-extract.raw.json`,
    "utf8",
  );
  const raw = JSON.parse(rawText) as { result?: { payload?: unknown } };
  const ownership = JSON.parse(
    readFileSync(`${transactionDir}/writer-ownership.json`, "utf8"),
  ) as TableLiveV24WriterOwnership;

  const extract = validateTableLiveV24ExtractPayload(
    raw.result?.payload,
    ownership,
  );
  const sources = sourceDescriptors();

  const roots: TableTailCensusRoot[] = sources.map((source) => {
    const root = extract.roots.find(
      (candidate) =>
        candidate.source === source.source &&
        candidate.adapterIdentity === source.adapterIdentity,
    );
    if (!root)
      throw new TypeError(
        `table tail census: extract omitted ${source.source}`,
      );

    const tableIr = sceneToNormalizedIr(
      normalizeTableLiveV24Scene(root.tableScene, extract.variableTable).scene,
    );
    const rowIr = sceneToNormalizedIr(
      normalizeTableLiveV24Scene(root.rowScene, extract.variableTable).scene,
    );
    const cellIr = sceneToNormalizedIr(
      normalizeTableLiveV24Scene(root.cellScene, extract.variableTable).scene,
    );

    const observed = structuredClone(source.envelope);
    if (observed.ir.kind !== "frame")
      throw new TypeError(
        "table tail census: compile root must be library frame",
      );
    observed.ir = { ...observed.ir, children: [tableIr, rowIr, cellIr] };
    observed.integrity.canonicalHash = hashRecipeEnvelope(observed);

    const accounting: TableTailCensusRoot["accounting"] = [];
    for (const [kind, compiledRole, scene] of [
      ["table", "table/set", root.tableScene],
      ["row", "table/row-set", root.rowScene],
      ["cell", "table/cell-set", root.cellScene],
    ] as const) {
      const compiledSet = (source.envelope.ir as any).children.find(
        (child: any) => child.role === compiledRole,
      );
      if (!compiledSet) continue;
      const comparison: any = compareSceneToExpectedPlan(
        compileExpectedScenePlan(compiledSet, { rootOwnershipKey: kind }),
        normalizeTableLiveV24Scene(scene, extract.variableTable).scene,
      );
      const entries: TableTailCensusRoot["accounting"][number]["entries"] = [];
      for (const group of ["missing", "extra", "mismatched"] as const)
        for (const entry of comparison[group] ?? [])
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
      accounting.push({
        kind,
        missing: comparison.missing?.length ?? 0,
        extra: comparison.extra?.length ?? 0,
        mismatched: comparison.mismatched?.length ?? 0,
        entries,
      });
    }

    const sink: TableIrDifference[] = [];
    let preDiffRefusal: string | null = null;
    try {
      collapseTableRecipe(observed, source.selection, sink);
    } catch (error) {
      preDiffRefusal = error instanceof Error ? error.message : String(error);
      sink.length = 0;
    }

    const entries: TableTailCensusEntry[] = sink.map((difference) => {
      const located = resolveRoles(observed.ir, difference.path);
      return {
        path: difference.path,
        reason: difference.reason,
        role: located.role,
        parentRole: located.parentRole,
        property: located.property,
        ...(difference.left === undefined ? {} : { compiled: difference.left }),
        ...(difference.right === undefined
          ? {}
          : { observed: difference.right }),
      };
    });

    const grouped = new Map<
      string,
      { role: string | null; property: string; count: number }
    >();
    for (const entry of entries) {
      const key = `${entry.role} ${entry.property}`;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else
        grouped.set(key, {
          role: entry.role,
          property: entry.property,
          count: 1,
        });
    }

    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      preDiffRefusal,
      accounting,
      accountingProblems: accounting.reduce(
        (total, row) => total + row.missing + row.extra + row.mismatched,
        0,
      ),
      differences: entries.length,
      entries,
      classes: [...grouped.values()].sort(
        (a, b) => b.count - a.count || `${a.role}`.localeCompare(`${b.role}`),
      ),
    };
  });

  const allPaths = roots.flatMap((root) =>
    root.entries.map((entry) => entry.path),
  );

  const families = new Map<
    string,
    {
      property: string;
      reason: TableIrDifference["reason"];
      count: number;
      roles: Set<string>;
    }
  >();
  for (const root of roots)
    for (const entry of root.entries) {
      const key = `${entry.property}\u0000${entry.reason}`;
      const existing = families.get(key);
      if (existing) {
        existing.count += 1;
        existing.roles.add(entry.role ?? "(root)");
      } else
        families.set(key, {
          property: entry.property,
          reason: entry.reason,
          count: 1,
          roles: new Set([entry.role ?? "(root)"]),
        });
    }

  return {
    artifactVersion: TABLE_TAIL_CENSUS_VERSION,
    substrate: {
      transactionDir,
      extractRawBytes: rawText.length,
      pageId: extract.pageId,
      variableTableEntries: extract.variableTable.length,
    },
    predicts: "extract-side tail only",
    doesNotPredict:
      "writer-side refusals (the class that stopped v1-v4). The substrate was captured under its own version's writer; teachings v9-v24 are read-side only.",
    reproducesKnownV23Refusal: allPaths.includes(
      TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL,
    ),
    predictedNextLiveRefusal: (() => {
      const reached = roots.find(
        (root) => root.preDiffRefusal === null && root.entries.length > 0,
      );
      if (!reached) return null;
      const first = reached.entries[0]!;
      return {
        source: reached.source,
        path: first.path,
        role: first.role,
        property: first.property,
      };
    })(),
    totalAccountingProblems: roots.reduce(
      (total, root) => total + root.accountingProblems,
      0,
    ),
    totalDifferences: allPaths.length,
    classFamilies: [...families.values()]
      .map((family) => ({
        property: family.property,
        reason: family.reason,
        count: family.count,
        roles: [...family.roles].sort(),
      }))
      .sort(
        (a, b) => b.count - a.count || a.property.localeCompare(b.property),
      ),
    roots,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirArgument = process.argv.indexOf("--transaction");
  const census = buildTableTailCensus(
    dirArgument >= 0 ? process.argv[dirArgument + 1] : undefined,
  );
  const out = "recipe/evidence/table-tail-census-v1.json";
  console.log(
    `  reproduces known v23 refusal ${TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL}: ${census.reproducesKnownV23Refusal}`,
  );
  console.log(`  total IR differences: ${census.totalDifferences}`);
  console.log(`  total accounting problems: ${census.totalAccountingProblems}`);
  for (const root of census.roots)
    for (const row of root.accounting)
      for (const entry of row.entries)
        console.log(
          `    ${root.source}/${row.kind} ${entry.class} ${entry.ownershipKey}#${entry.channel}` +
            `\n       expected ${JSON.stringify(entry.expected)}` +
            `\n       observed ${JSON.stringify(entry.observed)}`,
        );
  if (census.predictedNextLiveRefusal)
    console.log(
      `  predicted next live refusal: ${census.predictedNextLiveRefusal.path} (${census.predictedNextLiveRefusal.role} . ${census.predictedNextLiveRefusal.property})`,
    );
  for (const root of census.roots) {
    if (root.preDiffRefusal) {
      console.log(
        `  ${root.source}: BLOCKED BEFORE DIFF -- ${root.preDiffRefusal}`,
      );
      continue;
    }
    console.log(`  ${root.source}: ${root.differences} differences`);
    for (const cls of root.classes)
      console.log(
        `    ${cls.count.toString().padStart(4)}  ${cls.role ?? "(root)"} . ${cls.property}`,
      );
  }
  // Prettier-compatible: `recipe/evidence/*.json` is covered by format:check.
  writeFileSync(out, `${JSON.stringify(census, null, 2)}\n`);
  console.log(`table tail census -> ${out}`);
}
