import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const V1 = "recipe/evidence/input-field-live-pivot-v1";
const V2 = "recipe/evidence/input-field-live-pivot-v2";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const objective = readJson(`${V1}/objective-canvas-result.json`);
const objectiveV2 = readJson(`${V2}/objective-canvas-result.json`);
const verification = readJson(`${V1}/live-verification.json`);
const readback = readJson(`${V1}/normalized-live-readback.json`);

const dimensions = [
  "library",
  "size",
  "state",
  "content",
  "required",
  "adornments",
] as const;
const axesOf = (cellKey: string): Record<string, string> => {
  const [library, ...parts] = cellKey.split("/");
  return {
    library,
    ...Object.fromEntries(parts.map((part) => part.split("="))),
  };
};
const summarize = (predicate: (row: Record<string, any>) => boolean) => {
  const rows = objective.rows.filter(predicate);
  return {
    count: rows.length,
    byAxis: Object.fromEntries(
      dimensions.map((dimension) => {
        const counts: Record<string, number> = {};
        for (const row of rows) {
          const value = axesOf(row.cellKey)[dimension]!;
          counts[value] = (counts[value] ?? 0) + 1;
        }
        return [dimension, counts];
      }),
    ),
    meanErrors: {
      geometry:
        rows.reduce(
          (sum: number, row: Record<string, any>) =>
            sum + row.metrics.geometryError,
          0,
        ) / Math.max(rows.length, 1),
      pixelInk:
        rows.reduce(
          (sum: number, row: Record<string, any>) =>
            sum + row.metrics.pixelInkCompositeError,
          0,
        ) / Math.max(rows.length, 1),
    },
    cells: rows.map((row: Record<string, any>) => ({
      cellKey: row.cellKey,
      geometryError: row.metrics.geometryError,
      pixelInkCompositeError: row.metrics.pixelInkCompositeError,
      referenceContentBox: row.metrics.retainedContentBox.reference,
      liveContentBox: row.metrics.retainedContentBox.candidate,
      referenceImageInk: row.metrics.nonzeroPixels.reference,
      liveImageInk: row.metrics.nonzeroPixels.candidate,
      exactDifference: row.metrics.normalizedPixelDifference.exact,
      perceptualDifference: row.metrics.normalizedPixelDifference.perceptual,
      normalizedInkCountDelta: row.metrics.normalizedInkCountDelta,
    })),
  };
};
const material = verification.validation.find((entry: Record<string, any>) =>
  entry.adapterIdentity.startsWith("material"),
);
const boundsFailures = material.cellFailures.filter(
  (cell: Record<string, any>) => !cell.bounds,
);
const boundsByAxis = Object.fromEntries(
  ["Size", "State", "Content", "Required", "Adornments"].map((axis) => [
    axis,
    Object.fromEntries(
      [
        ...new Set(
          boundsFailures.map((cell: Record<string, any>) =>
            cell.name
              .split(", ")
              .find((part: string) => part.startsWith(`${axis}=`))
              ?.slice(axis.length + 1),
          ),
        ),
      ].map((value) => [
        value,
        boundsFailures.filter((cell: Record<string, any>) =>
          cell.name.includes(`${axis}=${value}`),
        ).length,
      ]),
    ),
  ]),
);
const materialReadback = readback.find((entry: Record<string, any>) =>
  entry.adapterIdentity.startsWith("material"),
);
const materialRows = objective.rows.filter((row: Record<string, any>) =>
  row.cellKey.startsWith("mui/"),
);
const dimensionalDeltasByAxis = Object.fromEntries(
  ["size", "state", "content", "required", "adornments"].map((axis) => [
    axis,
    Object.fromEntries(
      [
        ...new Set(
          materialRows.map(
            (row: Record<string, any>) => axesOf(row.cellKey)[axis],
          ),
        ),
      ].map((value) => {
        const rows = materialRows.filter(
          (row: Record<string, any>) => axesOf(row.cellKey)[axis] === value,
        );
        return [
          value,
          {
            count: rows.length,
            meanWidthDelta:
              rows.reduce(
                (sum: number, row: Record<string, any>) =>
                  sum +
                  row.metrics.retainedContentBox.candidate.width -
                  row.metrics.retainedContentBox.reference.width,
                0,
              ) / rows.length,
            meanHeightDelta:
              rows.reduce(
                (sum: number, row: Record<string, any>) =>
                  sum +
                  row.metrics.retainedContentBox.candidate.height -
                  row.metrics.retainedContentBox.reference.height,
                0,
              ) / rows.length,
          },
        ];
      }),
    ),
  ]),
);
const floatingSceneFacts = materialReadback.liveFacts.map(
  (fact: Record<string, any>) => ({
    cell: fact.cell,
    width: fact.width,
    height: fact.height,
    layoutMode: fact.layoutMode,
    primaryAxisSizingMode: fact.primaryAxisSizingMode,
    roles: fact.roles,
    bindings: fact.bindings,
  }),
);
const diagnosis = {
  version: 2,
  kind: "input-field-live-v1-root-cause",
  immutableInputs: [
    `${V1}/receipt.json`,
    `${V1}/live-verification.json`,
    `${V1}/normalized-live-readback.json`,
    `${V1}/objective-canvas-result.json`,
    `${V1}/human-review-packet.json`,
  ].map((path) => ({
    path,
    bytes: readFileSync(path).byteLength,
    sha256: sha256(readFileSync(path)),
  })),
  denominators: {
    pairedCells: objective.denominator,
    liveVariants: verification.sets.reduce(
      (sum: number, set: Record<string, any>) => sum + set.variants,
      0,
    ),
    materialBounds: material.denominator,
    materialSceneFacts: floatingSceneFacts.length,
  },
  reflow: verification.probes.map((probe: Record<string, any>) => ({
    adapterIdentity: probe.adapterIdentity,
    ...probe.reflow,
    rootCause:
      probe.reflow.grownContentWidth === probe.reflow.beforeContentWidth
        ? "floating content text was converted to intrinsic width after the component text property reference; its content row filled, but the role leaf did not retain FILL"
        : null,
  })),
  materialBounds: {
    passed: material.boundsPasses,
    failed: boundsFailures.length,
    byAxis: boundsByAxis,
    rootCause:
      "the floating/notched label was represented as an ordinary in-flow row inside a fixed-height surface; active label plus content exceeded the declared surface/component box in 104 variants",
    sceneFacts: floatingSceneFacts,
  },
  materialDimensionalDeltasByAxis: dimensionalDeltasByAxis,
  geometryLosses: summarize(
    (row: Record<string, any>) => !row.geometryBeatsLegacy,
  ),
  pixelInkLosses: summarize(
    (row: Record<string, any>) => !row.pixelInkBeatsLegacy,
  ),
  v2RasterLosses: {
    geometry: Object.fromEntries(
      dimensions.map((dimension) => [
        dimension,
        Object.fromEntries(
          objectiveV2.rows
            .filter((row: Record<string, any>) => !row.geometryBeatsLegacy)
            .reduce((counts: Map<string, number>, row: Record<string, any>) => {
              const value = axesOf(row.cellKey)[dimension]!;
              counts.set(value, (counts.get(value) ?? 0) + 1);
              return counts;
            }, new Map<string, number>()),
        ),
      ]),
    ),
    pixelInk: Object.fromEntries(
      dimensions.map((dimension) => [
        dimension,
        Object.fromEntries(
          objectiveV2.rows
            .filter((row: Record<string, any>) => !row.pixelInkBeatsLegacy)
            .reduce((counts: Map<string, number>, row: Record<string, any>) => {
              const value = axesOf(row.cellKey)[dimension]!;
              counts.set(value, (counts.get(value) ?? 0) + 1);
              return counts;
            }, new Map<string, number>()),
        ),
      ]),
    ),
  },
  modelDefects: [
    {
      id: "floating-overlay-unmodeled",
      evidence:
        "input-field@1 encodes negative floating offsets as padding and the v1 writer clamps negative padding to zero; Plugin API output therefore cannot reproduce the declared notch/overlay geometry",
      fix: "add explicit recipe-owned overlay positioning with constraints and declared overhang; lower it to ABSOLUTE only for nodes carrying that primitive",
    },
    {
      id: "content-fill-lost-after-component-property",
      evidence:
        "MUI root and surface grew by 64px while content stayed 118px; Polaris content grew by 64px",
      fix: "reassert FILL sizing on content rows and role text after component-property references are attached",
    },
    {
      id: "font-and-capture-raster-drift",
      evidence:
        "complete pixel/ink losses are enumerated by source/state/axis below; exact and perceptual deltas remain nonzero even where geometry wins",
      fix: "record resolved font metrics and refuse a fallback whose measured glyph geometry differs from adapter-declared reference metrics beyond explicit tolerances",
    },
  ],
  hardStopEvaluation: {
    sourceSpecificGenericBranchRequired: false,
    reason:
      "all defects are selected by generic structure/sizing/font parameters already supplied by explicit adapters",
  },
};
mkdirSync(V2, { recursive: true });
writeFileSync(
  `${V2}/v1-root-cause.json`,
  `${JSON.stringify(diagnosis, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    path: `${V2}/v1-root-cause.json`,
    geometryLosses: diagnosis.geometryLosses.byAxis,
    pixelInkLosses: diagnosis.pixelInkLosses.byAxis,
    bounds: diagnosis.materialBounds.byAxis,
    reflow: diagnosis.reflow,
  }),
);
