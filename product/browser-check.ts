/** Read-only local UI smoke check. Start the playground and built site first. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { renderProductOverview } from "./overview.js";

const output = resolve("private/product-overview-check", randomUUID());
mkdirSync(output, { recursive: true });
const canonicalHtml = renderProductOverview(
  readFileSync("docs/CURRENT.md", "utf8"),
  "/assets/product-loop.svg",
);
const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const results: object[] = [];
try {
  for (const [name, origin, route] of [
    ["playground", "http://127.0.0.1:5181", "/system"],
    ["site", "http://127.0.0.1:5182", "/system/"],
  ]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(origin + route);
      assert.equal(response?.status(), 200);
      await page
        .getByRole("heading", {
          name: "Code ↔ contracts ↔ canvas",
          exact: true,
        })
        .waitFor();
      await page
        .locator(".product-overview__diagram")
        .evaluate(async (image: HTMLImageElement) => image.decode());
      // Headings and a fresh diagram alone cannot detect stale published
      // prose. Check all rendered canonical text and links on both surfaces.
      const canonicalMatches = await page.evaluate((html) => {
        const expected = document.createElement("template");
        expected.innerHTML = html;
        const actual = document.querySelector(".product-overview article");
        if (!actual) return false;
        const facts = [actual, expected.content].map((node) => ({
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
          links: [...node.querySelectorAll("a")].map((link) => [
            link.getAttribute("href"),
            (link.textContent ?? "").replace(/\s+/g, " ").trim(),
          ]),
          headings: [...node.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
            (heading) => [
              heading.tagName,
              (heading.textContent ?? "").replace(/\s+/g, " ").trim(),
            ],
          ),
        }));
        return JSON.stringify(facts[0]) === JSON.stringify(facts[1]);
      }, canonicalHtml);
      assert.equal(
        canonicalMatches,
        true,
        `${name}: stale canonical document text or links`,
      );
      const observation = await page.evaluate(() => ({
        width: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        imageWidth: document.querySelector<HTMLImageElement>(
          ".product-overview__diagram",
        )?.naturalWidth,
        sections: [...document.querySelectorAll("article h2")].map(
          (heading) => heading.textContent,
        ),
      }));
      assert.equal(
        observation.pageWidth,
        width,
        `${name}: document overflows at ${width}px`,
      );
      assert.equal(observation.imageWidth, 1040);
      const imageUrl = await page
        .locator(".product-overview__diagram")
        .evaluate((image: HTMLImageElement) => image.currentSrc);
      const imageBytes = imageUrl.startsWith("data:")
        ? imageUrl.includes(";base64,")
          ? Buffer.from(imageUrl.split(",")[1], "base64")
          : Buffer.from(decodeURIComponent(imageUrl.split(",")[1]))
        : await (await page.request.get(imageUrl)).body();
      assert.deepEqual(
        imageBytes,
        readFileSync("docs/assets/product-loop.svg"),
        `${name}: stale schematic bytes`,
      );
      assert.ok(
        observation.sections.includes("Which Figma connection does what?"),
      );
      assert.ok(
        observation.sections.includes(
          "How drift must be detected and repaired",
        ),
      );
      assert.ok(observation.sections.includes("Outcome-first work order"));
      await page.screenshot({ path: resolve(output, `${name}-${width}.png`) });
      if (width === 1440)
        await page
          .locator(".product-overview__diagram")
          .screenshot({ path: resolve(output, `${name}-schematic.png`) });
      results.push({ name, ...observation });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/", "/sources", "/playground", "/flow"]) {
    await page.goto(`http://127.0.0.1:5181${route}`);
    await page
      .getByRole("link", { name: "The whole loop", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Code ↔ contracts ↔ canvas", exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/system");
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: "pass",
        scope:
          "local architecture pages and navigation only; not conversion qualification",
        results,
        errors,
        output,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
