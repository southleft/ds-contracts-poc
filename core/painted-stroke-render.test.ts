import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { chromium } from "playwright-core";
import { ContractSchema } from "../scripts/contract-schema.js";
import { paintedStrokeSvgObservation } from "../extract/figma/rest/stroke-svg.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { mountGenerated } from "./react-test-runtime.js";
import { createFigmaEngine } from "./emit-figma-script.js";
import {
  readPng,
  diffPair,
  writeTriptych,
} from "../extract/figma/visual-parity/img.js";
const source = JSON.parse(
  readFileSync(
    new URL(
      "../extract/figma/fixtures/painted-stroke-source.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
// A representation probe, not automatic ingestion or a native roundtrip claim.
// M/L/Q/C ink stays within the convex hull of its endpoints and controls.
// Keep the logical box, position a conservative integer paint frame around
// that hull, and retain original path bytes in its translated child plane.
test("explicit outlined contracts preserve logical size, bound ink and overflow on both React emitters", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "ds-contracts-outline-ink-"));
  const browser = await chromium.launch();
  const results: Array<{
    node: string;
    surface: string;
    background: number;
    mismatch: number;
  }> = [];
  try {
    for (const row of source.rows) {
      const joined = paintedStrokeSvgObservation(row.svg, row.observed);
      if (!("observation" in joined)) throw Error(JSON.stringify(joined));
      const o = joined.observation.source;
      const nums = o.paths[0].path
        .match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!
        .map(Number);
      const xs = nums.filter((_: number, i: number) => i % 2 === 0),
        ys = nums.filter((_: number, i: number) => i % 2 === 1);
      const x = Math.floor(Math.min(...xs)),
        y = Math.floor(Math.min(...ys)),
        w = Math.ceil(Math.max(...xs)) - x,
        h = Math.ceil(Math.max(...ys)) - y;
      assert(
        x + 16 >= 0 && y + 16 >= 0 && x + w + 16 <= 80 && y + h + 16 <= 64,
        "the complete control hull must fit the capture",
      );
      const ink = {
        shape: {
          kind: "path",
          width: o.width,
          height: o.height,
          paths: o.paths.map((p) => ({
            data: p.path,
            windingRule: p.windingRule,
          })),
          parentViewport: { width: w, height: h, x: -x, y: -y },
        },
        tokens: { "background-color": "{ink}" },
      };
      const plane = {
        declared: { position: "relative" },
        literals: { width: w + "px", height: h + "px" },
        parts: { ink },
      };
      const paint = {
        declared: { position: "absolute" },
        literals: {
          left: x + "px",
          top: y + "px",
          width: w + "px",
          height: h + "px",
        },
        parts: { plane },
      };
      const root = {
        declared: { position: "relative" },
        literals: { width: o.width + "px", height: o.height + "px" },
        parts: { paint },
      };
      const raw = {
        id: "probe.outline",
        name: "Outline",
        version: "1.0.0",
        description: "Explicit outlined ink; no editable stroke width.",
        archetype: "none",
        semantics: { element: "div" },
        props: [],
        states: [],
        anatomy: { root },
        bindings: {
          code: { anchors: { importPath: "./Outline", export: "Outline" } },
          figma: { anchors: { fileKey: null, componentSetKey: null } },
        },
      };
      const c = ContractSchema.parse(raw),
        contracts = new Map([[c.id, c]]),
        icons = new Map();
      const tokens = {
        primitives: { ink: { $type: "color", $value: o.strokeColor } },
        semantic: {},
        light: {},
        dark: {},
        brands: { default: {} },
      };
      const native = createFigmaEngine({ tokens, icons }).compileComponentData(
        c,
        contracts,
      );
      const spec = native.variants[0]!.spec;
      assert.deepEqual(spec.lits, { width: o.width, height: o.height });
      const positioned = spec.children![0]!;
      assert.equal(positioned.absolute!.left, x);
      assert.equal(positioned.absolute!.top, y);
      const inkSpec = positioned.children![0]!.children![0]!.children![0]!;
      assert.equal(inkSpec.fill, "ink");
      assert.equal(inkSpec.stroke, undefined);
      assert.deepEqual(
        inkSpec.shape!.paths,
        o.paths.map((p) => ({ data: p.path, windingRule: p.windingRule })),
      );
      assert.equal(
        positioned.children![0]!.children![0]!.clipsContent,
        undefined,
      );
      writeFileSync(
        out + "/" + o.nodeId.replace(":", "-") + "-native.json",
        JSON.stringify(native, null, 2),
      );
      for (const surface of ["module", "inline"]) {
        const code =
          surface === "module"
            ? emitReact(c, { contracts, icons, tokens: new Set(["ink"]) })
            : { ...emitReactInline(c, { contracts, icons, tokens }), css: "" };
        const page = await browser.newPage({
          viewport: { width: 80, height: 64 },
          deviceScaleFactor: 1,
        });
        await mountGenerated(page, c.name, code.tsx, code.css);
        await page.addStyleTag({
          content: `body{margin:0;background:transparent}#root{display:flex;position:absolute;left:16px;top:16px}:root{--ink:${o.strokeColor}}`,
        });
        assert.deepEqual(await page.locator("#root > *").boundingBox(), {
          x: 16,
          y: 16,
          width: o.width,
          height: o.height,
        });
        const a = await page.screenshot({ omitBackground: true });
        await page.close();
        const ref = await browser.newPage({
          viewport: { width: 80, height: 64 },
          deviceScaleFactor: 1,
        });
        await ref.setContent(
          `<style>body{margin:0;background:transparent}svg{position:absolute;left:16px;top:16px;overflow:visible}</style>${row.svg}`,
        );
        const b = await ref.screenshot({ omitBackground: true });
        await ref.close();
        const label = o.nodeId.replace(":", "-") + "-" + surface;
        writeFileSync(out + "/" + label + ".png", a);
        writeFileSync(out + "/" + label + "-source.png", b);
        // Same recorded viewport and logical origin on both sides. Never trim or
        // independently align ink: that would conceal a translation regression.
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
          writeTriptych(out + "/" + label + "-" + bg + ".png", pair, diff.diff);
          results.push({
            node: o.nodeId,
            surface,
            background: bg,
            mismatch: diff.unmaskedPct,
          });
        }
      }
    }
    writeFileSync(
      out + "/RESULT.json",
      JSON.stringify(
        {
          classification:
            "Prototype explicit outlined contracts only; not public importer, native readback or scoreboard qualification.",
          results,
        },
        null,
        2,
      ),
    );
    console.log("Outlined ink evidence: " + out);
  } finally {
    await browser.close();
  }
});
