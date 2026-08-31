import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { canonicalJson } from "./normalize.js";

export const RECIPE_RASTER_CALIBRATION_VERSION =
  "recipe-browser-figma-raster-calibration-v1";

export const RECIPE_RASTER_CALIBRATION_BOUNDS = Object.freeze({
  fontSizeScale: Object.freeze({ minimum: 0.98, maximum: 1.02 }),
  lineHeightScale: Object.freeze({ minimum: 0.97, maximum: 1.03 }),
  letterSpacingPx: Object.freeze({ minimum: -0.35, maximum: 0.35 }),
  rgbLevels: Object.freeze({ minimum: 64, maximum: 256 }),
});

export const RECIPE_RASTER_METRIC = Object.freeze({
  version: "recipe-browser-figma-raster-metric-v1",
  exactWeight: 0.5,
  perceptualWeight: 0.4,
  inkWeight: 0.1,
  perceptualThreshold: 0.1,
  inkChannelCutoff: 250,
  catastrophicMultiplier: 1.5,
  catastrophicAllowance: 0.02,
});

export type CalibrationSplit = "training" | "validation";
export type CalibrationSizing =
  { mode: "fixed"; value: number } | { mode: "hug" } | { mode: "fill" };
export type CalibrationFamily =
  | "text"
  | "auto-layout"
  | "adornment"
  | "surface"
  | "overlay"
  | "state-ring"
  | "dimension";

export interface CalibrationPaint {
  color: string;
  opacity?: number;
}

interface CalibrationBaseNode {
  id: string;
  opacity?: number;
  positioning?: { mode: "absolute"; x: number; y: number };
}

export interface CalibrationTextNode extends CalibrationBaseNode {
  kind: "text";
  characters: string;
  font: {
    family: "Inter" | "Roboto";
    style: "Regular" | "Medium";
    size: number;
    lineHeight: number;
  };
  color: string;
  width: CalibrationSizing;
}

export interface CalibrationRectNode extends CalibrationBaseNode {
  kind: "rect";
  width: CalibrationSizing;
  height: CalibrationSizing;
  fill: CalibrationPaint;
  stroke?: { weight: number; color: string; opacity?: number };
  radius?: number;
}

export interface CalibrationInstanceNode extends CalibrationBaseNode {
  kind: "instance";
  componentRef: "square-adornment" | "text-adornment";
  characters: string;
  width: CalibrationSizing;
  height: CalibrationSizing;
  fill: CalibrationPaint;
}

export interface CalibrationFrameNode extends CalibrationBaseNode {
  kind: "frame";
  layout: {
    mode: "horizontal" | "vertical" | "none";
    width: CalibrationSizing;
    height: CalibrationSizing;
    gap: number;
    padding: { top: number; right: number; bottom: number; left: number };
    primary: "min" | "center" | "max" | "space-between";
    counter: "min" | "center" | "max";
  };
  fill: CalibrationPaint;
  stroke?: { weight: number; color: string; opacity?: number };
  radius?: number;
  effect?: {
    kind: "outer-ring";
    spread: number;
    color: string;
    opacity?: number;
  };
  clipsContent?: boolean;
  children: CalibrationNode[];
}

export type CalibrationNode =
  | CalibrationTextNode
  | CalibrationRectNode
  | CalibrationInstanceNode
  | CalibrationFrameNode;

export interface CalibrationSpecimen {
  id: string;
  split: CalibrationSplit;
  family: CalibrationFamily;
  capture: { width: number; height: number; background: string; scale: 2 };
  root: CalibrationFrameNode;
}

const fixed = (value: number): CalibrationSizing => ({ mode: "fixed", value });
const hug = (): CalibrationSizing => ({ mode: "hug" });
const fill = (): CalibrationSizing => ({ mode: "fill" });
const clear: CalibrationPaint = { color: "#ffffff", opacity: 0 };
const white: CalibrationPaint = { color: "#ffffff" };
const pad = (top = 0, right = 0, bottom = 0, left = 0) => ({
  top,
  right,
  bottom,
  left,
});

const text = (
  id: string,
  characters: string,
  family: CalibrationTextNode["font"]["family"],
  style: CalibrationTextNode["font"]["style"],
  size: number,
  lineHeight: number,
  width: CalibrationSizing = hug(),
): CalibrationTextNode => ({
  id,
  kind: "text",
  characters,
  font: { family, style, size, lineHeight },
  color: "#263238",
  width,
});

const rect = (
  id: string,
  width: number,
  height: number,
  fillPaint: CalibrationPaint,
  radius = 0,
  stroke?: CalibrationRectNode["stroke"],
): CalibrationRectNode => ({
  id,
  kind: "rect",
  width: fixed(width),
  height: fixed(height),
  fill: fillPaint,
  radius,
  stroke,
});

const instance = (
  id: string,
  componentRef: CalibrationInstanceNode["componentRef"],
  characters: string,
  width: CalibrationSizing,
  height: CalibrationSizing,
  fillPaint: CalibrationPaint,
): CalibrationInstanceNode => ({
  id,
  kind: "instance",
  componentRef,
  characters,
  width,
  height,
  fill: fillPaint,
});

type FrameOptions = Partial<
  Omit<CalibrationFrameNode, "id" | "kind" | "children" | "layout">
> & {
  layout?: Partial<CalibrationFrameNode["layout"]>;
};

const frame = (
  id: string,
  children: CalibrationNode[],
  options: FrameOptions = {},
): CalibrationFrameNode => ({
  id,
  kind: "frame",
  layout: {
    mode: "horizontal",
    width: hug(),
    height: hug(),
    gap: 0,
    padding: pad(),
    primary: "min",
    counter: "center",
    ...options.layout,
  },
  fill: options.fill ?? clear,
  stroke: options.stroke,
  radius: options.radius,
  effect: options.effect,
  clipsContent: options.clipsContent,
  opacity: options.opacity,
  positioning: options.positioning,
  children,
});

const CAPTURE = {
  width: 320,
  height: 160,
  background: "#ffffff",
  scale: 2,
} as const;
const specimen = (
  id: string,
  split: CalibrationSplit,
  family: CalibrationFamily,
  root: CalibrationFrameNode,
): CalibrationSpecimen => ({ id, split, family, capture: CAPTURE, root });

const simpleText = (
  id: string,
  split: CalibrationSplit,
  characters: string,
  family: CalibrationTextNode["font"]["family"],
  style: CalibrationTextNode["font"]["style"],
  size: number,
  lineHeight: number,
) =>
  specimen(
    id,
    split,
    "text",
    frame("root", [text("copy", characters, family, style, size, lineHeight)]),
  );

const fillLayout = (
  id: string,
  split: CalibrationSplit,
  family: "Inter" | "Roboto",
) =>
  specimen(
    id,
    split,
    "auto-layout",
    frame(
      "root",
      [
        text(
          "fixed",
          split === "training" ? "A7" : "Q",
          family,
          "Medium",
          12,
          17,
        ),
        text(
          "fill",
          split === "training"
            ? "Flexible center rail"
            : "Held flexible measure",
          family,
          "Regular",
          13,
          19,
          fill(),
        ),
      ],
      {
        layout: {
          width: fixed(split === "training" ? 238 : 226),
          height: fixed(split === "training" ? 38 : 39),
          gap: split === "training" ? 9 : 6,
          padding: split === "training" ? pad(7, 13, 6, 11) : pad(8, 15, 5, 10),
        },
        fill: { color: "#f3f5f7" },
      },
    ),
  );

const adornmentPair = (id: string, split: CalibrationSplit) =>
  specimen(
    id,
    split,
    "adornment",
    frame(
      "root",
      [
        instance(
          "leading",
          split === "training" ? "square-adornment" : "text-adornment",
          split === "training" ? "L" : "IN",
          split === "training" ? fixed(18) : hug(),
          split === "training" ? fixed(18) : hug(),
          { color: "#607d8b" },
        ),
        text(
          "copy",
          split === "training" ? "Paired rail" : "Held rail",
          "Inter",
          "Regular",
          13,
          18,
          fill(),
        ),
        instance(
          "trailing",
          split === "training" ? "text-adornment" : "square-adornment",
          split === "training" ? "TR" : "R",
          split === "training" ? hug() : fixed(16),
          split === "training" ? hug() : fixed(16),
          { color: "#455a64" },
        ),
      ],
      {
        layout: {
          width: fixed(split === "training" ? 244 : 232),
          height: fixed(split === "training" ? 42 : 40),
          gap: split === "training" ? 8 : 7,
          padding: split === "training" ? pad(9, 10, 7, 14) : pad(6, 12, 9, 8),
        },
        fill: white,
        stroke: { weight: 1, color: "#90a4ae" },
        radius: split === "training" ? 5 : 6,
      },
    ),
  );

const floatingOverlay = (id: string, split: CalibrationSplit) =>
  specimen(
    id,
    split,
    "overlay",
    frame(
      "root",
      [
        text(
          "body",
          split === "training" ? "Lower channel" : "Interior line",
          split === "training" ? "Inter" : "Roboto",
          "Regular",
          14,
          20,
        ),
        frame(
          "overlay",
          [
            text(
              "label",
              split === "training" ? "Upper marker" : "Held notch",
              split === "training" ? "Inter" : "Roboto",
              "Medium",
              split === "training" ? 11 : 10,
              split === "training" ? 14 : 13,
            ),
          ],
          {
            layout: {
              padding: split === "training" ? pad(0, 4, 0, 4) : pad(0, 5, 0, 5),
            },
            fill: white,
            positioning: {
              mode: "absolute",
              x: split === "training" ? 10 : 14,
              y: split === "training" ? -7 : -6,
            },
          },
        ),
      ],
      {
        layout: {
          width: fixed(split === "training" ? 210 : 202),
          height: fixed(split === "training" ? 48 : 46),
          padding:
            split === "training" ? pad(13, 12, 8, 12) : pad(12, 9, 9, 13),
        },
        fill: white,
        stroke: { weight: 1, color: "#607d8b" },
        radius: split === "training" ? 4 : 5,
        clipsContent: false,
      },
    ),
  );

export const RECIPE_RASTER_CALIBRATION_CORPUS: readonly CalibrationSpecimen[] =
  Object.freeze([
    simpleText(
      "text-a1",
      "training",
      "Harbor signal",
      "Inter",
      "Regular",
      11,
      15,
    ),
    simpleText(
      "text-a2",
      "training",
      "Quiet geometry",
      "Inter",
      "Medium",
      13,
      18,
    ),
    simpleText(
      "text-a3",
      "training",
      "Measured rhythm",
      "Inter",
      "Regular",
      16,
      23,
    ),
    simpleText(
      "text-b1",
      "training",
      "Copper lattice",
      "Roboto",
      "Regular",
      12,
      17,
    ),
    simpleText(
      "text-b2",
      "training",
      "Seven notches",
      "Roboto",
      "Medium",
      14,
      20,
    ),
    simpleText(
      "text-b3",
      "training",
      "Parallel current",
      "Roboto",
      "Regular",
      17,
      25,
    ),
    fillLayout("layout-fill-a", "training", "Inter"),
    specimen(
      "layout-hug-a",
      "training",
      "auto-layout",
      frame(
        "root",
        [
          text("first", "North", "Roboto", "Regular", 13, 18),
          text("second", "Eastward", "Roboto", "Medium", 13, 18),
        ],
        {
          layout: { gap: 7, padding: pad(5, 12, 8, 9) },
          fill: { color: "#f8fafb" },
        },
      ),
    ),
    adornmentPair("adornment-pair-a", "training"),
    specimen(
      "padding-asymmetric-a",
      "training",
      "auto-layout",
      frame(
        "root",
        [text("copy", "Offset chamber", "Roboto", "Regular", 14, 19)],
        {
          layout: { gap: 3, padding: pad(4, 19, 11, 7) },
          fill: { color: "#eceff1" },
        },
      ),
    ),
    specimen(
      "surface-stroke-a",
      "training",
      "surface",
      frame(
        "root",
        [
          rect("swatch", 56, 26, { color: "#81d4fa", opacity: 0.62 }, 6, {
            weight: 1,
            color: "#0277bd",
            opacity: 0.84,
          }),
        ],
        {
          layout: { padding: pad(7, 9, 5, 12) },
          fill: { color: "#fafafa" },
        },
      ),
    ),
    floatingOverlay("overlay-label-a", "training"),
    specimen(
      "state-ring-a",
      "training",
      "state-ring",
      frame(
        "root",
        [text("copy", "Active plane", "Roboto", "Medium", 14, 20)],
        {
          layout: {
            width: fixed(176),
            height: fixed(40),
            padding: pad(8, 12, 7, 12),
          },
          fill: white,
          stroke: { weight: 1, color: "#3f51b5" },
          radius: 7,
          effect: {
            kind: "outer-ring",
            spread: 2,
            color: "#90caf9",
            opacity: 0.74,
          },
        },
      ),
    ),
    specimen(
      "state-border-a",
      "training",
      "state-ring",
      frame("root", [text("copy", "Alert plane", "Inter", "Regular", 13, 18)], {
        layout: {
          width: fixed(164),
          height: fixed(36),
          padding: pad(7, 10, 6, 10),
        },
        fill: { color: "#fff8f7" },
        stroke: { weight: 1, color: "#c62828" },
        radius: 3,
      }),
    ),
    specimen(
      "dimension-small-a",
      "training",
      "dimension",
      frame(
        "root",
        [
          rect("block", 96, 28, { color: "#c5e1a5" }, 2),
          text("copy", "Compact", "Inter", "Medium", 11, 15),
        ],
        {
          layout: { gap: 5, padding: pad(3, 6, 4, 8) },
        },
      ),
    ),
    specimen(
      "dimension-medium-a",
      "training",
      "dimension",
      frame(
        "root",
        [
          rect("block", 132, 44, { color: "#ffe082", opacity: 0.78 }, 8, {
            weight: 1,
            color: "#ff8f00",
          }),
          text("copy", "Measured", "Roboto", "Regular", 15, 22),
        ],
        {
          layout: { gap: 10, padding: pad(6, 11, 9, 5) },
        },
      ),
    ),
    simpleText(
      "text-held-a",
      "validation",
      "Winter aperture",
      "Inter",
      "Regular",
      12,
      16,
    ),
    simpleText(
      "text-held-b",
      "validation",
      "Oblique cadence",
      "Roboto",
      "Medium",
      15,
      22,
    ),
    fillLayout("layout-fill-held", "validation", "Roboto"),
    adornmentPair("adornment-held", "validation"),
    specimen(
      "surface-held",
      "validation",
      "surface",
      frame(
        "root",
        [
          rect("swatch", 72, 31, { color: "#ce93d8", opacity: 0.57 }, 9, {
            weight: 1,
            color: "#6a1b9a",
            opacity: 0.8,
          }),
          text("copy", "Surface", "Roboto", "Regular", 12, 17),
        ],
        {
          layout: { gap: 8, padding: pad(5, 14, 7, 9) },
          fill: { color: "#fcfcfd" },
        },
      ),
    ),
    floatingOverlay("overlay-held", "validation"),
    specimen(
      "ring-held",
      "validation",
      "state-ring",
      frame("root", [text("copy", "Held active", "Inter", "Medium", 13, 18)], {
        layout: {
          width: fixed(168),
          height: fixed(38),
          padding: pad(7, 13, 8, 9),
        },
        fill: white,
        stroke: { weight: 1, color: "#00695c" },
        radius: 4,
        effect: {
          kind: "outer-ring",
          spread: 2,
          color: "#80cbc4",
          opacity: 0.68,
        },
      }),
    ),
    specimen(
      "dimension-held",
      "validation",
      "dimension",
      frame(
        "root",
        [
          rect("small", 88, 25, { color: "#b3e5fc" }, 3),
          text("copy", "Held medium", "Roboto", "Regular", 16, 23),
        ],
        {
          layout: { gap: 9, padding: pad(4, 7, 10, 12) },
        },
      ),
    ),
  ]);

export const RECIPE_RASTER_CALIBRATION_CORPUS_HASH = createHash("sha256")
  .update(
    canonicalJson(
      JSON.parse(JSON.stringify(RECIPE_RASTER_CALIBRATION_CORPUS)) as unknown,
    ),
  )
  .digest("hex");
export const RECIPE_RASTER_METRIC_HASH = createHash("sha256")
  .update(canonicalJson(RECIPE_RASTER_METRIC))
  .digest("hex");

const walkCalibrationNode = (
  node: CalibrationNode,
  visit: (candidate: CalibrationNode) => void,
): void => {
  visit(node);
  if (node.kind === "frame") {
    for (const child of node.children) walkCalibrationNode(child, visit);
  }
};

export function requiredCalibrationFonts(): Array<{
  family: string;
  style: string;
}> {
  const fonts = new Map<string, { family: string; style: string }>();
  for (const specimen of RECIPE_RASTER_CALIBRATION_CORPUS) {
    walkCalibrationNode(specimen.root, (node) => {
      if (node.kind !== "text") return;
      fonts.set(`${node.font.family}\0${node.font.style}`, {
        family: node.font.family,
        style: node.font.style,
      });
    });
  }
  return [...fonts.values()].sort((left, right) =>
    `${left.family}/${left.style}`.localeCompare(
      `${right.family}/${right.style}`,
      "en",
    ),
  );
}

export function assertCalibrationFontsAvailable(
  available: readonly { family: string; style: string }[],
): void {
  const keys = new Set(
    available.map((font) => `${font.family}\0${font.style}`),
  );
  for (const font of requiredCalibrationFonts()) {
    assert.ok(
      keys.has(`${font.family}\0${font.style}`),
      `MISSING-CALIBRATION-FONT:${font.family}/${font.style}`,
    );
  }
}

export interface CalibrationGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalibrationRender {
  specimenId: string;
  split: CalibrationSplit;
  png: Buffer;
  root: CalibrationGeometry;
  roles: Record<string, CalibrationGeometry>;
  text: Array<{
    id: string;
    characters: string;
    geometry: CalibrationGeometry;
    resolvedFamily: string;
    resolvedStyle: string;
  }>;
  structureHash: string;
}

export interface RecipeRasterCalibration {
  version: typeof RECIPE_RASTER_CALIBRATION_VERSION;
  corpusHash: typeof RECIPE_RASTER_CALIBRATION_CORPUS_HASH;
  metricHash: typeof RECIPE_RASTER_METRIC_HASH;
  writer: {
    fontSizeScale: number;
    lineHeightScale: number;
    letterSpacingPx: number;
  };
  capture: { rgbLevels: number };
  bounds: typeof RECIPE_RASTER_CALIBRATION_BOUNDS;
  provenance: {
    derivedFrom: "training-only";
    trainingIds: string[];
    validationIdsLockedBeforeMeasurement: string[];
  };
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));
const mean = (values: number[]): number => {
  assert.ok(values.length > 0, "ZERO-COUNT-CALIBRATION-SAMPLE");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
const median = (values: number[]): number => {
  assert.ok(values.length > 0, "ZERO-COUNT-CALIBRATION-SAMPLE");
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
};

export function quantizeCapture(bytes: Buffer, levels: number): Buffer {
  assert.ok(
    Number.isInteger(levels) &&
      levels >= RECIPE_RASTER_CALIBRATION_BOUNDS.rgbLevels.minimum &&
      levels <= RECIPE_RASTER_CALIBRATION_BOUNDS.rgbLevels.maximum,
    "EXTREME-CAPTURE-COEFFICIENT",
  );
  const png = PNG.sync.read(bytes);
  const denominator = levels - 1;
  for (let index = 0; index < png.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = index + channel;
      png.data[offset] = Math.round(
        (Math.round((png.data[offset]! * denominator) / 255) * 255) /
          denominator,
      );
    }
  }
  return PNG.sync.write(png);
}

interface InkFacts {
  count: number;
  box: null | { x: number; y: number; width: number; height: number };
}

const inkFacts = (png: PNG): InkFacts => {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      if (
        png.data[offset]! >= RECIPE_RASTER_METRIC.inkChannelCutoff &&
        png.data[offset + 1]! >= RECIPE_RASTER_METRIC.inkChannelCutoff &&
        png.data[offset + 2]! >= RECIPE_RASTER_METRIC.inkChannelCutoff
      ) {
        continue;
      }
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    count,
    box:
      maxX < 0
        ? null
        : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
};

const whiteCanvas = (width: number, height: number): PNG => {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return png;
};

const blit = (
  target: PNG,
  source: PNG,
  box: NonNullable<InkFacts["box"]>,
): void => {
  const xOffset = Math.floor((target.width - box.width) / 2);
  const yOffset = Math.floor((target.height - box.height) / 2);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const sourceOffset = ((box.y + y) * source.width + box.x + x) * 4;
      const targetOffset = ((yOffset + y) * target.width + xOffset + x) * 4;
      source.data.copy(
        target.data,
        targetOffset,
        sourceOffset,
        sourceOffset + 4,
      );
    }
  }
};

export interface CalibrationPairMetrics {
  valid: boolean;
  geometryError: number;
  pixelInkError: number;
  exact: number;
  perceptual: number;
  inkDelta: number;
}

export function measureCalibrationPair(
  browser: CalibrationRender,
  figma: CalibrationRender,
  capture: { rgbLevels: number } = { rgbLevels: 256 },
): CalibrationPairMetrics {
  assert.equal(browser.specimenId, figma.specimenId);
  assert.equal(browser.structureHash, figma.structureHash);
  const relative = (left: number, right: number) =>
    Math.abs(left - right) / Math.max(left, 0.000_001);
  const geometryError =
    (relative(browser.root.width, figma.root.width) +
      relative(browser.root.height, figma.root.height)) /
    2;
  const browserPng = PNG.sync.read(
    quantizeCapture(browser.png, capture.rgbLevels),
  );
  const figmaPng = PNG.sync.read(quantizeCapture(figma.png, capture.rgbLevels));
  const browserInk = inkFacts(browserPng);
  const figmaInk = inkFacts(figmaPng);
  if (!browserInk.box || !figmaInk.box || browserInk.count === 0) {
    return {
      valid: false,
      geometryError,
      pixelInkError: Number.POSITIVE_INFINITY,
      exact: Number.POSITIVE_INFINITY,
      perceptual: Number.POSITIVE_INFINITY,
      inkDelta: Number.POSITIVE_INFINITY,
    };
  }
  const width = Math.max(browserInk.box.width, figmaInk.box.width);
  const height = Math.max(browserInk.box.height, figmaInk.box.height);
  const alignedBrowser = whiteCanvas(width, height);
  const alignedFigma = whiteCanvas(width, height);
  blit(alignedBrowser, browserPng, browserInk.box);
  blit(alignedFigma, figmaPng, figmaInk.box);
  const denominator = width * height;
  const exact =
    pixelmatch(
      alignedBrowser.data,
      alignedFigma.data,
      undefined,
      width,
      height,
      { threshold: 0, includeAA: true, alpha: 0.1 },
    ) / denominator;
  const perceptual =
    pixelmatch(
      alignedBrowser.data,
      alignedFigma.data,
      undefined,
      width,
      height,
      {
        threshold: RECIPE_RASTER_METRIC.perceptualThreshold,
        includeAA: false,
        alpha: 0.1,
      },
    ) / denominator;
  const inkDelta =
    Math.abs(figmaInk.count - browserInk.count) / browserInk.count;
  return {
    valid: true,
    geometryError,
    exact,
    perceptual,
    inkDelta,
    pixelInkError:
      exact * RECIPE_RASTER_METRIC.exactWeight +
      perceptual * RECIPE_RASTER_METRIC.perceptualWeight +
      inkDelta * RECIPE_RASTER_METRIC.inkWeight,
  };
}

export function deriveRasterCalibration(
  browserTraining: readonly CalibrationRender[],
  figmaTraining: readonly CalibrationRender[],
): RecipeRasterCalibration {
  assert.ok(browserTraining.length > 0, "ZERO-COUNT-TRAINING");
  assert.equal(browserTraining.length, figmaTraining.length);
  assert.ok(
    browserTraining.every((entry) => entry.split === "training") &&
      figmaTraining.every((entry) => entry.split === "training"),
    "TRAIN-VALIDATION-LEAKAGE",
  );
  const figmaById = new Map(
    figmaTraining.map((entry) => [entry.specimenId, entry]),
  );
  const ratios: number[] = [];
  const heightRatios: number[] = [];
  for (const browser of browserTraining) {
    const figma = figmaById.get(browser.specimenId);
    assert.ok(figma, `TRAINING-PAIR-ABSENT:${browser.specimenId}`);
    for (const browserText of browser.text) {
      const figmaText: CalibrationRender["text"][number] | undefined =
        figma.text.find((entry) => entry.id === browserText.id);
      assert.ok(
        figmaText,
        `TRAINING-TEXT-ABSENT:${browser.specimenId}:${browserText.id}`,
      );
      ratios.push(browserText.geometry.width / figmaText.geometry.width);
      heightRatios.push(
        browserText.geometry.height / figmaText.geometry.height,
      );
    }
  }
  const fontSizeScale = clamp(
    median(ratios),
    RECIPE_RASTER_CALIBRATION_BOUNDS.fontSizeScale.minimum,
    RECIPE_RASTER_CALIBRATION_BOUNDS.fontSizeScale.maximum,
  );
  const spacingResiduals: number[] = [];
  for (const browser of browserTraining) {
    const figma = figmaById.get(browser.specimenId)!;
    for (const browserText of browser.text) {
      if (browserText.characters.length < 4) continue;
      const figmaText = figma.text.find(
        (entry) => entry.id === browserText.id,
      )!;
      spacingResiduals.push(
        (browserText.geometry.width -
          figmaText.geometry.width * fontSizeScale) /
          (browserText.characters.length - 1),
      );
    }
  }
  const letterSpacingPx = clamp(
    median(spacingResiduals),
    RECIPE_RASTER_CALIBRATION_BOUNDS.letterSpacingPx.minimum,
    RECIPE_RASTER_CALIBRATION_BOUNDS.letterSpacingPx.maximum,
  );
  const lineHeightScale = clamp(
    median(heightRatios),
    RECIPE_RASTER_CALIBRATION_BOUNDS.lineHeightScale.minimum,
    RECIPE_RASTER_CALIBRATION_BOUNDS.lineHeightScale.maximum,
  );
  const captureCandidates = [256, 128, 64];
  const rgbLevels = captureCandidates
    .map((levels) => ({
      levels,
      error: mean(
        browserTraining.map(
          (browser) =>
            measureCalibrationPair(
              browser,
              figmaById.get(browser.specimenId)!,
              {
                rgbLevels: levels,
              },
            ).pixelInkError,
        ),
      ),
    }))
    .sort(
      (left, right) => left.error - right.error || right.levels - left.levels,
    )[0]!.levels;
  return {
    version: RECIPE_RASTER_CALIBRATION_VERSION,
    corpusHash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
    metricHash: RECIPE_RASTER_METRIC_HASH,
    writer: { fontSizeScale, lineHeightScale, letterSpacingPx },
    capture: { rgbLevels },
    bounds: RECIPE_RASTER_CALIBRATION_BOUNDS,
    provenance: {
      derivedFrom: "training-only",
      trainingIds: browserTraining.map((entry) => entry.specimenId).sort(),
      validationIdsLockedBeforeMeasurement:
        RECIPE_RASTER_CALIBRATION_CORPUS.filter(
          (entry) => entry.split === "validation",
        )
          .map((entry) => entry.id)
          .sort(),
    },
  };
}

export function assertRasterCalibration(
  calibration: RecipeRasterCalibration,
): void {
  assert.equal(calibration.version, RECIPE_RASTER_CALIBRATION_VERSION);
  assert.equal(calibration.corpusHash, RECIPE_RASTER_CALIBRATION_CORPUS_HASH);
  assert.equal(calibration.metricHash, RECIPE_RASTER_METRIC_HASH);
  assert.deepEqual(calibration.bounds, RECIPE_RASTER_CALIBRATION_BOUNDS);
  const encoded = canonicalJson(calibration);
  assert.equal(
    /(?:source|library|component|cell)(?:id|identity|branch|selector)/i.test(
      encoded,
    ),
    false,
    "TARGET-IDENTITY-BRANCH",
  );
  const checks = [
    [
      calibration.writer.fontSizeScale,
      RECIPE_RASTER_CALIBRATION_BOUNDS.fontSizeScale,
    ],
    [
      calibration.writer.lineHeightScale,
      RECIPE_RASTER_CALIBRATION_BOUNDS.lineHeightScale,
    ],
    [
      calibration.writer.letterSpacingPx,
      RECIPE_RASTER_CALIBRATION_BOUNDS.letterSpacingPx,
    ],
    [calibration.capture.rgbLevels, RECIPE_RASTER_CALIBRATION_BOUNDS.rgbLevels],
  ] as const;
  for (const [value, bounds] of checks) {
    assert.ok(
      Number.isFinite(value) &&
        value >= bounds.minimum &&
        value <= bounds.maximum,
      "EXTREME-CALIBRATION-COEFFICIENT",
    );
  }
}

export interface CalibrationEvaluation {
  baseline: { geometry: number; pixelInk: number };
  calibrated: { geometry: number; pixelInk: number };
  catastrophicRegressions: string[];
  structuralFactsUnchanged: boolean;
  allNonzero: boolean;
  accepted: boolean;
}

export function evaluateHeldOutCalibration(
  browserValidation: readonly CalibrationRender[],
  baselineValidation: readonly CalibrationRender[],
  calibratedValidation: readonly CalibrationRender[],
  calibration: RecipeRasterCalibration,
): CalibrationEvaluation {
  assertRasterCalibration(calibration);
  assert.ok(browserValidation.length > 0, "ZERO-COUNT-VALIDATION");
  assert.equal(browserValidation.length, baselineValidation.length);
  assert.equal(browserValidation.length, calibratedValidation.length);
  assert.ok(
    [
      ...browserValidation,
      ...baselineValidation,
      ...calibratedValidation,
    ].every((entry) => entry.split === "validation"),
    "TRAIN-VALIDATION-LEAKAGE",
  );
  const baselineById = new Map(
    baselineValidation.map((entry) => [entry.specimenId, entry]),
  );
  const calibratedById = new Map(
    calibratedValidation.map((entry) => [entry.specimenId, entry]),
  );
  const rows = browserValidation.map((browser) => {
    const baseline = baselineById.get(browser.specimenId);
    const calibrated = calibratedById.get(browser.specimenId);
    assert.ok(
      baseline && calibrated,
      `VALIDATION-PAIR-ABSENT:${browser.specimenId}`,
    );
    return {
      id: browser.specimenId,
      baseline: measureCalibrationPair(browser, baseline),
      calibrated: measureCalibrationPair(
        browser,
        calibrated,
        calibration.capture,
      ),
      structural:
        browser.structureHash === baseline.structureHash &&
        baseline.structureHash === calibrated.structureHash,
    };
  });
  const aggregate = (key: "baseline" | "calibrated") => ({
    geometry: mean(rows.map((row) => row[key].geometryError)),
    pixelInk: mean(rows.map((row) => row[key].pixelInkError)),
  });
  const baseline = aggregate("baseline");
  const calibrated = aggregate("calibrated");
  const catastrophicRegressions = rows
    .filter(
      (row) =>
        row.calibrated.geometryError >
          row.baseline.geometryError *
            RECIPE_RASTER_METRIC.catastrophicMultiplier +
            RECIPE_RASTER_METRIC.catastrophicAllowance ||
        row.calibrated.pixelInkError >
          row.baseline.pixelInkError *
            RECIPE_RASTER_METRIC.catastrophicMultiplier +
            RECIPE_RASTER_METRIC.catastrophicAllowance,
    )
    .map((row) => row.id);
  const structuralFactsUnchanged = rows.every((row) => row.structural);
  const allNonzero = rows.every(
    (row) => row.baseline.valid && row.calibrated.valid,
  );
  return {
    baseline,
    calibrated,
    catastrophicRegressions,
    structuralFactsUnchanged,
    allNonzero,
    accepted:
      calibrated.geometry < baseline.geometry &&
      calibrated.pixelInk < baseline.pixelInk &&
      catastrophicRegressions.length === 0 &&
      structuralFactsUnchanged &&
      allNonzero,
  };
}

export function calibrationArtifactHash(
  calibration: RecipeRasterCalibration,
): string {
  assertRasterCalibration(calibration);
  return createHash("sha256").update(canonicalJson(calibration)).digest("hex");
}
