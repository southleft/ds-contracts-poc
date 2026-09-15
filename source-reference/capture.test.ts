import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";
import type { SourceProfile } from "./check.js";
import { captureJs } from "../extract/computed/capture.js";

test("production reader captures the validated shadow source, refuses missing styles and wrong roots", async () => {
  const font = readFileSync(
    "extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2",
  ).toString("base64");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = watchSourceFailures(page);
  const profile: SourceProfile = {
    id: "shadow-source",
    provenance: "capture.test.ts",
    path: ["source-button", "button"],
    requiredStyles: {
      display: "inline-flex",
      "background-color": "rgb(40, 80, 160)",
    },
    requiredTokens: { "--theme-accent": "#2850a0" },
    fontFamily: "IBM Plex Sans",
  };
  try {
    await page.setContent(
      `<style>@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}:root{--theme-accent:#2850a0}</style><div id="original"><div class="story-decorator"><source-button>Original label</source-button></div></div><div id="different"><button>Wrong button</button></div>`,
    );
    await page.evaluate(() => {
      const untouchedControl = document.createElement("input");
      untouchedControl.id = "untouched-control";
      document.body.appendChild(untouchedControl);
      document
        .querySelector("source-button")!
        .attachShadow({ mode: "open" }).innerHTML =
        '<style>button{display:inline-flex;background-color:var(--theme-accent);font:16px "IBM Plex Sans"}button::before{content:"";width:4px;height:4px;background:var(--theme-accent)}</style><button><span><slot></slot></span></button>';
    });
    const captured = await captureValidatedTree(
      page,
      profile,
      failures,
      "#original",
      "--theme-",
    );
    assert.equal(captured.status, "captured", JSON.stringify(captured));
    assert.equal(
      await page.locator("#untouched-control").getAttribute("style"),
      null,
      "screenshots must not add caret-hiding inline styles to the original controls",
    );
    if (captured.status !== "captured") throw new Error("capture required");
    assert.equal(captured.tree.tag, "button");
    assert.equal(
      captured.census.textRuns,
      1,
      "assigned slot text must not be duplicated",
    );
    assert.equal(captured.census.pseudoPlanes, 1);
    assert.ok(captured.channels.includes("border-top-color"));
    assert.ok(
      captured.census.tokenCandidateChannels > 0,
      "original shadow stylesheet names must reach compiler input",
    );
    assert.equal(captured.tree.style["font-family"], '"IBM Plex Sans"');
    const legacy = (await page.evaluate(
      captureJs("#original", undefined, "--theme-"),
    )) as { tag: string };
    assert.equal(
      legacy.tag,
      "div",
      "legacy callers still capture the stage wrapper; explicit validated roots are opt-in",
    );
    const wrong = await captureValidatedTree(
      page,
      profile,
      failures,
      "#different",
      "--theme-",
    );
    assert.deepEqual(wrong.problems, [
      "capture-root-does-not-match-validated-source",
    ]);
    await page.evaluate(() => {
      document
        .querySelector("source-button")!
        .shadowRoot!.querySelector("style")!
        .remove();
    });
    const unstyled = await captureValidatedTree(
      page,
      profile,
      failures,
      "#original",
      "--theme-",
    );
    assert.equal(unstyled.status, "refused");
    assert.equal(
      "tree" in unstyled,
      false,
      "invalid source must never produce compiler input",
    );
  } finally {
    failures.dispose();
    await browser.close();
  }
});
