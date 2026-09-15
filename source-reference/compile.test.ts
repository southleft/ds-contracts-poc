import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";
import { compileRenderedTree, emitRenderedDraft } from "./compile.js";

test("automatic rendered-tree compiler preserves actual text/flex and fails closed on altered/unsupported sources", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = watchSourceFailures(page);
  const font = readFileSync("extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2").toString("base64");
  try {
    await page.setContent(`<style>@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}:root{--fixture-accent:#2850a0}*{box-sizing:border-box}button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:8px 16px;border:0;border-radius:4px;background:var(--fixture-accent);color:white;font:16px/24px 'IBM Plex Sans'}</style><div id="source"><button><span>\n Actual label \n</span></button></div>`);
    const capture = await captureValidatedTree(page, {
      id: "styled-flex", provenance: "compile.test.ts", path: ["button"], fontPath: ["button span"],
      requiredStyles: { display: "inline-flex", "background-color": "rgb(40, 80, 160)" },
      requiredTokens: { "--fixture-accent": "#2850a0" }, fontFamily: "IBM Plex Sans",
    }, failures, "#source", "--fixture-");
    assert.equal(capture.status, "captured", JSON.stringify(capture.problems));
    if (capture.status !== "captured") throw new Error("capture missing");
    const fonts = [{ family: "IBM Plex Sans", style: "Regular" }];
    const compiled = compileRenderedTree(capture, fonts);
    assert.equal(compiled.status, "renderable-draft", JSON.stringify(compiled.problems));
    assert.equal(compiled.component?.layout.mode, "horizontal");
    assert.deepEqual(compiled.component?.layout.padding, { top: 8, right: 16, bottom: 8, left: 16 });
    const text = compiled.component?.children[0];
    assert.equal(text?.kind, "text");
    if (text?.kind !== "text") throw new Error("text missing");
    assert.equal(text.characters, "Actual label");
    assert.equal(text.type.fontFamily, "IBM Plex Sans");
    assert.deepEqual(compiled.component?.fills[0], { kind: "solid", color: "#2850a0ff" });
    assert.equal(compileRenderedTree(capture, []).status, "refused", "no guessed font substitution");
    const altered = structuredClone(capture);
    altered.tree.style["background-color"] = "rgb(1, 2, 3)";
    assert.equal(compileRenderedTree(altered, fonts).status, "refused", "hash tamper rejected");
    for (const [channel, value] of [["display", "grid"], ["transform", "matrix(1, 0, 0, 1, 5, 0)"], ["box-shadow", "rgb(0, 0, 0) 0px 2px 3px 0px"], ["white-space-collapse", "preserve"]]) {
      const changed = structuredClone(capture);
      changed.tree.style[channel] = value;
      changed.treeSha256 = createHash("sha256").update(JSON.stringify(changed.tree)).digest("hex");
      const refused = compileRenderedTree(changed, fonts);
      assert.equal(refused.status, "refused", channel);
      assert.throws(() => emitRenderedDraft(refused, "Test"), /compilation-refused/);
    }
    const code = emitRenderedDraft(compiled, "Actual source");
    assert.match(code, /RENDERED-SOURCE-WRITER-SHARED-RUNTIME/);
    assert.match(code, /WRONG-FILE/);
    assert.match(code, /byMp6lt0Ij9b2QbkDGFwBh/);
    assert.doesNotMatch(code, /humanGrade|humanSignoff|overallSuccess/);
    assert.match(compiled.limitations.join(" "), /unqualified/);
  } finally { failures.dispose(); await browser.close(); }
});
