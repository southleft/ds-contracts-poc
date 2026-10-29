import assert from "node:assert/strict";
import test from "node:test";
import { FINGERPRINT_SRC, SNAPSHOT_STORE_SRC } from "./canvas-fingerprint.js";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import { fixture } from "./native-source-writer-test-fixture.js";

const store = new Function(
  `${SNAPSHOT_STORE_SRC}; return { write: dsWriteSnapshot, read: dsReadSnapshot, units: DS_SNAPSHOT_PIECE_UNITS };`,
)() as {
  write: (node: any, key: string, lines: string[]) => void;
  read: (node: any, key: string) => string[];
  units: number;
};
const LIMIT = "This pluginData entry exceeds 100 kB per entry limit.";
const node = () => {
  const { figma } = createFigmaMock() as any;
  return figma.createFrame();
};
const keys = (n: any) => [...n._shared.keys()].filter((k: string) => k.startsWith("ds_contracts/")).sort();
const composedLines = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    `/0/${i}:INSTANCE/尺寸=迷你, 颜色=极致蓝 ${i}|fill|[{"type":"SOLID","color":{"var":"color/替换图标/${i}"}}] 🧩`);

test("a snapshot that fits keeps the plain JSON array older readers parse", () => {
  const n = node();
  const lines = composedLines(20);
  store.write(n, "canvasSnapshot", lines);
  assert.equal(n.getSharedPluginData("ds_contracts", "canvasSnapshot"), JSON.stringify(lines));
  assert.deepEqual(keys(n), ["ds_contracts/canvasSnapshot"]);
  assert.deepEqual(store.read(n, "canvasSnapshot"), lines);
});

test("a composed snapshot over 100 kB is refused as one entry and round-trips in pieces", () => {
  const lines = composedLines(2500);
  const text = JSON.stringify(lines);
  assert(Buffer.byteLength(text) > 300000);
  const plain = node();
  assert.throws(() => plain.setSharedPluginData("ds_contracts", "canvasSnapshot", text), { message: `in setSharedPluginData: ${LIMIT}` });

  const n = node();
  store.write(n, "canvasSnapshot", lines);
  const header = JSON.parse(n.getSharedPluginData("ds_contracts", "canvasSnapshot"));
  assert.equal(header.length, text.length);
  assert.equal(header.dsSnapshotPieces, Math.ceil(text.length / store.units));
  for (let i = 0; i < header.dsSnapshotPieces; i++) {
    const piece = n.getSharedPluginData("ds_contracts", `canvasSnapshot/${i}`);
    assert(piece.length <= store.units && Buffer.byteLength(piece) <= 100000 && piece.length * 2 <= 100000);
  }
  assert.deepEqual(store.read(n, "canvasSnapshot"), lines);
});

test("a piece never ends between the two halves of a surrogate pair", () => {
  const n = node();
  const prefix = '["' + "a".repeat(store.units - 3);
  const lines = [prefix.slice(2) + "😀" + "b".repeat(store.units)];
  assert.equal(JSON.stringify(lines).charCodeAt(store.units - 1), 0xd83d);
  store.write(n, "canvasSnapshot", lines);
  const first = n.getSharedPluginData("ds_contracts", "canvasSnapshot/0");
  assert.equal(first.length, store.units - 1);
  assert.deepEqual(store.read(n, "canvasSnapshot"), lines);
});

test("re-stamping a smaller snapshot clears every stale piece", () => {
  const n = node();
  store.write(n, "canvasSnapshot", composedLines(2500));
  const before = JSON.parse(n.getSharedPluginData("ds_contracts", "canvasSnapshot")).dsSnapshotPieces;
  store.write(n, "canvasSnapshot", composedLines(1200));
  const after = JSON.parse(n.getSharedPluginData("ds_contracts", "canvasSnapshot")).dsSnapshotPieces;
  assert(after < before);
  for (let i = after; i < before; i++) assert.equal(n.getSharedPluginData("ds_contracts", `canvasSnapshot/${i}`), "");
  assert.deepEqual(store.read(n, "canvasSnapshot"), composedLines(1200));
  store.write(n, "canvasSnapshot", ["/:COMPONENT/a|hidden|true"]);
  assert.deepEqual(keys(n).filter((k) => n._shared.get(k) !== ""), ["ds_contracts/canvasSnapshot"]);
});

test("a missing, truncated or malformed piece is refused rather than read partially", () => {
  const corrupt = (edit: (n: any) => void) => {
    const n = node();
    store.write(n, "canvasSnapshot", composedLines(2500));
    edit(n);
    assert.throws(() => store.read(n, "canvasSnapshot"), /DS_SNAPSHOT_PIECES_INVALID/);
  };
  corrupt((n) => n.setSharedPluginData("ds_contracts", "canvasSnapshot/1", ""));
  corrupt((n) => n.setSharedPluginData("ds_contracts", "canvasSnapshot/1", "x"));
  corrupt((n) => n.setSharedPluginData("ds_contracts", "canvasSnapshot", '{"dsSnapshotPieces":1,"length":5}'));
  const n = node();
  n.setSharedPluginData("ds_contracts", "canvasSnapshot", '{"x":1}');
  assert.throws(() => store.read(n, "canvasSnapshot"), /DS_SNAPSHOT_PIECES_INVALID/);
  assert.deepEqual(store.read(node(), "canvasSnapshot"), []);
});

test("native creation stamps an over-limit variant snapshot instead of failing the operation", async () => {
  const f = await fixture();
  const createComponent = f.figma.createComponent.bind(f.figma);
  // One very long variant description stands in for a composed variant's
  // thousands of snapshot lines; the snapshot is the only reader of it.
  f.figma.createComponent = () => {
    const component = createComponent();
    Object.defineProperty(component, "description", { configurable: true, get: () => "长".repeat(40000), set: () => {} });
    return component;
  };
  const script = f.emit();
  assert(script.includes("dsWriteSnapshot(child, 'canvasSnapshot', dsCanvasSnapshot(child));"));
  const result = await f.run(script);
  assert.equal(result.status, "created-candidate", JSON.stringify(result.problems));
  const set = f.figma.root.children.find((p: any) => p.id === result.pageId).children[0];
  const fp = new Function(`${FINGERPRINT_SRC}; return { names: dsSetVarNames, snapshot: dsCanvasSnapshot };`)();
  const names: Record<string, string> = {};
  for (const v of await f.figma.variables.getLocalVariablesAsync()) names[v.id] = v.name;
  fp.names(names);
  let pieced = 0;
  for (const variant of set.children) {
    const raw = variant.getSharedPluginData("ds_contracts", "canvasSnapshot");
    if (raw.startsWith("{")) pieced++;
    assert.deepEqual(store.read(variant, "canvasSnapshot"), fp.snapshot(variant));
  }
  assert(pieced > 0, "at least one variant needed the pieced form");
});
