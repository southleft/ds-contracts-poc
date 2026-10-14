import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { build } from "esbuild";
import { cssIdentifier } from "../packages/core/src/css-identifier.js";
import { ContractSchema } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { mountGenerated } from "./react-test-runtime.js";
import { emitTokensCss, mentionedCssVars, referencedCssVars, tokensCssLayers, undefinedCssVars } from "./emit-tokens-css.js";
import { tokenInventoryFromJson } from "./tokens.js";

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

test("scoped token sheets preserve generated Unicode variant values and their paints", async (t) => {
  const paints = {
    默认: { 常规: "#165dff", "🚀": "#f53f3f" },
    成功: { 常规: "#00b42a", "🚀": "#ff7d00" },
  };
  const tree = { imported: { ink: Object.fromEntries(Object.entries(paints).map(([tone, states]) =>
    [tone, Object.fromEntries(Object.entries(states).map(([state, value]) => [state, { $type: "color", $value: value }]))])),
    unused: { $type: "color", $value: "#abcdef" } } };
  const contract = ContractSchema.parse({
    id: "probe.unicode-tokens", name: "UnicodeTokens", version: "1.0.0", status: "draft",
    description: "Original Unicode variant values retain their token paints.", semantics: { element: "div" },
    props: [
      { name: "tone", type: { enum: ["默认", "成功"] }, default: "默认", bindings: { figma: { kind: "VARIANT", property: "类型" }, code: { prop: "tone" } } },
      { name: "state", type: { enum: ["常规", "🚀"] }, default: "常规", bindings: { figma: { kind: "VARIANT", property: "状态" }, code: { prop: "state" } } },
    ], states: [],
    anatomy: { root: { parts: { "标签🧪": { text: "Link", tokens: { color: "{imported.ink.{tone}.{state}}" } } } } },
    bindings: {
      code: { anchors: { importPath: "./UnicodeTokens", export: "UnicodeTokens" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([tree]) });
  const sheet = emitTokensCss([{ name: "default", selector: ":root", parts: [{ slot: "observed", tree }] }],
    { only: mentionedCssVars(output.css + output.tsx) });
  const expected = Object.entries(paints).flatMap(([tone, states]) => Object.keys(states).map(state => `--imported-ink-${tone}-${state}`)).sort();
  assert.deepEqual(sheet.defined, expected);
  assert.deepEqual(undefinedCssVars(referencedCssVars(output.css), sheet.defined), []);
  assert.doesNotMatch(sheet.css, /--imported-unused/);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); t.after(() => page.close());
  const render = await mountGenerated(page, contract.name, output.tsx, output.css);
  await page.addStyleTag({ content: sheet.css });
  for (const [tone, states] of Object.entries(paints)) for (const [state, color] of Object.entries(states)) {
    await render({ tone, state });
    const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
    assert.equal(await page.getByText("Link", { exact: true }).evaluate(el => getComputedStyle(el).color), `rgb(${channels.join(", ")})`);
  }
});

test("Unicode token selection follows aliases and fallback dependencies across modes", () => {
  const trees = {
    primitives: { palette: { "红🚀": { $type: "color", $value: "#123456" }, 夜: { $type: "color", $value: "#abcdef" }, unused: { $type: "color", $value: "#000000" } } },
    semantic: { semantic: { 默认: { $type: "color", $value: "{palette.红🚀}" } } },
    light: {}, dark: { semantic: { 默认: { $type: "color", $value: "{palette.夜}" } } }, brands: {},
  };
  const css = ".label { color: var(--semantic-默认); background: var(--外部, var(--palette-红🚀)); }";
  const sheet = emitTokensCss(tokensCssLayers(trees), { only: mentionedCssVars(css) });
  assert.deepEqual(sheet.defined, ["--palette-夜", "--palette-红🚀", "--semantic-默认"]);
  assert.deepEqual(sheet.modes, [{ name: "dark", selector: '[data-theme="dark"]', count: 1 }]);
  assert.deepEqual(undefinedCssVars(referencedCssVars(css), sheet.defined), []);
  assert.deepEqual(undefinedCssVars(referencedCssVars("color: var(--缺少🚀)"), sheet.defined), ["--缺少🚀"]);
  assert.deepEqual(sheet.danglingAliases, []);
  assert.doesNotMatch(sheet.css, /--palette-unused/);
});

test("CSS variable scans decode full identifiers without accepting punctuation prefixes", () => {
  const css = String.raw`color: var(--\9ed8\8ba4); fill: var(--\01f680 ); border: var(--a\.b); outline: var(--optional, var(--后备));`;
  assert.deepEqual(referencedCssVars(css), ["--a.b", "--后备", "--默认", "--🚀"].sort());
  assert.deepEqual(mentionedCssVars(css), ["--a.b", "--optional", "--后备", "--默认", "--🚀"].sort());
  for (const invalid of ["var(--bad.name)", "var(--bad/name)", "var(--bad:name)", "var(--bad name)", "var(--bad\\\nname)"])
    assert.deepEqual(mentionedCssVars(invalid), [], invalid);
  assert.deepEqual(referencedCssVars(String.raw`.root { --_\8272: red; color: var(--_色); }`), []);
  assert.deepEqual(referencedCssVars(String.raw`/* --_\8272: red; */ .root { color: var(--_色); }`), ["--_色"]);
  assert.deepEqual(referencedCssVars(String.raw`color: var(--\0 ); fill: var(--\110000);`), ["--�"]);
});
