import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { ContractSchema } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { mountGenerated, generatedTypeErrors } from "./react-test-runtime.js";
import { svgIconViewport } from "./svg-icon-viewport.js";

test("both React targets render sized viewBox icons, including shared assets, optional selections and hidden states", async (t) => {
  const contract = ContractSchema.parse({
    id: "probe.icon-size",
    name: "Icons",
    version: "1.0.0",
    status: "draft",
    description: "Declared SVG viewports.",
    semantics: { element: "div" },
    props: [
      {
        name: "choice",
        type: { enum: ["check"] },
        bindings: {
          code: { prop: "choice" },
          figma: { kind: "VARIANT", property: "Choice", unsetValue: "(unset)" },
        },
      },
    ],
    states: [],
    anatomy: {
      root: {
        layout: { direction: "row" },
        parts: {
          small: {
            element: "span",
            icon: { asset: "check", size: 14 },
            literals: { color: "rgb(250, 250, 250)" },
          },
          large: { icon: { asset: "check", size: 28 } },
          optional: {
            icon: { asset: "{choice}", size: 18 },
            declared: { display: "none" },
            stylesWhen: [
              { prop: "choice", equals: "check", styles: { display: "flex" } },
            ],
          },
          authored: { icon: { asset: "rect" } },
        },
      },
    },
    bindings: {
      code: { anchors: { importPath: "./Icons", export: "Icons" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const check =
    '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet"><path d="M20 6L9 17L4 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const icons = new Map([
    ["check", check],
    [
      "rect",
      '<svg width="12" height="6" viewBox="0 0 24 12"><rect width="24" height="12"/></svg>',
    ],
  ]);
  for (const attrs of [
    "",
    'width="24"',
    "width='24' height='24'",
    'width = "24" height = "24"',
  ]) {
    const sized = svgIconViewport(check.replace("<svg ", `<svg ${attrs} `), 14);
    assert.equal((sized.match(/\swidth=/g) ?? []).length, 1);
    assert.equal((sized.match(/\sheight=/g) ?? []).length, 1);
    assert.match(sized, /stroke-width="2"/);
    assert.match(sized, /viewBox="0 0 24 24"/);
  }
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const inline of [false, true]) {
    const contracts = new Map([[contract.id, contract]]);
    const generated = inline
      ? {
          ...emitReactInline(contract, {
            contracts,
            icons,
            tokens: {
              primitives: {},
              semantic: {},
              light: {},
              dark: {},
              brands: { default: {} },
            },
          }),
          css: "",
        }
      : emitReact(contract, { contracts, icons, tokens: new Set() });
    assert.deepEqual(generatedTypeErrors(contract.name, generated.tsx), []);
    const page = await browser.newPage();
    const render = await mountGenerated(
      page,
      contract.name,
      generated.tsx,
      generated.css,
    );
    const sizes = () =>
      page
        .locator("svg")
        .evaluateAll((nodes) =>
          nodes.map((el) => [
            el.getBoundingClientRect().width,
            el.getBoundingClientRect().height,
          ]),
        );
    assert.deepEqual(
      await sizes(),
      [
        [14, 14],
        [28, 28],
        [12, 6],
      ],
      inline ? "inline" : "module",
    );
    await render({ choice: "check" });
    assert.deepEqual(await sizes(), [
      [14, 14],
      [28, 28],
      [18, 18],
      [12, 6],
    ]);
    assert.equal(
      await page
        .locator("svg")
        .first()
        .locator("path")
        .getAttribute("stroke-width"),
      "2",
    );
    assert.equal(
      await page
        .locator("svg")
        .first()
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(250, 250, 250)",
    );
    await render({});
    assert.deepEqual(await sizes(), [
      [14, 14],
      [28, 28],
      [12, 6],
    ]);
    await page.close();
  }
});
