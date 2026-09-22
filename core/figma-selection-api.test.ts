import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import {
  ContractSchema,
  walkAnatomy,
  type Contract,
} from "../scripts/contract-schema.js";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import { createFigmaEngine } from "./emit-figma-script.js";
import { proposeBatchFromDump, proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import { emitReactInline } from "./emit-react-inline.js";
import { emitReact } from "./emit-react.js";
import { mountGenerated, generatedTypeErrors } from "./react-test-runtime.js";
import { mapRestToDump } from "../extract/figma/rest/map.js";
import type { DumpNode, DumpSet } from "../extract/figma/types.js";

const bindings = {
  code: { anchors: { importPath: "./probe", export: "Probe" } },
  figma: { anchors: { fileKey: null, componentSetKey: null } },
};
const tokens = {
  primitives: {},
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};
const engine = createFigmaEngine({ tokens, icons: new Map() });
const child = ContractSchema.parse({
  id: "probe.choice",
  name: "Choice",
  version: "1.0.0",
  status: "draft",
  description: "Presentational item.",
  semantics: { element: "button" },
  props: [
    {
      name: "label",
      type: "text",
      default: "Choice",
      bindings: {
        code: { prop: "children" },
        figma: { kind: "TEXT", property: "Label" },
      },
    },
    {
      name: "active",
      type: { enum: ["off", "on"] },
      default: "off",
      bindings: {
        code: { prop: "active" },
        figma: {
          kind: "VARIANT",
          property: "Active",
          values: { off: "Off", on: "On" },
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
  anatomy: {
    root: {
      literals: { "background-color": "#ffffff" },
      literalsByProp: [
        { prop: "active", map: { on: { "background-color": "#ff0000" } } },
      ],
      parts: { label: { content: { prop: "children" } } },
    },
  },
  bindings,
});
const panel = ContractSchema.parse({
  id: "probe.pane",
  name: "Pane",
  version: "1.0.0",
  status: "draft",
  description: "Observed content.",
  semantics: { element: "div" },
  props: [],
  states: [],
  anatomy: { root: { text: "First panel" } },
  bindings,
});
function fixture(): Contract {
  return ContractSchema.parse({
    id: "probe.views",
    name: "Views",
    version: "1.0.0",
    status: "draft",
    description: "Explicit finite relationship.",
    semantics: { element: "div" },
    props: [
      {
        name: "entries",
        type: { arrayOf: { identity: "text", label: "text" } },
        bindings: { code: { prop: "items" }, figma: { kind: "NONE" } },
      },
      {
        name: "current",
        type: { enum: ["a", "b", "c"] },
        default: "a",
        bindings: {
          code: { prop: "value", initial: { prop: "defaultValue" } },
          figma: {
            kind: "VARIANT",
            property: "Current",
            values: { a: "A", b: "B", c: "C" },
          },
        },
      },
    ],
    states: [],
    selection: {
      pattern: "tabs",
      valueProp: "current",
      listPart: "list",
      itemPart: "item",
      selected: { prop: "active", on: "on", off: "off" },
      panels: [
        { value: "a", part: "first", focusable: true },
        { value: "b", part: "second", focusable: true },
        { value: "c", part: "third", focusable: true },
      ],
      orientation: "horizontal",
      direction: "ltr",
      activation: "automatic",
      bindings: { code: { prop: "onChange" } },
    },
    anatomy: {
      root: {
        parts: {
          list: {
            attrs: { "aria-label": "Views" },
            parts: {
              item: {
                component: { id: child.id },
                repeat: {
                  itemsProp: "entries",
                  keyField: "identity",
                  sample: ["a", "b", "c"].map((identity) => ({
                    identity,
                    label: identity,
                  })),
                },
              },
            },
          },
          body: {
            parts: {
              first: {
                component: { id: panel.id },
                visibleWhen: { prop: "current", equals: "a" },
              },
              second: {
                slot: { name: "secondContent" },
                visibleWhen: { prop: "current", equals: "b" },
              },
              third: {
                slot: { name: "thirdContent" },
                visibleWhen: { prop: "current", equals: "c" },
              },
            },
          },
        },
      },
    },
    bindings,
  });
}
const family = (c: Contract) =>
  new Map([
    [c.id, c],
    [child.id, child],
    [panel.id, panel],
  ]);
async function native(c = fixture()) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({
    figma,
    console: { log() {}, warn() {}, error() {} },
  });
  const run = (script: string) =>
    vm.runInContext(`(async()=>{${script}\n})()`, context, {
      timeout: 20000,
    }) as Promise<any>;
  for (const dep of [child, panel, c])
    await run(engine.buildComponentScript(dep, family(c)));
  const node = root.findOne(
    (n: any) =>
      n.type === "COMPONENT_SET" &&
      n.getSharedPluginData("ds_contracts", "contractId") === c.id,
  )!;
  const dump = async () => {
    const code = readFileSync(
      new URL("../extract/figma/dump.plugin.js", import.meta.url),
      "utf8",
    ).replace(
      /^const TARGET_SETS = \[[^\n]*\];$/m,
      `const TARGET_SETS = ${JSON.stringify([node.name])};`,
    );
    return (await run(code))[node.name] as DumpSet;
  };
  return { node, root, run, dump };
}
function proposal(
  set: DumpSet,
  c = fixture(),
  deps: Map<string, Contract> | undefined = family(c),
) {
  return proposeFromDump(set, {
    corpus: tokenCorpusFromJson({
      primitives: {},
      semantic: {},
      light: {},
      brandDefault: {},
    }),
    contractIdByName: new Map([
      [child.name, child.id],
      [panel.name, panel.id],
    ]),
    contractsById: deps,
    fileKey: null,
    projectionMode: "exact",
    mintUnbound: true,
  });
}
function back(set: DumpSet, c = fixture()) {
  return ContractSchema.parse(proposal(set, c).contract);
}
const list = (v: any): any => v.children[0];
const pane = (v: any): any => v.children[1].children[0];
const rows = (c: Contract) =>
  walkAnatomy(c).find((r) => r.name === "item")!.part.repeat!.sample;

test("a complete captured selection family preserves stamped item text names without source dependencies", async () => {
  const c = fixture(), live = await native(c);
  const source = readFileSync(new URL("../extract/figma/dump.plugin.js", import.meta.url), "utf8")
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m,
      `const TARGET_SETS = ${JSON.stringify([child.name, panel.name, c.name])};`);
  const dump = JSON.parse(JSON.stringify(await live.run(source)));
  const batch = proposeBatchFromDump(dump, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), contractsById: new Map(), mintUnbound: true,
    projectionMode: "exact",
  });
  assert.deepEqual(batch.skipped, []);
  assert.equal(batch.proposals.length, 3);
  const returned = batch.proposals.map(p => ContractSchema.parse(p.contract));
  const item = returned.find(p => p.id === child.id)!;
  assert.equal(item.props.find(p => p.bindings.figma.property === "Label")?.name, "label");
  assert.equal(item.anatomy.root.parts?.label.content?.prop, "label");
  const parent = returned.find(p => p.id === c.id)!;
  assert.deepEqual(rows(parent), rows(c));
  assert.deepEqual(parent.selection, c.selection);
});

test("writer and production Plugin capture on a native mock retain finite identities and aliases without a source anatomy snapshot", async () => {
  const c = fixture(),
    live = await native(c),
    set = await live.dump(),
    returned = back(set);
  assert.deepEqual(returned.selection, c.selection);
  const withoutMainStamps = structuredClone(set),
    deps = family(c);
  const anchored = structuredClone(child);
  anchored.bindings.figma.anchors.componentSetKey = list(
    set.variants[0],
  ).children[0].instanceSetKey;
  deps.set(child.id, anchored);
  for (const v of withoutMainStamps.variants)
    for (const n of list(v).children) delete n.instanceContractId;
  assert.deepEqual(
    ContractSchema.parse(proposal(withoutMainStamps, c, deps).contract)
      .selection,
    c.selection,
  );
  assert.deepEqual(returned.props, c.props);
  assert.deepEqual(rows(returned), rows(c));
  assert.equal(
    walkAnatomy(returned).find((r) => r.name === "second")?.part.slot?.name,
    "secondContent",
  );
  assert.equal((set.selectionApi as any).anatomy, undefined);
  await live.run(engine.buildComponentScript(c, family(c)));
  assert.deepEqual(await live.dump(), set);
  // A label edit on every occurrence comes from the new capture, not the source.
  for (const v of set.variants) {
    const node = list(v).children![0];
    const key = Object.keys(node.componentProperties!).find((k) =>
      k.startsWith("Label#"),
    )!;
    node.componentProperties![key] = "Renamed on canvas";
    list(v).name = "Designer renamed list";
    list(v).children!.reverse();
  }
  const originalDump = structuredClone(set);
  const edited = back(set);
  assert.deepEqual(structuredClone(set), originalDump);
  assert.deepEqual(
    engine.compileComponentData(edited, family(edited)).selectionApi,
    engine.compileComponentData(c, family(c)).selectionApi,
  );
  assert.deepEqual(
    rows(edited).map((r) => r.identity),
    ["c", "b", "a"],
  );
  assert.equal(rows(edited)[2].label, "Renamed on canvas");
  assert.deepEqual(
    rows(c).map((r) => r.label),
    ["a", "b", "c"],
  );
  const identity = live.node.id;
  await live.run(engine.buildComponentScript(edited, family(edited)));
  assert.equal(live.node.id, identity);
  assert.deepEqual(rows(back(await live.dump())), rows(edited));
});

test("hostile or incomplete relationships refuse instead of silently flattening behavior", async () => {
  const base = await (await native()).dump();
  const mutations: Array<[string, (s: any) => void]> = [
    [
      "different native main",
      (s) => (list(s.variants[0]).children[1].instanceSetKey = "other"),
    ],
    [
      "wrong actual main stamp",
      (s) => (list(s.variants[0]).children[0].instanceContractId = "other"),
    ],
    [
      "unanchored unstamped dependency",
      (s) => {
        for (const v of s.variants)
          for (const n of list(v).children) delete n.instanceContractId;
      },
    ],
    ["malformed envelope", (s) => (s.selectionApi = "{")],
    ["unknown version", (s) => (s.selectionApi.version = 2)],
    ["extra metadata", (s) => (s.selectionApi.anatomy = {})],
    ["missing envelope", (s) => delete s.selectionApi],
    [
      "bad initializer",
      (s) => (s.selectionApi.value.bindings.code.initial.prop = "value"),
    ],
    ["wrong domain", (s) => s.propertyDefinitions.Current.variantOptions.pop()],
    ["missing variant", (s) => s.variants.pop()],
    [
      "duplicate variant",
      (s) => (s.variants[1] = structuredClone(s.variants[0])),
    ],
    [
      "wrong default",
      (s) => (s.propertyDefinitions.Current.defaultValue = "B"),
    ],
    ["wrong role", (s) => (s.semantics.element = "button")],
    [
      "missing identity",
      (s) => delete list(s.variants[0]).children![0].selectionIdentity,
    ],
    [
      "duplicate identity",
      (s) =>
        (list(s.variants[0]).children![1].selectionIdentity = structuredClone(
          list(s.variants[0]).children![0].selectionIdentity,
        )),
    ],
    [
      "malformed identity",
      (s) => (list(s.variants[0]).selectionIdentity = "oops"),
    ],
    ["hidden list", (s) => (list(s.variants[0]).hidden = true)],
    ["hidden ancestor", (s) => (s.variants[0].hidden = true)],
    [
      "extra list content",
      (s) =>
        list(s.variants[0]).children.push(
          structuredClone(list(s.variants[0]).children[0]),
        ),
    ],
    ["state-dependent order", (s) => list(s.variants[0]).children.reverse()],
    ["missing panel", (s) => (s.variants[0].children[1].children = [])],
    [
      "wrong panel relationship",
      (s) => (pane(s.variants[0]).selectionIdentity.value = "b"),
    ],
    ["wrong slot", (s) => (pane(s.variants[1]).slotKey = "Different#0")],
    [
      "slot renamed independently",
      (s) => (pane(s.variants[1]).name = "Different"),
    ],
    [
      "active appearance changed",
      (s) =>
        (list(s.variants[0]).children[0].componentProperties.Active = "Off"),
    ],
    [
      "record varies by state",
      (s) => {
        const n = list(s.variants[0]).children[0];
        n.componentProperties[
          Object.keys(n.componentProperties).find((k) =>
            k.startsWith("Label#"),
          )!
        ] = "Only one state";
      },
    ],
    [
      "new child input",
      (s) => (s.selectionApi.items.type.arrayOf.unknown = "text"),
    ],
    [
      "callback collision",
      (s) => (s.selectionApi.selection.bindings.code.prop = "items"),
    ],
    [
      "duplicate panels",
      (s) => (s.selectionApi.selection.panels[1].part = "first"),
    ],
  ];
  for (const [label, mutate] of mutations) {
    const set = structuredClone(base);
    mutate(set);
    assert.throws(() => back(set), /FIGMA_SELECTION_/, label);
  }
  assert.throws(
    () => proposal(base, fixture(), new Map()),
    /FIGMA_SELECTION_PROJECTION_UNSUPPORTED:full item dependency required/,
  );
});

test("retirement refuses before writes and malformed plugin metadata remains visible", async () => {
  const c = fixture(),
    live = await native(c),
    before = await live.dump(),
    replacement = structuredClone(c);
  replacement.selection!.bindings.code.prop = "onAnotherChange";
  await assert.rejects(
    live.run(engine.buildComponentScript(replacement, family(replacement))),
    /FIGMA_SELECTION_RETIREMENT_REFUSED/,
  );
  assert.deepEqual(await live.dump(), before);
  const plain = structuredClone(c);
  delete plain.selection;
  delete plain.props[1].bindings.code.initial;
  await assert.rejects(
    live.run(engine.buildComponentScript(plain, family(plain))),
    /FIGMA_SELECTION_RETIREMENT_REFUSED/,
  );
  assert.deepEqual(await live.dump(), before);
  live.node.setSharedPluginData("ds_contracts", "selectionApi", "{");
  const damaged = await live.dump();
  assert.equal(damaged.selectionApi, "{");
  assert.throws(() => back(damaged), /FIGMA_SELECTION_METADATA_INVALID/);
});

test("REST capture preserves both valid and malformed relationship data", () => {
  for (const raw of ["{", JSON.stringify({ version: 1, role: "list" })]) {
    const result = mapRestToDump({
      nodes: {
        "1:1": {
          document: {
            id: "1:1",
            name: "Native",
            type: "COMPONENT",
            sharedPluginData: { ds_contracts: { selectionApi: raw } },
            children: [
              {
                id: "1:2",
                name: "List",
                type: "FRAME",
                sharedPluginData: { ds_contracts: { selectionIdentity: raw } },
                children: [],
              },
            ],
          },
        },
      },
    } as any);
    const set = result.dump.Native as DumpSet;
    assert.deepEqual(set.selectionApi, raw === "{" ? raw : JSON.parse(raw));
    assert.deepEqual(
      set.variants[0].children![0].selectionIdentity,
      raw === "{" ? raw : JSON.parse(raw),
    );
  }
});

test("returned React keeps keyboard callbacks and stable keys after native renaming and reorder", async (t) => {
  const c = fixture(),
    set = await (await native(c)).dump();
  for (const v of set.variants) list(v).children!.reverse();
  const returned = back(set),
    browser = await chromium.launch();
  t.after(() => browser.close());
  for (const inline of [false, true]) {
    const ctx = {
      contracts: family(returned),
      icons: new Map<string, string>(),
      tokens: new Set<string>(),
    };
    const emit = (c: Contract) =>
      inline
        ? { ...emitReactInline(c, { ...ctx, tokens }), css: "" }
        : emitReact(c, ctx);
    const output = emit(returned),
      entry = emit(child),
      body = emit(panel);
    assert.deepEqual(
      generatedTypeErrors(returned.name, output.tsx, {
        Choice: entry.tsx,
        Pane: body.tsx,
      }),
      [],
    );
    // Supply the records on the first mount. An empty initial collection followed
    // by insertion deliberately recovers to its first enabled item instead.
    const source =
      output.tsx
        .replace("export function Views(", "function GeneratedViews(")
        .replace("export const Views =", "const GeneratedViews =") +
      `
    export function Views(props:ViewsProps){return <GeneratedViews {...props} items={props.items ?? ${JSON.stringify(rows(returned))}}/>;}`;
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    await mountGenerated(page, returned.name, source, output.css, {
      Choice: entry,
      Pane: body,
    });
    await page.evaluate(
      `window.calls=[];window.renderSubject({onChange:value=>window.calls.push(value)});`,
    );
    assert.deepEqual(await page.getByRole("tab").allTextContents(), [
      "c",
      "b",
      "a",
    ]);
    assert.equal(
      await page
        .getByRole("tab", { name: "a", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page.getByRole("tab", { name: "a", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.deepEqual(await page.evaluate("window.calls"), ["c"]);
    assert.equal(
      await page
        .getByRole("tab", { name: "c", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    const id = await page
      .getByRole("tab", { name: "c", exact: true })
      .getAttribute("id");
    await page.evaluate(
      `window.renderSubject({items:${JSON.stringify([...rows(returned)].reverse())},value:'c'});`,
    );
    assert.equal(
      await page
        .getByRole("tab", { name: "c", exact: true })
        .getAttribute("id"),
      id,
    );
    await page.close();
  }
});
