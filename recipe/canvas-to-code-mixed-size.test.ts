import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import { deriveCanvasFacts, type CanvasFactsDocument } from "./canvas-facts.js";
import type { DumpSet } from "../extract/figma/types.js";
import {
  buildCanvasToCodeFromFacts,
  mountCells,
  renderCells,
  diffRenderedAgainstFacts,
} from "./canvas-to-code.js";

test("percent tracking resolves against captured font size without inventing a missing size", () => {
  const doc = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  ) as CanvasFactsDocument;
  for (const fontSize of [12, undefined]) {
    const scene = structuredClone(doc.scene);
    const label = scene.children[0].children[0];
    label.letterSpacing = { unit: "PERCENT", value: -5 };
    label.fontSize = fontSize;
    const result = bridgeCanvasFactsToDump(
      deriveCanvasFacts(scene, doc.source),
    );
    const text = (result.dump.Badge as DumpSet).variants[0].children![0].text!;
    assert.equal(text.letterSpacing, fontSize === undefined ? undefined : -0.6);
    assert.equal(result.counts.silent, 0);
  }
});

test("mixed HUG/FIXED component roots retain the complete observed bbox census", () => {
  const doc = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  ) as CanvasFactsDocument;
  const result = bridgeCanvasFactsToDump(doc);
  const variants = (
    result.dump.Badge as {
      variants: Array<{
        bbox?: { width: number; height: number };
        layout: { primarySizing: string; counterSizing: string };
      }>;
    }
  ).variants;
  assert.equal(variants.length, 10);
  assert.ok(
    variants.every((v) => v.bbox !== undefined),
    "partial bbox census prevents the existing mixed-size proposer from carrying FIXED dots",
  );
  assert.deepEqual(
    variants.slice(0, 5).map((v) => v.layout.primarySizing),
    Array(5).fill("AUTO"),
    "HUG remains a mode, not a frozen width",
  );
  assert.deepEqual(
    variants.slice(5).map((v) => v.bbox),
    Array(5).fill({ width: 8, height: 8 }),
  );
  assert.equal(result.counts.silent, 0);
});

test("generated mixed-size Badge renders every dot and preserves Label-only padding", async () => {
  const doc = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  ) as CanvasFactsDocument;
  const temp = mkdtempSync(path.join(os.tmpdir(), "ds-mixed-size-"));
  try {
    const built = await buildCanvasToCodeFromFacts(doc, temp);
    const cells = mountCells(doc, built.contract);
    const rendered = await renderCells(built, cells);
    assert.equal(
      diffRenderedAgainstFacts(doc, built, cells, rendered).counts.namedDeltas,
      0,
    );
    const planted = structuredClone(rendered);
    planted.find((r) => r.label !== null)!.label!["letter-spacing"] = "normal";
    const drift = diffRenderedAgainstFacts(doc, built, cells, planted);
    assert.equal(
      drift.counts.namedDeltas,
      1,
      "a missing tracking value must change the measured result",
    );
    assert.equal(rendered.length, cells.length);
    for (const cell of cells) {
      const actual = rendered.find((r) => r.key === cell.key)!.root;
      const dot = cell.props.shape === "dot";
      assert.equal(actual["padding-left"], dot ? "0px" : "8px");
      assert.equal(actual["padding-right"], dot ? "0px" : "8px");
      if (dot) {
        assert.equal(actual.width, "8px");
        assert.equal(actual.height, "8px");
      } else {
        assert.equal(actual["border-top-left-radius"], "999px");
        assert.equal(
          rendered.find((r) => r.key === cell.key)!.label!["letter-spacing"],
          "1px",
          "captured letter spacing must render",
        );
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("hidden instance accounting proves absence without accepting missing visible or extra children", async () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL(
    "./evidence/canvas-to-code-held-out-v2/cbds-badge/canvas-facts.json.gz", import.meta.url,
  ))).toString()) as CanvasFactsDocument;
  const temp = mkdtempSync(path.join(os.tmpdir(), "ds-hidden-instance-"));
  try {
    const built = await buildCanvasToCodeFromFacts(doc, temp);
    const style = (built.contract.props as Array<{name:string;bindings:{code:{prop:string}}}>).find(p => p.name === 'style');
    assert(style, 'the fixture must exercise a design Style axis');
    assert.notEqual(style.bindings.code.prop, 'style', 'React style must be protected by the code binding');
    const cells = mountCells(doc, built.contract);
    const rendered = await renderCells(built, cells);
    const diff = diffRenderedAgainstFacts(doc, built, cells, rendered);
    assert.equal(diff.counts.unexplainedDeltas, 0);
    assert.equal(diff.counts.silent, 0);
    assert.equal(diff.ledger.filter(r => r.computed === "hidden direct instance absence").length, 144);
    const extra = structuredClone(rendered);
    extra[0].children.push({tag:"SPAN",text:"",width:"16px",height:"16px"});
    assert.throws(() => diffRenderedAgainstFacts(doc, built, cells, extra), /visible instance count mismatch/);
    const scene = structuredClone(doc.scene);
    // A hidden first instance must not shift the second, visible instance.
    scene.children[0].children[2].visible = true;
    const mixed = deriveCanvasFacts(scene, doc.source);
    assert.throws(() => diffRenderedAgainstFacts(mixed, built, cells, rendered), /visible instance count mismatch/);
    const present = structuredClone(rendered);
    present[0].children.push({tag:"SPAN",text:"",width:"16px",height:"16px"});
    const observed = diffRenderedAgainstFacts(mixed, built, cells, present);
    assert.equal(observed.counts.unexplainedDeltas, 0);
    present[0].children[0].width = "9px";
    assert.throws(() => diffRenderedAgainstFacts(mixed, {...built,proposalNotes:[]}, cells, present), /UNEXPLAINED render delta/);
  } finally { rmSync(temp, {recursive:true,force:true}); }
});

test("projected source states mount through previews and browser states without inventing enum props", async () => {
  const doc = JSON.parse(gunzipSync(readFileSync(new URL(
    './evidence/canvas-to-code-held-out-current-hidden-instances-2026-10-04/designer/altitude-link/canvas-facts.json.gz', import.meta.url,
  ))).toString()) as CanvasFactsDocument;
  const temp=mkdtempSync(path.join(os.tmpdir(),'ds-state-mount-'));
  try {
    const built=await buildCanvasToCodeFromFacts(doc,temp);
    const cells=mountCells(doc,built.contract);
    assert.equal(cells.length,doc.hierarchy.children.filter(c=>c.type==='COMPONENT').length);
    assert.equal(cells.find(c=>c.variantProperties.State==='Hover')?.interactionState,'hover');
    assert.equal(cells.find(c=>c.variantProperties.State==='Disabled')?.props.disabled,'true');
    assert.equal(cells.find(c=>c.variantProperties.State==='Default')?.props.disabled,'false');
    const rendered=await renderCells(built,cells);
    assert.equal(rendered.length,cells.length);
    assert.equal(diffRenderedAgainstFacts(doc,built,cells,rendered).counts.unexplainedDeltas,0);
    const focus=cells.find(c=>c.variantProperties.State==='Focus')!;
    assert.equal(rendered.find(c=>c.key===focus.key)!.root['padding-left'],'4px');
    const planted=structuredClone(rendered);
    planted.find(c=>c.key===focus.key)!.root['padding-left']='0px';
    assert.throws(()=>diffRenderedAgainstFacts(doc,built,cells,planted),/UNEXPLAINED render delta\(s\):[\s\S]*padding/,
      'a missing state padding must remain a measured failure');
    appendFileSync(path.join(built.generatedDir,'Link','Link.module.css'),'\n.root:hover { outline: 7px solid red; }\n');
    const hovered=await renderCells(built,cells);
    const hover=cells.find(c=>c.variantProperties.State==='Hover')!;
    const rest=cells.find(c=>c.variantProperties.State==='Default')!;
    assert.equal(hovered.find(c=>c.key===hover.key)!.root['outline-width'],'7px');
    assert.notEqual(hovered.find(c=>c.key===rest.key)!.root['outline-width'],'7px');
    const unknown=structuredClone(doc);
    unknown.hierarchy.children.find(c=>c.variantProperties?.State==='Hover')!.variantProperties!.State='Mystery';
    assert.throws(()=>mountCells(unknown,built.contract),/has no contract prop/);
  } finally {rmSync(temp,{recursive:true,force:true});}
});

test("a drawn field group keeps its labels instead of becoming invalid textarea children", async () => {
  const {ContractSchema}=await import('../scripts/contract-schema.js');
  const {validateContract}=await import('../core/emit-react.js');
  const doc=JSON.parse(gunzipSync(readFileSync(new URL(
    './evidence/canvas-to-code-held-out-current-hidden-instances-2026-10-04/designer/altitude-textarea/canvas-facts.json.gz',import.meta.url,
  ))).toString()) as CanvasFactsDocument;
  const temp=mkdtempSync(path.join(os.tmpdir(),'ds-field-group-'));
  try {
    const built=await buildCanvasToCodeFromFacts(doc,temp);
    const c=ContractSchema.parse(built.contract);
    assert.equal(c.semantics.element,'div');
    assert(built.proposalNotes.some(n=>n.includes('textarea')&&n.includes('REVIEW')));
    const cells=mountCells(doc,built.contract),rendered=await renderCells(built,cells);
    assert.equal(rendered.length,6);
    assert(rendered.every(cell=>cell.label?.text==='Label'));
    assert.equal(diffRenderedAgainstFacts(doc,built,cells,rendered).counts.unexplainedDeltas,0);
    const issues=()=>{const errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());return errors;};
    c.semantics.element='textarea';
    assert(issues().some(e=>e.includes('cannot mount element children inside <textarea>')));
    c.semantics.element='div';
    c.anatomy.root.parts!.invalid={element:'textarea',parts:{label:{text:'Keep me'}}};
    assert(issues().some(e=>e.includes('part "invalid" cannot mount element children')));
    c.anatomy.root={text:'A valid text value'};
    c.semantics.element='textarea';
    assert(!issues().some(e=>e.includes('cannot mount element children')),'plain text is legal textarea content');
  } finally {rmSync(temp,{recursive:true,force:true});}
});
