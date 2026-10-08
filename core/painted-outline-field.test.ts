import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { mapRestToDump } from "../extract/figma/rest/map.js";
import { proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import { ContractSchema } from "../scripts/contract-schema.js";
import { createFigmaEngine } from "./emit-figma-script.js";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { chromium } from "playwright-core";
import { emitReactInline } from "./emit-react-inline.js";
import { emitReact } from "./emit-react.js";
import { mountGenerated } from "./react-test-runtime.js";
import {
  readPng,
  diffPair,
  writeTriptych,
} from "../extract/figma/visual-parity/img.js";
const source = JSON.parse(
  readFileSync(
    new URL(
      "../extract/figma/fixtures/painted-stroke-native.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const captured = JSON.parse(
    readFileSync(
      new URL(
        "../extract/figma/fixtures/painted-stroke-source.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
  svgs = captured.rows;
const mapped = mapRestToDump(source, {
  fileKey: captured.fileKey,
  inspectPaintedStrokeOutlines: true,
  strokeSvgSources: {
    fileKey: captured.fileKey,
    version: captured.version,
    svgByNodeId: Object.fromEntries(
      svgs.map((r: any) => [r.observed.nodeId, r.svg]),
    ),
  },
});
const results = Object.entries(mapped.dump)
  .filter(([name]) => !name.startsWith("_"))
  .map(([name, set]) => ({
    name,
    proposal: proposeFromDump(set as never, {
      corpus: tokenCorpusFromJson({
        primitives: {},
        semantic: {},
        light: {},
        brandDefault: {},
      }),
      contractIdByName: new Map(),
      projectionMode: "reviewable-inversion",
      mintUnbound: true,
    }),
  }));
test("real wave proposals preserve variant viewport, logical size and all source ink in both React emitters", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "ds-contracts-wave-field-"));
  const browser = await chromium.launch(),
    scores: unknown[] = [];
  try {
    for (const r of results) {
      const c = ContractSchema.parse(r.proposal.contract),
        contracts = new Map([[c.id, c]]),
        icons = new Map(),
        tokens = {
          primitives: r.proposal.mintedTokens!.tree,
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        };
      const parent = (
        Object.values(source.nodes).find(
          (e: any) => e.document.name === r.name,
        ) as any
      ).document;
      const native = createFigmaEngine({ tokens, icons }).compileComponentData(
        c,
        contracts,
      );
      assert.equal(native.variants.length, 2);
      const cssVars = r.proposal
        .mintedTokens!.entries.map(
          (e: any) =>
            "--" + e.ref.slice(1, -1).replaceAll(".", "-") + ":" + e.value,
        )
        .join(";");
      for (const surface of ["module", "inline"]) {
        const code =
          surface === "module"
            ? emitReact(c, {
                contracts,
                icons,
                tokens: new Set(
                  r.proposal.mintedTokens!.entries.map((e) =>
                    e.ref.slice(1, -1),
                  ),
                ),
              })
            : { ...emitReactInline(c, { contracts, icons, tokens }), css: "" };
        const page = await browser.newPage({
          viewport: { width: 80, height: 64 },
          deviceScaleFactor: 1,
        });
        const render = await mountGenerated(page, c.name, code.tsx, code.css);
        await page.addStyleTag({
          content: `body{margin:0;background:transparent}#root{position:absolute;display:flex;left:16px;top:16px}:root{${cssVars}}`,
        });
        for (const n of parent.children) {
          const wavelength = n.name.endsWith("=40") ? "40" : "20";
          await render({ wavelength });
          const layout = await page.locator("#root > *").boundingBox(),
            a = await page.screenshot({ omitBackground: true });
          assert.deepEqual(layout, { x: 16, y: 16, width: 40, height: 12 });
          const ref = await browser.newPage({
            viewport: { width: 80, height: 64 },
            deviceScaleFactor: 1,
          });
          let content = "";
          for (const child of n.children) {
            const svg = svgs.find(
              (r: any) => r.observed.nodeId === child.id,
            ).svg;
            content += `<div style="position:absolute;left:${child.relativeTransform[0][2]}px;top:${child.relativeTransform[1][2]}px">${svg}</div>`;
          }
          await ref.setContent(
            `<style>body{margin:0;background:transparent}svg{display:block;overflow:visible}</style><div style="position:absolute;left:16px;top:16px;width:40px;height:12px">${content}</div>`,
          );
          const b = await ref.screenshot({ omitBackground: true });
          await ref.close();
          const label = n.id.replace(":", "-") + "-" + surface;
          writeFileSync(out + "/" + label + ".png", a);
          writeFileSync(out + "/" + label + "-source.png", b);
          for (const bg of [0, 255] as const) {
            const pa = readPng(a),
              pb = readPng(b);
            for (const png of [pa, pb])
              for (let i = 0; i < png.data.length; i += 4) {
                const alpha = png.data[i + 3] / 255;
                for (let k = 0; k < 3; k++)
                  png.data[i + k] = Math.round(
                    png.data[i + k] * alpha + bg * (1 - alpha),
                  );
                png.data[i + 3] = 255;
              }
            const pair = {
                a: pa,
                b: pb,
                width: 80,
                height: 64,
                aContent: { width: 80, height: 64 },
                bContent: { width: 80, height: 64 },
                aOffset: { x: 0, y: 0 },
                aTrimOrigin: { x: 0, y: 0 },
              },
              diff = diffPair(pair, []);
            assert.equal(diff.diffCount, 0, `${label}/${bg}`);
            writeTriptych(
              out + "/" + label + "-" + bg + ".png",
              pair,
              diff.diff,
            );
            scores.push({
              node: n.id,
              surface,
              wavelength,
              layout,
              background: bg,
              diffCount: diff.diffCount,
            });
          }
        }
        await page.close();
      }
    }
    writeFileSync(out + "/RESULT.json", JSON.stringify(scores, null, 2));
    console.log("Wave field evidence: " + out);
  } finally {
    await browser.close();
  }
});

test('variant viewports refuse missing coordinates, unrelated parent channels and native basis mismatch', () => {
  const original=ContractSchema.parse(results[0]!.proposal.contract);
  const tokens={primitives:results[0]!.proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
  const target=(c:any)=>{let found:any;const walk=(p:any,parent?:any)=>{if(p.shape?.pathsByProp)found={part:p,parent};for(const child of Object.values(p.parts??{}))walk(child,p);};walk(c.anatomy.root);return found;};
  for(const mutate of [
    (t:any)=>{delete t.part.shape.pathsByProp.map['20'].parentViewport;},
    (t:any)=>{delete t.part.shape.parentViewport;},
    (t:any)=>{t.parent.literalsByProp=[{prop:'wavelength',map:{'20':{'background-color':'red'},'40':{'background-color':'blue'}}}];},
    (t:any)=>{t.parent.parts.extra=structuredClone(t.part);t.parent.parts.extra.shape.pathsByProp.map['20'].parentViewport.width+=1;},
  ]){
    const c=structuredClone(original);mutate(target(c));
    assert.throws(()=>emitReactInline(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens}),/filled-path/);
  }
  const c=structuredClone(original);target(c).part.shape.pathsByProp.map['20'].parentViewport.width+=1;
  assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]])),/filled-path-parent-basis-mismatch/);
});
