/** Diagnostic comparison only. No grade or fidelity acceptance threshold.
 * Uses the archived ORIGINAL Storybook, not a remounted HTML approximation. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { pathToFileURL } from "node:url";

export async function compareTrial(sourceDirectory: string, observationFile: string, output: string) {
  const observation = JSON.parse(await fs.readFile(observationFile, "utf8"));
  const measurement = JSON.parse(await fs.readFile(path.join(sourceDirectory, "measurement.json"), "utf8"));
  const image = observation.screenshot.content.find((c: { type: string }) => c.type === "image");
  if (!image || image.mimeType !== "image/png") throw new Error("native-figma-png-required");
  const figma = Buffer.from(image.data, "base64");
  const browser = await chromium.launch();
  let source: Buffer;
  let box: { x: number; y: number; width: number; height: number };
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    await context.routeFromHAR(path.join(sourceDirectory, "source.har"), { notFound: "abort" });
    await context.routeWebSocket(/.*/, socket => socket.close());
    const archive = JSON.parse(await fs.readFile(path.join(sourceDirectory, "source.har"), "utf8"));
    const url = archive.log.entries[0].request.url;
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const full = await page.screenshot({ fullPage: true });
    const hash = createHash("sha256").update(full).digest("hex");
    if (hash !== measurement.source.sha256) throw new Error("source-replay-does-not-match-original-png");
    // Playwright CSS locators cross open shadow roots, preserving source layout.
    let locator = page.locator(measurement.profile.path[0]);
    for (const selector of measurement.profile.path.slice(1)) locator = locator.locator(selector);
    const measured = await locator.boundingBox();
    if (!measured) throw new Error("source-bounds-missing");
    box = measured;
    source = await page.screenshot({ clip: box });
  } finally { await browser.close(); }
  const a = PNG.sync.read(source), b = PNG.sync.read(figma);
  const sizesMatch = a.width === b.width && a.height === b.height;
  let changed = 0, totalDifference = 0;
  if (sizesMatch) {
    // Composite Figma's transparent rounded edge over the observed page surface.
    const bg = measurement.source.observation.tokens["--al-theme-color-body-background"];
    if (!/^#[a-f0-9]{6}$/.test(bg)) throw new Error("comparison-background-unavailable");
    const backdrop = [1, 3, 5].map(offset => parseInt(bg.slice(offset, offset + 2), 16));
    for (let p = 0; p < a.width * a.height; p++) {
      let delta = 0;
      for (let c = 0; c < 3; c++) {
        const painted = Math.round(b.data[p * 4 + c] * b.data[p * 4 + 3] / 255 + backdrop[c] * (1 - b.data[p * 4 + 3] / 255));
        const d = Math.abs(a.data[p * 4 + c] - painted);
        totalDifference += d; delta = Math.max(delta, d);
      }
      if (delta > 8) changed++;
    }
  }
  await fs.mkdir(output, { recursive: true });
  for (const name of ["source-component.png", "figma-component.png", "comparison.json"]) {
    try { await fs.stat(path.join(output, name)); throw new Error("comparison-output-exists"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  await fs.writeFile(path.join(output, "source-component.png"), source);
  await fs.writeFile(path.join(output, "figma-component.png"), figma);
  const report = {
    scope: "One rendering draft; diagnostic only, no grade. No alignment search or rescaling applied.",
    sourceBox: box, sourceSize: [a.width, a.height], figmaSize: [b.width, b.height], sizesMatch,
    pixelsOver8ChannelDifference: sizesMatch ? changed : null,
    meanAbsoluteRgbDifference: sizesMatch ? totalDifference / (a.width * a.height * 3) : null,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    figmaSha256: createHash("sha256").update(figma).digest("hex"),
  };
  await fs.writeFile(path.join(output, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , source, observation, output] = process.argv;
  if (!source || !observation || !output) throw new Error("usage: compare-trial <source-directory> <figma-observation.json> <new-output-directory>");
  console.log(JSON.stringify(await compareTrial(source, observation, output), null, 2));
}
