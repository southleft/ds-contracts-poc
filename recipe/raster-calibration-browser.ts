import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "playwright-core";

import {
  chromiumExecutable,
  launchBrowser,
} from "../extract/figma/visual-parity/render.js";
import { canonicalJson } from "./normalize.js";
import {
  RECIPE_RASTER_CALIBRATION_CORPUS,
  type CalibrationGeometry,
  type CalibrationNode,
  type CalibrationPaint,
  type CalibrationRender,
  type CalibrationSizing,
  type CalibrationSpecimen,
} from "./raster-calibration.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const FONT_FILES = {
  "Roboto/Regular":
    "extract/computed/fonts/roboto/roboto-latin-400-normal.woff2",
  "Roboto/Medium":
    "extract/computed/fonts/roboto/roboto-latin-500-normal.woff2",
  "Inter/Regular": "extract/computed/fonts/inter/inter-latin-variable.woff2",
  "Inter/Medium": "extract/computed/fonts/inter/inter-latin-variable.woff2",
} as const;

const fontData = (file: string): string =>
  readFileSync(path.join(REPO, file)).toString("base64");
const FONT_CSS = `
@font-face{font-family:"Roboto";src:url("data:font/woff2;base64,${fontData(FONT_FILES["Roboto/Regular"])}") format("woff2");font-style:normal;font-weight:400;font-display:block}
@font-face{font-family:"Roboto";src:url("data:font/woff2;base64,${fontData(FONT_FILES["Roboto/Medium"])}") format("woff2");font-style:normal;font-weight:500;font-display:block}
@font-face{font-family:"Inter";src:url("data:font/woff2;base64,${fontData(FONT_FILES["Inter/Regular"])}") format("woff2");font-style:normal;font-weight:100 900;font-display:block}
`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const sizing = (value: CalibrationSizing, axis: "width" | "height"): string => {
  if (value.mode === "fixed") return `${axis}:${value.value}px;flex:none;`;
  if (value.mode === "fill")
    return axis === "width"
      ? "width:auto;min-width:0;flex:1 1 0;"
      : "height:auto;min-height:0;align-self:stretch;";
  return `${axis}:max-content;`;
};
const rgba = (paint: CalibrationPaint): string => {
  const alpha = paint.opacity ?? 1;
  const red = Number.parseInt(paint.color.slice(1, 3), 16);
  const green = Number.parseInt(paint.color.slice(3, 5), 16);
  const blue = Number.parseInt(paint.color.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
};
const position = (node: CalibrationNode): string =>
  node.positioning
    ? `position:absolute;left:${node.positioning.x}px;top:${node.positioning.y}px;`
    : "";

const renderNode = (node: CalibrationNode): string => {
  const shared = `box-sizing:border-box;${position(node)}${node.opacity === undefined ? "" : `opacity:${node.opacity};`}`;
  if (node.kind === "text") {
    const weight = node.font.style === "Medium" ? 500 : 400;
    return `<span data-cal-id="${escapeHtml(node.id)}" data-cal-kind="text" style="${shared}display:block;white-space:pre;overflow:visible;color:${node.color};font-family:${node.font.family};font-style:normal;font-weight:${weight};font-size:${node.font.size}px;line-height:${node.font.lineHeight}px;letter-spacing:0;${sizing(node.width, "width")}">${escapeHtml(node.characters)}</span>`;
  }
  if (node.kind === "rect") {
    const border = node.stroke
      ? `border:${node.stroke.weight}px solid ${rgba({
          color: node.stroke.color,
          opacity: node.stroke.opacity,
        })};`
      : "";
    return `<div data-cal-id="${escapeHtml(node.id)}" data-cal-kind="rect" style="${shared}${sizing(node.width, "width")}${sizing(node.height, "height")}background:${rgba(node.fill)};border-radius:${node.radius ?? 0}px;${border}"></div>`;
  }
  if (node.kind === "instance") {
    const square = node.componentRef === "square-adornment";
    return `<span data-cal-id="${escapeHtml(node.id)}" data-cal-kind="instance" style="${shared}${sizing(node.width, "width")}${sizing(node.height, "height")}display:inline-flex;align-items:center;justify-content:center;white-space:pre;font-family:Inter;font-size:11px;line-height:14px;font-weight:500;${square ? `background:${rgba(node.fill)};color:#ffffff;border-radius:3px;` : `background:transparent;color:${rgba(node.fill)};`}">${escapeHtml(node.characters)}</span>`;
  }
  const layout = node.layout;
  const border = node.stroke
    ? `border:${node.stroke.weight}px solid ${rgba({
        color: node.stroke.color,
        opacity: node.stroke.opacity,
      })};`
    : "";
  const effect = node.effect
    ? `box-shadow:0 0 0 ${node.effect.spread}px ${rgba({
        color: node.effect.color,
        opacity: node.effect.opacity,
      })};`
    : "";
  const justify = {
    min: "flex-start",
    center: "center",
    max: "flex-end",
    "space-between": "space-between",
  }[layout.primary];
  const align = { min: "flex-start", center: "center", max: "flex-end" }[
    layout.counter
  ];
  const display =
    layout.mode === "none"
      ? "display:block;"
      : `display:flex;flex-direction:${layout.mode === "horizontal" ? "row" : "column"};justify-content:${justify};align-items:${align};`;
  return `<div data-cal-id="${escapeHtml(node.id)}" data-cal-kind="frame" style="${shared}position:${node.positioning ? "absolute" : "relative"};${display}${sizing(layout.width, "width")}${sizing(layout.height, "height")}gap:${layout.gap}px;padding:${layout.padding.top}px ${layout.padding.right}px ${layout.padding.bottom}px ${layout.padding.left}px;background:${rgba(node.fill)};border-radius:${node.radius ?? 0}px;overflow:${node.clipsContent === false ? "visible" : "visible"};${border}${effect}">${node.children.map(renderNode).join("")}</div>`;
};

const structuralProjection = (node: CalibrationNode): unknown => ({
  id: node.id,
  kind: node.kind,
  positioning: node.positioning?.mode ?? "auto",
  ...(node.kind === "frame"
    ? {
        children: node.children.map((child) => structuralProjection(child)),
      }
    : {}),
});

export function calibrationStructureHash(
  specimen: CalibrationSpecimen,
): string {
  return createHash("sha256")
    .update(canonicalJson(structuralProjection(specimen.root)))
    .digest("hex");
}

const documentFor = (specimen: CalibrationSpecimen): string => `<!doctype html>
<html><head><meta charset="utf-8"><style>${FONT_CSS}
html{color-scheme:light}body{margin:0;background:${specimen.capture.background}}
.capture{width:${specimen.capture.width}px;height:${specimen.capture.height}px;background:${specimen.capture.background};display:flex;align-items:center;justify-content:center;overflow:visible}
*,*::before,*::after{animation:none!important;transition:none!important}
</style></head><body><div class="capture">${renderNode(specimen.root)}</div></body></html>`;

interface BrowserMeasurement {
  root: CalibrationGeometry;
  roles: Record<string, CalibrationGeometry>;
  text: CalibrationRender["text"];
}

const measure = async (
  page: Page,
  specimen: CalibrationSpecimen,
): Promise<BrowserMeasurement> => {
  const result = (await page.evaluate(`(() => {
    const capture = document.querySelector(".capture");
    const root = document.querySelector('[data-cal-id="root"]');
    const origin = capture.getBoundingClientRect();
    const geometry = node => {
      const box = node.getBoundingClientRect();
      return {x:box.x-origin.x,y:box.y-origin.y,width:box.width,height:box.height};
    };
    const roles = {};
    const text = [];
    for (const node of document.querySelectorAll("[data-cal-id]")) {
      const id = node.getAttribute("data-cal-id");
      roles[id] = geometry(node);
      if (node.getAttribute("data-cal-kind") === "text") {
        const style = getComputedStyle(node);
        text.push({
          id,
          characters: node.textContent,
          geometry: geometry(node),
          resolvedFamily: style.fontFamily.split(",")[0].replaceAll('"', "").trim(),
          resolvedStyle: Number(style.fontWeight) >= 500 ? "Medium" : "Regular"
        });
      }
    }
    return {root:geometry(root),roles,text};
  })()`)) as BrowserMeasurement;
  assert.ok(result.root.width > 0 && result.root.height > 0);
  assert.equal(
    Object.keys(result.roles).length > 0,
    true,
    `${specimen.id}: browser roles absent`,
  );
  return result;
};

export async function renderCalibrationCorpusInBrowser(): Promise<{
  browserVersion: string;
  browserExecutable: string;
  browserExecutableSha256: string;
  fontFiles: Array<{ path: string; sha256: string }>;
  renders: CalibrationRender[];
  deterministicRerun: boolean;
}> {
  const browser = await launchBrowser();
  const executable = chromiumExecutable();
  const page = await browser.newPage({
    viewport: { width: 600, height: 400 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
  });
  const renders: CalibrationRender[] = [];
  let deterministicRerun = true;
  try {
    for (const specimen of RECIPE_RASTER_CALIBRATION_CORPUS) {
      await page.setContent(documentFor(specimen), { waitUntil: "load" });
      await page.evaluate("document.fonts.ready");
      const fontChecks = (await page.evaluate(
        `["Inter","Roboto"].map(family=>[family,document.fonts.check('12px "'+family+'"')])`,
      )) as Array<[string, boolean]>;
      assert.ok(
        fontChecks.every(([, available]) => available),
        `${specimen.id}: browser font unavailable`,
      );
      const facts = await measure(page, specimen);
      const capture = page.locator(".capture");
      const png = Buffer.from(
        await capture.screenshot({ animations: "disabled" }),
      );
      const rerun = Buffer.from(
        await capture.screenshot({ animations: "disabled" }),
      );
      deterministicRerun &&= png.equals(rerun);
      renders.push({
        specimenId: specimen.id,
        split: specimen.split,
        png,
        ...facts,
        structureHash: calibrationStructureHash(specimen),
      });
    }
    return {
      browserVersion: browser.version(),
      browserExecutable: executable,
      browserExecutableSha256: createHash("sha256")
        .update(readFileSync(executable))
        .digest("hex"),
      fontFiles: Object.values(FONT_FILES)
        .filter((file, index, values) => values.indexOf(file) === index)
        .map((file) => ({
          path: file,
          sha256: createHash("sha256")
            .update(readFileSync(path.join(REPO, file)))
            .digest("hex"),
        })),
      renders,
      deterministicRerun,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
