import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { builtinReactCohort } from "./react-cohort.js";
import {
  completeNegativeControls,
  negativeControlNames,
  textlessNegativeControlNames,
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

test('textless controls require the declaration-selected unexpected-text check and cannot nominate their own control set', () => {
  const row={id:'shape',negativeControls:textlessNegativeControlNames.map(name=>({name,rejected:true}))};
  assert.equal(completeNegativeControls([row],['shape']),false,'a row cannot exempt itself from the original font control');
  assert.equal(completeNegativeControls([row],['shape'],['shape']),true);
  assert.equal(completeNegativeControls([row],['shape'],['foreign']),false);
  for(const controls of [row.negativeControls.slice(1),row.negativeControls.map(c=>({...c,rejected:c.name!=='unexpected-text'})),
    negativeControlNames.map(name=>({name,rejected:true})),row.negativeControls.map(c=>({...c,name:'unexpected-text'}))])
    assert.equal(completeNegativeControls([{...row,negativeControls:controls}],['shape'],['shape']),false);
});

test('all five corruptions still fail for a textless source in real Chromium', async () => {
  const {chromium}=await import('playwright-core');
  const {checkSource}=await import('./check.js');
  const {observeSource,watchSourceFailures}=await import('./observe.js');
  const {corruptReactReference}=await import('./react-reference-validation.js');
  const profile={id:'shape',provenance:'bounded browser instrument',path:['#shape'],textContent:'absent' as const,
    fontFamily:'Inter',requiredStyles:{display:'block',width:'16px',height:'1px'},requiredTokens:{'--paint':'#123456'}};
  const browser=await chromium.launch();
  try {
    for(const name of textlessNegativeControlNames) {
      const page=await browser.newPage();const failures=watchSourceFailures(page);
      try {
        await page.setContent('<style>:root{--paint:#123456}#shape{display:block;width:16px;height:1px;background:var(--paint)}</style><span id="shape"></span>');
        assert.equal(checkSource(profile,await observeSource(page,profile,failures)).status,'valid',name+' before');
        await corruptReactReference(page,name,'#shape');
        const result=checkSource(profile,await observeSource(page,profile,failures));
        const expected={'missing-css':'style-mismatch:','missing-theme':'theme-token-missing:','unexpected-text':'unexpected-source-text',
          'missing-root':'component-missing','hidden-root':'component-not-visible'}[name];
        assert.equal(result.status,'invalid',name);assert.ok(result.problems.some(p=>p.startsWith(expected)),JSON.stringify(result));
      } finally {failures.dispose();await page.close();}
    }
  } finally {await browser.close();}
});

test('the original text-bearing corruption set still rejects all five failures', async () => {
  const {chromium}=await import('playwright-core');
  const {readFileSync}=await import('node:fs');
  const {checkSource}=await import('./check.js');
  const {observeSource,watchSourceFailures}=await import('./observe.js');
  const {corruptReactReference}=await import('./react-reference-validation.js');
  const font=readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  const profile={id:'text',provenance:'bounded browser instrument',path:['button'],fontFamily:'IBM Plex Sans',
    requiredStyles:{display:'inline-flex'},requiredTokens:{'--paint':'#123456'}};
  const browser=await chromium.launch();
  try {
    for(const name of negativeControlNames) {
      const page=await browser.newPage();const failures=watchSourceFailures(page);
      try {
        await page.setContent(`<style>@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}:root{--paint:#123456}button{display:inline-flex;font:16px 'IBM Plex Sans';color:var(--paint)}</style><button>Original text</button>`);
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(checkSource(profile,await observeSource(page,profile,failures)).status,'valid',name+' before');
        await corruptReactReference(page,name,'button');
        const result=checkSource(profile,await observeSource(page,profile,failures));
        const expected={'missing-css':'style-mismatch:','missing-theme':'theme-token-missing:','missing-font':'font-substitution',
          'missing-root':'component-missing','hidden-root':'component-not-visible'}[name];
        assert.equal(result.status,'invalid',name);assert.ok(result.problems.some(p=>p.startsWith(expected)),JSON.stringify(result));
      } finally {failures.dispose();await page.close();}
    }
  } finally {await browser.close();}
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
