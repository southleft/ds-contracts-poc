import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ContractSchema } from "../../../scripts/contract-schema.js";
import { emitReact } from "../../../core/emit-react.js";
import { emitHtml } from "../../../core/emit-html.js";
import {
  prepareSelectionSetup,
  type SelectionSetup,
} from "./selection-setup.js";

const bindings = {
  code: { anchors: { importPath: "./authored", export: "Authored" } },
  figma: { anchors: { fileKey: null, componentSetKey: null } },
};
const child = ContractSchema.parse({
  id: "example.item",
  name: "Item",
  version: "1.0.0",
  status: "draft",
  description: "Presentational item.",
  props: [
    {
      name: "label",
      type: "text",
      default: "Item",
      bindings: {
        code: { prop: "children" },
        figma: { kind: "TEXT", property: "Label" },
      },
    },
    {
      name: "active",
      type: { enum: ["no", "yes"] },
      default: "no",
      bindings: {
        code: { prop: "active" },
        figma: {
          kind: "VARIANT",
          property: "Active",
          values: { no: "No", yes: "Yes" },
        },
      },
    },
    {
      name: "disabled",
      type: "boolean",
      default: false,
      bindings: {
        code: { prop: "disabled" },
        figma: { kind: "BOOLEAN", property: "Disabled" },
      },
    },
  ],
  states: [],
  semantics: { element: "button" },
  anatomy: { root: { parts: { label: { content: { prop: "children" } } } } },
  bindings,
});
const panel = ContractSchema.parse({
  id: "example.panel",
  name: "Panel",
  version: "1.0.0",
  status: "draft",
  description: "The one observed panel.",
  props: [],
  states: [],
  semantics: { element: "div" },
  anatomy: { root: { parts: { copy: { text: "Only observed body" } } } },
  bindings,
});
function fixture() {
  return ContractSchema.parse({
    id: "example.collection",
    name: "Collection",
    version: "1.0.0",
    status: "draft",
    description: "Observed collection with one panel.",
    props: [
      {
        name: "items",
        type: { arrayOf: { label: "text", active: { enum: ["no", "yes"] } } },
        bindings: { code: { prop: "items" }, figma: { kind: "NONE" } },
      },
    ],
    states: [],
    semantics: { element: "div" },
    anatomy: {
      root: {
        parts: {
          header: {
            parts: {
              list: {
                parts: {
                  item: {
                    component: { id: child.id },
                    repeat: {
                      itemsProp: "items",
                      sample: [
                        { label: "Same label", active: "yes" },
                        { label: "Same label", active: "no" },
                        { label: "Same label", active: "no" },
                      ],
                    },
                  },
                },
              },
            },
          },
          body: {
            layout: { display: "flex", direction: "column" },
            parts: { observedPanel: { component: { id: panel.id } } },
          },
        },
      },
    },
    bindings,
  });
}
const scope = (source = fixture()) =>
  new Map([
    [source.id, source],
    [child.id, child],
    [panel.id, panel],
  ]);
function input(): SelectionSetup {
  return {
    itemPart: "item",
    keyField: "itemId",
    listLabel: "Product views",
    valueProp: "selection",
    valueCode: "value",
    initialCode: "defaultValue",
    callbackCode: "onValueChange",
    selectedProp: "active",
    selectedOn: "yes",
    selectedOff: "no",
    panelContainer: "body",
    initialKey: "alpha",
    orientation: "horizontal",
    direction: "ltr",
    activation: "automatic",
    items: [
      {
        key: "alpha",
        panel: { kind: "existing", part: "observedPanel" },
        focusable: true,
      },
      {
        key: "beta",
        panel: { kind: "slot", part: "secondPanel", slot: "secondContent" },
        focusable: true,
      },
      {
        key: "gamma",
        panel: { kind: "slot", part: "thirdPanel", slot: "thirdContent" },
        focusable: false,
      },
    ],
  };
}

test("reviewed setup preserves captured content, adds only explicitly chosen empty slots and leaves source inputs unchanged", () => {
  const source = fixture(),
    byId = scope(source),
    config = input(),
    before = JSON.stringify([source, [...byId], config]);
  const first = prepareSelectionSetup(source, byId, config),
    second = prepareSelectionSetup(source, byId, config);
  assert.deepEqual(first, second, "unchanged review is deterministic");
  assert.equal(JSON.stringify([source, [...byId], config]), before);
  const after = first.contract;
  assert.deepEqual(after.anatomy.root.parts!.body.parts!.observedPanel, {
    ...source.anatomy.root.parts!.body.parts!.observedPanel,
    visibleWhen: { prop: "selection", equals: "alpha" },
  });
  assert.deepEqual(after.anatomy.root.parts!.body.parts!.secondPanel, {
    element: "div",
    slot: { name: "secondContent" },
    visibleWhen: { prop: "selection", equals: "beta" },
  });
  const repeat =
    after.anatomy.root.parts!.header.parts!.list.parts!.item.repeat!;
  assert.deepEqual(repeat.sample, [
    { label: "Same label", itemId: "alpha" },
    { label: "Same label", itemId: "beta" },
    { label: "Same label", itemId: "gamma" },
  ]);
  assert.ok(
    first.changes.some((change) =>
      change.includes("no content is captured or invented"),
    ),
  );
  const output = emitReact(after, {
    contracts: new Map([...byId, [after.id, after]]),
    tokens: new Set(),
    icons: new Map(),
  });
  assert.match(output.tsx, /onValueChange/);
  assert.match(output.tsx, /secondContent/);
  assert.throws(
    () => prepareSelectionSetup(after, byId, config),
    /already configured/,
  );
});

test("existing panels and disabled records remain intact; a disabled initial choice refuses", () => {
  const source = fixture();
  const body = source.anatomy.root.parts!.body;
  body.parts!.secondBody = {
    parts: { secondCopy: { text: "Second captured body" } },
  };
  body.parts!.thirdBody = {
    parts: { thirdCopy: { text: "Third captured body" } },
  };
  const repeat =
    source.anatomy.root.parts!.header.parts!.list.parts!.item.repeat!;
  (
    source.props[0].type as { arrayOf: Record<string, unknown> }
  ).arrayOf.disabled = "boolean";
  repeat.sample.forEach((record, index) => {
    record.disabled = index === 1;
  });
  const config = input();
  config.disabledField = "disabled";
  config.items[1].panel = { kind: "existing", part: "secondBody" };
  config.items[2].panel = { kind: "existing", part: "thirdBody" };
  const before = JSON.stringify(source);
  const configured = prepareSelectionSetup(
    source,
    scope(source),
    config,
  ).contract;
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(
    Object.keys(configured.anatomy.root.parts!.body.parts!),
    Object.keys(body.parts!),
  );
  for (const name of Object.keys(body.parts!)) {
    const { visibleWhen, ...content } =
      configured.anatomy.root.parts!.body.parts![name];
    assert.ok(visibleWhen);
    assert.deepEqual(content, body.parts![name]);
  }
  const ctx = {
    contracts: new Map([...scope(source), [configured.id, configured]]),
    tokens: new Set<string>(),
    icons: new Map(),
  };
  assert.match(emitReact(configured, ctx).tsx, /onValueChange/);
  assert.doesNotThrow(() => emitHtml(configured, ctx));
  config.initialKey = "beta";
  assert.throws(
    () => prepareSelectionSetup(source, scope(source), config),
    /selection-sample-initial-disabled/,
  );
  // The current Playground preview substitutes prop defaults. Record its
  // disabled-value limitation without weakening initial-state validation.
  const previewState = structuredClone(configured);
  previewState.props.find((prop) => prop.name === "selection")!.default =
    "beta";
  assert.throws(
    () => emitHtml(previewState, ctx),
    /selection-sample-initial-disabled/,
  );
});

test("incomplete mappings, identity replacement and public-name collisions refuse before any source mutation", () => {
  const source = fixture(),
    original = JSON.stringify(source);
  const cases: Array<[RegExp, (setup: SelectionSetup) => void]> = [
    [/distinct, nonempty/, (s) => (s.items[1].key = "alpha")],
    [/distinct, nonempty/, (s) => (s.items[0].key = "")],
    [/initially selected/, (s) => (s.initialKey = "missing")],
    [/every observed item/, (s) => s.items.pop()],
    [/existing record field/, (s) => (s.keyField = "label")],
    [/distinct child variants/, (s) => (s.selectedOff = "yes")],
    [
      /direct children/,
      (s) => (s.items[0].panel = { kind: "existing", part: "header" }),
    ],
    [
      /unused React name/,
      (s) =>
        (s.items[1].panel = { kind: "slot", part: "extra", slot: "value" }),
    ],
    [/distinct and unused/, (s) => (s.callbackCode = "value")],
    [
      /unused camelCase/,
      (s) =>
        (s.items[1].panel = {
          kind: "slot",
          part: "body",
          slot: "extraContent",
        }),
    ],
  ];
  for (const [expected, mutate] of cases) {
    const config = input();
    mutate(config);
    assert.throws(
      () => prepareSelectionSetup(source, scope(source), config),
      expected,
    );
    assert.equal(JSON.stringify(source), original);
  }
  const keyed = fixture();
  const repeat =
    keyed.anatomy.root.parts!.header.parts!.list.parts!.item.repeat!;
  (keyed.props[0].type as { arrayOf: Record<string, unknown> }).arrayOf.itemId =
    "text";
  repeat.keyField = "itemId";
  repeat.sample.forEach(
    (record, i) => (record.itemId = ["alpha", "beta", "gamma"][i]),
  );
  const config = input();
  config.items[1].key = "renamed";
  assert.throws(
    () => prepareSelectionSetup(keyed, scope(keyed), config),
    /identities must stay unchanged/,
  );
});

test("the actual setup form requires review, invalidates changed reviews and applies the explicit relationship", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const source = fixture();
  const code = `import React from 'react';import {createRoot} from 'react-dom/client';import {SelectionSetup} from './playground/src/components/SelectionSetup';
    const contract=${JSON.stringify(source)};const contracts=new Map(${JSON.stringify([...scope(source)])});
    createRoot(document.getElementById('root')).render(<SelectionSetup contract={contract} contracts={contracts} onEditJson={()=>{}} onApply={next=>{if(window.refuseApply)throw Error('Current contract changed');window.applied=next;}}/>);`;
  const bundle = await build({
    stdin: { contents: code, loader: "tsx", resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent('<div id="root" style="max-width:620px"></div>');
  await page.addStyleTag({
    content: readFileSync(
      path.join(process.cwd(), "playground/src/styles.css"),
      "utf8",
    ),
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page
    .getByRole("heading", { name: "Configure tab navigation" })
    .waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    await page
      .getByRole("button", { name: "Apply selection to contract" })
      .count(),
    0,
  );
  await page.getByLabel("Repeated items", { exact: true }).selectOption("item");
  await page.getByRole("button", { name: "Review selection setup" }).click();
  assert.match(await page.getByRole("alert").innerText(), /stable key/);
  await page.getByLabel("List label", { exact: true }).fill("Product views");
  await page
    .getByLabel("Selected appearance property", { exact: true })
    .selectOption("active");
  await page.getByLabel("Selected value", { exact: true }).selectOption("yes");
  await page.getByLabel("Unselected value", { exact: true }).selectOption("no");
  await page
    .getByLabel("Panel container", { exact: true })
    .selectOption("body");
  for (const [index, key] of ["alpha", "beta", "gamma"].entries()) {
    await page
      .getByLabel(`Stable key for item ${index + 1}`, { exact: true })
      .fill(key);
    await page
      .getByLabel(`Panel for item ${index + 1}`, { exact: true })
      .selectOption(index === 0 ? "existing:observedPanel" : "slot");
  }
  await page
    .getByLabel("Initially selected item", { exact: true })
    .selectOption("alpha");
  await page.getByRole("button", { name: "Review selection setup" }).click();
  await page.getByRole("region", { name: "Selection setup review" }).waitFor();
  assert.equal(await page.evaluate("window.applied"), undefined);
  if (process.env.DS_SELECTION_SETUP_SCREENSHOT)
    await page.screenshot({
      path: process.env.DS_SELECTION_SETUP_SCREENSHOT,
      fullPage: true,
    });
  await page
    .getByLabel("List label", { exact: true })
    .fill("Revised product views");
  assert.equal(
    await page
      .getByRole("button", { name: "Apply selection to contract" })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Review selection setup" }).click();
  await page.evaluate("window.refuseApply=true");
  await page
    .getByRole("button", { name: "Apply selection to contract" })
    .click();
  assert.equal(
    await page.getByRole("alert").innerText(),
    "Current contract changed",
  );
  assert.equal(await page.evaluate("window.applied"), undefined);
  await page.evaluate("window.refuseApply=false");
  await page
    .getByRole("button", { name: "Apply selection to contract" })
    .click();
  const applied = ContractSchema.parse(await page.evaluate("window.applied"));
  assert.equal(applied.selection?.panels.length, 3);
  assert.equal(
    applied.anatomy.root.parts!.body.parts!.observedPanel.component?.id,
    panel.id,
  );
  assert.equal(
    applied.anatomy.root.parts!.body.parts!.panel2.slot?.name,
    "panel2Content",
  );
  assert.equal(
    applied.anatomy.root.parts!.header.parts!.list.attrs?.["aria-label"],
    "Revised product views",
  );
});
