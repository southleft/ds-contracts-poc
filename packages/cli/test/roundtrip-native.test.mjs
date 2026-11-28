import test from "node:test";
import assert from "node:assert/strict";
import { tokenValue } from "../src/roundtrip/token-value.mjs";
import { runtime } from "../src/roundtrip/figma.mjs";

function fixture() {
  const metadata = { "contract-id": "root", "contract-revision": "r1" };
  const set = {
    id: "set",
    type: "COMPONENT_SET",
    children: [],
    getSharedPluginData: (_, key) => metadata[key] ?? "",
    setSharedPluginData: (_, key, value) => {
      metadata[key] = value;
    },
  };
  const board = { id: "board", name: "Projection", findAll: (predicate) => [set].filter(predicate) };
  const page = { name: "Page", children: [board], loadAsync: async () => {} };
  const collection = { id: "c", name: "Projection / primitive", variableIds: ["v1", "v2"], defaultModeId: "m" };
  const variables = ["first", "second"].map((name, i) => ({
    id: "v" + (i + 1),
    name,
    resolvedType: "COLOR",
    valuesByMode: { m: { r: 0, g: 0, b: 0 } },
    scopes: [],
    codeSyntax: {},
    setValueForMode(mode, value) {
      this.valuesByMode[mode] = value;
    },
  }));
  const figma = {
    fileKey: "f",
    root: { children: [page] },
    variables: {
      getLocalVariableCollectionsAsync: async () => [collection],
      getVariableByIdAsync: async (id) => variables.find((v) => v.id === id),
    },
  };
  const request = {
    fileKey: "f",
    page: "Page",
    prefix: "Projection",
    bundle: {
      root: "root",
      components: { root: { revision: "r2", instances: {} } },
      system: {
        tokens: { first: { type: "color", tier: "primitive", value: "#ff0000" }, second: { type: "color", tier: "primitive", value: "#00ff00" } },
      },
    },
    plan: { status: "ready", tokenOrder: ["first", "second"] },
  };
  const run = (options) => runtime({ ...request, ...options }, figma);
  return { figma, request, variables, set, page, run };
}

test("a failed native patch rolls back and the same request can resume", async () => {
  const f = fixture(),
    expected = await f.run({ action: "read" });
  const setter = f.variables[1].setValueForMode;
  let fail = true;
  f.variables[1].setValueForMode = function (...args) {
    setter.apply(this, args);
    if (fail) {
      fail = false;
      throw Error("setter failed");
    }
  };
  await assert.rejects(f.run({ action: "patch", expected }), /setter failed/);
  assert.deepEqual(await f.run({ action: "read" }), expected);
  assert.equal((await f.run({ action: "patch", expected })).status, "patched");
});
test("a completed native patch replays exactly and refuses subsequent designer drift", async () => {
  const f = fixture(),
    expected = await f.run({ action: "read" });
  const result = await f.run({ action: "patch", expected });
  assert.deepEqual((await f.run({ action: "patch", expected })).snapshot, result.after);
  f.variables[0].setValueForMode("m", { r: 1, g: 1, b: 1 });
  await assert.rejects(f.run({ action: "patch", expected }), /native revision conflict/);
});
test("failed collection initialization is cleaned up before a retry", async () => {
  const f = fixture(),
    collections = [];
  f.page.children = [];
  f.figma.variables.getLocalVariableCollectionsAsync = async () => collections;
  f.figma.variables.createVariableCollection = (name) => {
    const c = {
      name,
      id: "new",
      renameMode() {
        throw Error("rename failed");
      },
      remove() {
        collections.splice(collections.indexOf(this), 1);
      },
    };
    collections.push(c);
    return c;
  };
  f.figma.listAvailableFontsAsync = async () => [];
  f.figma.setCurrentPageAsync = async () => {};
  f.request.appearance = { variants: [] };
  for (let i = 0; i < 2; i++) {
    await assert.rejects(f.run({ action: "create" }), /rename failed/);
    assert.equal(collections.length, 0);
  }
});
test("native variant renames are refused even when shared metadata is unchanged", async () => {
  const f = fixture();
  f.set.children = [
    {
      variantProperties: { State: "Disabled" },
      getSharedPluginData: (_, key) => (key === "axes" ? '{"State":"Checked"}' : ""),
    },
  ];
  await assert.rejects(f.run({ action: "read" }), /native variant properties changed/);
});
test("every dependency vector must keep its declared binding, even with equal colors", async () => {
  const f = fixture(),
    data = (part, key) => (key === "part" ? part : key === "axes" ? '{"State":"Checked"}' : "");
  const frame = (part) => ({
    id: part,
    type: "FRAME",
    fills: [],
    strokes: [],
    effects: [],
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    width: 20,
    height: 20,
    getSharedPluginData: (_, key) => data(part, key),
  });
  const root = frame("root"),
    slot = frame("glyph");
  root.variantProperties = { State: "Checked" };
  const main = { id: "main", getSharedPluginData: (_, key) => (key === "contract-id" ? "glyph" : "r1") };
  const instance = {
    id: "instance",
    type: "INSTANCE",
    parent: slot,
    getSharedPluginData: () => "",
    getMainComponentAsync: async () => main,
  };
  const vectors = [0, 1].map((i) => ({
    id: "vector" + i,
    type: "VECTOR",
    parent: instance,
    getSharedPluginData: () => "",
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, boundVariables: { color: { id: "v1" } } }],
  }));
  instance.findAll = (predicate) => vectors.filter(predicate);
  slot.children = [instance];
  slot.parent = root;
  root.findAll = (predicate) => [slot, instance, ...vectors].filter(predicate ?? (() => true));
  f.set.children = [root];
  f.request.bundle.components.root.instances.glyph = { component: "glyph", colorToken: "first" };
  assert.equal((await f.run({ action: "read" })).variants[0].instances.glyph.colorToken, "first");
  vectors[1].fills[0].boundVariables.color.id = "v2";
  await assert.rejects(f.run({ action: "read" }), /native dependency binding changed: glyph/);
  delete vectors[1].fills[0].boundVariables.color;
  await assert.rejects(f.run({ action: "read" }), /native dependency binding changed: glyph/);
});

for (const fault of ["setter", "readback"]) {
  test(`decimal native ${fault} failure restores values and revision`, async () => {
    const f = fixture(), v = f.variables[0], token = f.request.bundle.system.tokens.first;
    token.type = "dimension";
    token.value = "14.10px";
    v.resolvedType = "FLOAT";
    v.valuesByMode.m = Math.fround(14.1);
    const expected = await f.run({ action: "read" });
    assert.equal(expected.tokens.first.value, "14.10px");
    token.value = "40.1px";
    let fail = true;
    v.setValueForMode = function (mode, value) {
      this.valuesByMode[mode] = Math.fround(value);
      if (fail) {
        fail = false;
        if (fault === "setter") throw Error("setter failed after mutation");
        f.variables[1].codeSyntax = { WEB: "changed" };
      }
    };
    await assert.rejects(f.run({ action: "patch", expected }),
      fault === "setter" ? /setter failed/ : /native patch result differs/);
    assert.equal(v.valuesByMode.m, Math.fround(14.1));
    assert.equal(f.set.getSharedPluginData("", "contract-revision"), "r1");
  });
}
test("explicit px values must survive native FLOAT storage", () => {
  for (const value of ["14PX", "1rem", "calc(14px)", "0px", "-1px", "1e2px",
    "0." + "0".repeat(50) + "1px", "1" + "0".repeat(40) + "px"])
    assert.throws(() => tokenValue("dimension", value), /unsupported-token-value/);
  assert.equal(tokenValue("dimension", "14.10px"), 14.1);
  assert.equal(tokenValue("dimension", "14.10px", "native"), Math.fround(14.1));
});

test("decimal and spelling-only source patches replay and protect adjacent native edits", async () => {
  const f = fixture(), v = f.variables[0], token = f.request.bundle.system.tokens.first;
  token.type = "dimension";
  token.value = "14.10px";
  v.resolvedType = "FLOAT";
  v.valuesByMode.m = Math.fround(14.1);
  v.setValueForMode = function (mode, value) { this.valuesByMode[mode] = Math.fround(value); };
  for (const next of ["14.1px", "40.1px"]) {
    const expected = await f.run({ action: "read" });
    token.value = next;
    const result = await f.run({ action: "patch", expected });
    assert.equal(result.after.tokens.first.value, next);
    assert.equal((await f.run({ action: "patch", expected })).status, "unchanged");
  }
  const expected = await f.run({ action: "read" }), concurrent = Math.fround(14.0000105);
  token.value = "14.00001px";
  v.setValueForMode = function (mode) {
    this.valuesByMode[mode] = concurrent;
    throw Error("concurrent edit after setter");
  };
  await assert.rejects(f.run({ action: "patch", expected }), /concurrent edit/);
  assert.equal(v.valuesByMode.m, concurrent);
});
