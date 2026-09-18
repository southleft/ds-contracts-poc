import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { builtinReactCohort } from "./react-cohort.js";
import {
  completeNegativeControls,
  negativeControlNames,
  inventoryEvidence,
  evidenceUnchanged,
} from "./react-validation-evidence.js";

test("controls require every selected case and all five distinct successful corruptions", () => {
  const negativeCaseIds = builtinReactCohort.negativeCaseIds;
  const good = negativeCaseIds.map((id) => ({
    id,
    negativeControls: negativeControlNames.map((name) => ({
      name,
      rejected: true,
    })),
  }));
  assert.equal(completeNegativeControls(good, negativeCaseIds), true);
  assert.equal(completeNegativeControls(good.slice(1), negativeCaseIds), false);
  assert.equal(completeNegativeControls([...good, good[0]], negativeCaseIds), false);
  assert.equal(completeNegativeControls(good, []), false, "a cohort naming no control proves nothing");
  for (const bad of [
    [],
    good[0].negativeControls.slice(1),
    good[0].negativeControls.map(() => good[0].negativeControls[0]),
    good[0].negativeControls.map((c, i) => ({ ...c, rejected: i !== 0 })),
  ])
    assert.equal(
      completeNegativeControls(
        [{ ...good[0], negativeControls: bad }, ...good.slice(1)],
        negativeCaseIds,
      ),
      false,
    );
});
test("recorded archive bytes and the final verdict cannot change unnoticed", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "react-evidence-"));
  try {
    writeFileSync(path.join(dir, "original.har"), "archive");
    writeFileSync(path.join(dir, "validation.json"), "verdict");
    const seal = inventoryEvidence(dir);
    assert.equal(evidenceUnchanged(dir, seal), true);
    writeFileSync(path.join(dir, "original.har"), "different");
    assert.equal(evidenceUnchanged(dir, seal), false);
    writeFileSync(path.join(dir, "original.har"), "archive");
    writeFileSync(path.join(dir, "validation.json"), "other");
    assert.equal(evidenceUnchanged(dir, seal), false);
    writeFileSync(path.join(dir, "validation.json"), "verdict");
    rmSync(path.join(dir, "original.har"));
    assert.equal(evidenceUnchanged(dir, seal), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The actual selected Button uses transition:all; an immediate observation can
// still see it after visibility:hidden has been assigned.
test("hidden-content control waits for the authored visibility transition", async () => {
  const { chromium } = await import("playwright-core");
  const { corruptReactReference } =
    await import("./react-reference-validation.js");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<style>button{transition:all 150ms}</style><button>Source</button>",
    );
    await page
      .locator("button")
      .evaluate((e) => getComputedStyle(e).visibility);
    await corruptReactReference(page, "hidden-root", "button");
    assert.equal(
      await page
        .locator("button")
        .evaluate((e) => e.checkVisibility({ checkVisibilityCSS: true })),
      false,
    );
    assert.equal(
      await page
        .locator("button")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0.15s",
    );
  } finally {
    await browser.close();
  }
});
