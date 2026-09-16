import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import {
  ContractSchema,
  PropSchema,
  type Contract,
} from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { generatedTypeErrors, mountGenerated } from "./react-test-runtime.js";
import { tokenInventoryFromJson } from "./tokens.js";

const values = {
  off: false,
  on: true,
  mixed: "indeterminate",
  none: null,
  stringFalse: "false",
  zero: 0,
};
const paints = {
  off: "#889999",
  on: "#0055ff",
  mixed: "#ee0011",
  none: "#000000",
  stringFalse: "#ffff00",
  zero: "#00aa00",
};
export function typedSeed(): Contract {
  return ContractSchema.parse({
    id: "check.typed",
    name: "TypedInput",
    version: "0.1.0",
    status: "draft",
    description: "Typed values",
    semantics: { element: "button" },
    props: [
      {
        name: "state",
        type: { enum: Object.keys(values) },
        bindings: {
          code: { prop: "checked", values },
          figma: {
            kind: "VARIANT",
            property: "State",
            unsetValue: "(unset)",
            values: Object.fromEntries(Object.keys(values).map((v) => [v, v])),
          },
        },
      },
    ],
    states: [],
    anatomy: {
      root: {
        layout: { display: "flex" },
        text: "Typed",
        literals: { "background-color": "#ffffff" },
        literalsByProp: [
          {
            prop: "state",
            map: Object.fromEntries(
              Object.entries(paints).map(([k, v]) => [
                k,
                { "background-color": v },
              ]),
            ),
          },
        ],
      },
    },
    bindings: {
      code: { anchors: { importPath: "check/typed", export: "TypedInput" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
}
const tokens = {
  primitives: {},
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};
function output(c: Contract, inline: boolean, all = new Map([[c.id, c]])) {
  return inline
    ? {
        ...emitReactInline(c, { tokens, contracts: all, icons: new Map() }),
        css: "",
      }
    : emitReact(c, {
        tokens: tokenInventoryFromJson([]),
        contracts: all,
        icons: new Map(),
      });
}
test("typed finite API distinguishes false, string false, null, zero and omission through both React emitters and live updates", async () => {
  const c = typedSeed(),
    browser = await chromium.launch();
  try {
    for (const inline of [false, true]) {
      const o = output(c, inline);
      assert.deepEqual(generatedTypeErrors(c.name, o.tsx), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, o.tsx, o.css);
        for (const [props, color] of [
          [{}, "rgb(255, 255, 255)"],
          [{ checked: false }, "rgb(136, 153, 153)"],
          [{ checked: true }, "rgb(0, 85, 255)"],
          [{ checked: "indeterminate" }, "rgb(238, 0, 17)"],
          [{ checked: null }, "rgb(0, 0, 0)"],
          [{ checked: "false" }, "rgb(255, 255, 0)"],
          [{ checked: 0 }, "rgb(0, 170, 0)"],
          [{}, "rgb(255, 255, 255)"],
        ] as const) {
          await render(props);
          assert.equal(
            await page
              .locator("button")
              .evaluate((e) => getComputedStyle(e).backgroundColor),
            color,
          );
        }
        const error = page.waitForEvent("pageerror");
        await render({ checked: "off" });
        assert.match((await error).message, /CODE_VALUE_UNSUPPORTED/);
        assert.equal(await page.locator("button").count(), 0);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const stories = emitReact(c, {
    tokens: tokenInventoryFromJson([]),
    contracts: new Map([[c.id, c]]),
    icons: new Map(),
  }).stories;
  assert.match(stories, /checked: false/);
  assert.match(stories, /checked: null/);
  assert.match(stories, /checked=\{false\}/);
});
test("typed defaults and composition translate canonical values at the child API", async () => {
  const child = typedSeed();
  delete child.props[0].bindings.figma.unsetValue;
  child.props[0].default = "on";
  const parent = typedSeed();
  parent.id = "check.parent";
  parent.name = "TypedParent";
  parent.semantics.element = "div";
  parent.anatomy.root = {
    layout: { display: "flex" },
    parts: {
      control: { component: { id: child.id, props: { state: "{state}" } } },
    },
  };
  const all = new Map([
      [parent.id, parent],
      [child.id, child],
    ]),
    browser = await chromium.launch();
  try {
    for (const inline of [false, true]) {
      const p = output(parent, inline, all),
        c = output(child, inline, all),
        page = await browser.newPage();
      try {
        const render = await mountGenerated(page, parent.name, p.tsx, p.css, {
          [child.name]: c,
        });
        for (const [props, color] of [
          [{}, "rgb(0, 85, 255)"],
          [{ checked: false }, "rgb(136, 153, 153)"],
          [{ checked: null }, "rgb(0, 0, 0)"],
          [{}, "rgb(0, 85, 255)"],
        ] as const) {
          await render(props);
          assert.equal(
            await page
              .locator("button")
              .evaluate((e) => getComputedStyle(e).backgroundColor),
            color,
          );
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
test("invalid mapped APIs are refused rather than coerced or completed", () => {
  for (const mutate of [
    (p: any) => {
      delete p.bindings.figma.unsetValue;
    },
    (p: any) => {
      p.bindings.code.values.off = "indeterminate";
    },
    (p: any) => {
      delete p.bindings.code.values.none;
    },
    (p: any) => {
      p.bindings.code.values.extra = "extra";
    },
    (p: any) => {
      p.bindings.code.values.none = {};
    },
    (p: any) => {
      p.bindings.code.values.none = NaN;
    },
    (p: any) => {
      p.type = "boolean";
    },
    (p: any) => {
      p.bindings.code.prop = "bad-prop";
    },
  ]) {
    const p = structuredClone(typedSeed().props[0]);
    mutate(p);
    assert.equal(PropSchema.safeParse(p).success, false);
  }
});

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import { createFigmaEngine } from "./emit-figma-script.js";
import { proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import { readCodeValueAxes } from "./figma-code-values.js";
import type { DumpSet } from "../extract/figma/types.js";
const engine = createFigmaEngine({ tokens, icons: new Map() });
async function native(c: Contract) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({
    figma,
    console: { log() {}, warn() {}, error() {} },
  });
  const run = (code: string) =>
    vm.runInContext(`(async()=>{${code}\n})()`, context, {
      timeout: 20000,
    }) as Promise<any>;
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script);
  const node = root.findOne(
    (n: any) =>
      n.type === "COMPONENT_SET" &&
      n.getSharedPluginData("ds_contracts", "contractId") === c.id,
  );
  assert.ok(node);
  const dump = async () => {
    const source = readFileSync(
      new URL("../extract/figma/dump.plugin.js", import.meta.url),
      "utf8",
    ).replace(
      /^const TARGET_SETS = \[[^\n]*\];$/m,
      `const TARGET_SETS = ${JSON.stringify([node.name])};`,
    );
    return (await run(source))[node.name] as DumpSet;
  };
  return { node, run, script, dump };
}
const propose = (set: DumpSet) =>
  ContractSchema.parse(
    proposeFromDump(set, {
      corpus: tokenCorpusFromJson({
        primitives: {},
        semantic: {},
        light: {},
        brandDefault: {},
      }),
      contractIdByName: new Map(),
      fileKey: null,
      projectionMode: "exact",
      mintUnbound: true,
    }).contract,
  );
test("native metadata preserves exact typed API and omission, repeat identity and refuses mapping retirement before mutation", async () => {
  const c = typedSeed(),
    live = await native(c),
    set = await live.dump();
  const back = propose(set);
  assert.deepEqual(back.props[0].bindings.code, c.props[0].bindings.code);
  assert.deepEqual(back.props[0].type, c.props[0].type);
  assert.equal(Object.hasOwn(back.props[0], "default"), false);
  assert.equal(back.props[0].bindings.figma.unsetValue, "(unset)");
  await live.run(live.script);
  assert.equal(JSON.stringify(await live.dump()), JSON.stringify(set));
  for (const change of [
    (p: any) => {
      delete p.bindings.code.values;
    },
    (p: any) => {
      p.bindings.code.values.off = "changed";
    },
  ]) {
    const bad = structuredClone(c);
    change(bad.props[0]);
    await assert.rejects(
      live.run(engine.buildComponentScript(bad, new Map([[bad.id, bad]]))),
      /FIGMA_CODE_VALUES_RETIREMENT_REFUSED/,
    );
    assert.equal(JSON.stringify(await live.dump()), JSON.stringify(set));
  }
  for (const change of [
    (s: any) => {
      s.codeValueAxes.axes[0].values.pop();
    },
    (s: any) => {
      s.codeValueAxes.axes[0].values[0].code = true;
    },
    (s: any) => {
      s.codeValueAxes = "{";
    },
    (s: any) => {
      s.variants.pop();
    },
    (s: any) => {
      s.codeValueAxes.axes[0].codeProp = "class";
    },
  ]) {
    const bad = structuredClone(set);
    change(bad);
    assert.throws(
      () => readCodeValueAxes(bad),
      /FIGMA_CODE_VALUES_METADATA_INVALID/,
    );
  }
});

test("null defaults and controlled toggles retain public types without coercing omission", async () => {
  const nullable = typedSeed();
  delete nullable.props[0].bindings.figma.unsetValue;
  nullable.props[0].default = "none";
  const back = propose(await (await native(nullable)).dump());
  assert.equal(back.props[0].default, "none");
  assert.equal(back.props[0].bindings.code.values!.none, null);
  const required = structuredClone(nullable);
  required.props[0].required = true;
  const toggled = typedSeed();
  toggled.events = [
    {
      name: "activate",
      trigger: "root",
      toggles: { prop: "state", between: ["off", "on"] },
      bindings: { code: { prop: "onActivate" } },
    },
  ];
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true]) {
      const requiredCode = output(required, inline).tsx;
      assert.deepEqual(
        generatedTypeErrors(
          required.name,
          requiredCode +
            `\nconst accepted = <TypedInput checked={null}/>;\n// @ts-expect-error required API\nconst missing = <TypedInput/>;\n// @ts-expect-error canonical keys are not public values\nconst wrong = <TypedInput checked="off"/>;`,
        ),
        [],
      );
      const page = await browser.newPage();
      try {
        const o = output(nullable, inline),
          render = await mountGenerated(page, nullable.name, o.tsx, o.css);
        for (const props of [{}, { checked: null }]) {
          await render(props);
          assert.equal(
            await page
              .locator("button")
              .evaluate((e) => getComputedStyle(e).backgroundColor),
            "rgb(0, 0, 0)",
          );
        }
        const t = output(toggled, inline);
        assert.deepEqual(generatedTypeErrors(toggled.name, t.tsx), []);
        const toggle = await mountGenerated(page, toggled.name, t.tsx, t.css);
        await toggle({});
        await page.locator("button").click();
        assert.equal(
          await page
            .locator("button")
            .evaluate((e) => getComputedStyle(e).backgroundColor),
          "rgb(0, 85, 255)",
        );
        await toggle({ checked: false });
        await page.locator("button").click();
        assert.equal(
          await page
            .locator("button")
            .evaluate((e) => getComputedStyle(e).backgroundColor),
          "rgb(136, 153, 153)",
        );
        await toggle({ checked: null });
        await page.locator("button").click();
        assert.equal(
          await page
            .locator("button")
            .evaluate((e) => getComputedStyle(e).backgroundColor),
          "rgb(0, 0, 0)",
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

import { mapRestToDump } from "../extract/figma/rest/map.js";
test("REST retains malformed typed metadata for explicit refusal; unstamped native axes stay untyped", () => {
  const response = {
    nodes: {
      "1:1": {
        document: {
          id: "1:1",
          name: "Broken",
          type: "COMPONENT_SET",
          sharedPluginData: { ds_contracts: { codeValueAxes: "{broken" } },
          children: [],
        },
      },
    },
  };
  const set = mapRestToDump(response as Parameters<typeof mapRestToDump>[0])
    .dump.Broken as DumpSet;
  assert.equal(set.codeValueAxes, "{broken");
  assert.throws(
    () => readCodeValueAxes(set),
    /FIGMA_CODE_VALUES_METADATA_INVALID/,
  );
  delete set.codeValueAxes;
  assert.deepEqual(readCodeValueAxes(set), []);
});

test("one-value required API stays a native variant axis", async () => {
  const c = typedSeed();
  c.props[0].type = { enum: ["on"] };
  c.props[0].bindings.code.values = { on: true };
  c.props[0].bindings.figma.values = { on: "On" };
  delete c.props[0].bindings.figma.unsetValue;
  c.props[0].required = true;
  c.anatomy.root.literalsByProp = [
    { prop: "state", map: { on: { "background-color": "#0055ff" } } },
  ];
  const back = propose(await (await native(c)).dump());
  assert.deepEqual(back.props[0].bindings.code, c.props[0].bindings.code);
  assert.equal(back.props[0].required, true);
  assert.equal(Object.hasOwn(back.props[0], "default"), false);
});

import { emitWebComponent } from "../packages/emitter-web-components/src/emit-wc.js";
test("unsupported targets and generated local collisions refuse explicitly", () => {
  const c = typedSeed();
  assert.throws(
    () =>
      emitWebComponent(c, {
        contracts: new Map([[c.id, c]]),
        icons: new Map(),
        tokens: new Set(),
      }),
    /CODE_VALUES_WEB_COMPONENTS_UNSUPPORTED/,
  );
  delete c.props[0].bindings.figma.unsetValue;
  c.props[0].default = "on";
  c.events = [
    {
      name: "activate",
      trigger: "root",
      toggles: { prop: "state", between: ["off", "on"] },
      bindings: { code: { prop: "onActivate" } },
    },
  ];
  c.props.push({
    name: "collision",
    type: "text",
    default: "",
    bindings: {
      code: { prop: "checkedUncontrolled" },
      figma: { kind: "NONE" },
    },
  });
  for (const inline of [false, true])
    assert.throws(() => output(c, inline), /CODE_VALUE_BINDING_COLLISION/);
});
