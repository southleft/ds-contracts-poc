import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { build } from "esbuild";
import { cssIdentifier } from "../packages/core/src/css-identifier.js";
import { ContractSchema } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { mountGenerated } from "./react-test-runtime.js";

test("observed anatomy keys remain literal class names rather than selector syntax", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  t.after(() => page.close());
  const names = [
    "[&>svg]:size-3.5",
    "1first",
    "name:with.hover",
    "-",
    "-2starts",
    'quote"value',
    "back\\slash",
    "café",
  ];
  for (const name of [...names, "\0", "\n", "a b"])
    assert.equal(
      cssIdentifier(name),
      await page.evaluate((name) => CSS.escape(name), name),
    );
  const contract = ContractSchema.parse({
    id: "probe.css-identity",
    name: "Surface",
    version: "1.0.0",
    status: "draft",
    description: "Literal source anatomy keys.",
    semantics: { element: "div" },
    props: [],
    states: [],
    anatomy: {
      root: {
        parts: Object.fromEntries(
          names.map((name) => [
            name,
            {
              element: "span",
              text: name,
              declared: { display: "block" },
              literals: {
                "background-color": "rgb(1, 2, 3)",
                width: "8px",
                height: "8px",
              },
            },
          ]),
        ),
      },
    },
    bindings: {
      code: { anchors: { importPath: "./Surface", export: "Surface" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const output = emitReact(contract, {
    contracts: new Map([[contract.id, contract]]),
    icons: new Map(),
    tokens: new Set(),
  });
  const parsed = await build({
    stdin: { contents: output.css, loader: "css" },
    write: false,
    logLevel: "silent",
  });
  assert.deepEqual(parsed.warnings, []);
  await mountGenerated(page, contract.name, output.tsx, output.css);
  for (const name of names) {
    const style = await page
      .getByText(name, { exact: true })
      .evaluate((el) => ({
        className: el.className,
        background: getComputedStyle(el).backgroundColor,
        width: getComputedStyle(el).width,
      }));
    assert.equal(style.className, `Surface_${name}`);
    assert.equal(style.background, "rgb(1, 2, 3)");
    assert.equal(style.width, "8px");
  }
  // Inline output has no CSS-module selector, but must preserve the same
  // source text rather than interpret JSX punctuation or HTML entities.
  contract.anatomy.root.parts!.literal = {
    element: "span", text: "a > b &amp; {value}",
  };
  const inline = emitReactInline(contract, {
    contracts: new Map([[contract.id, contract]]), icons: new Map(),
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
  });
  await mountGenerated(page, contract.name, inline.tsx);
  for (const text of [...names, "a > b &amp; {value}"])
    assert.equal(await page.getByText(text, { exact: true }).count(), 1);
});
