import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { observe, randomScript } from "../src/roundtrip/capture.mjs";

test("the pinned seed gives repeated app executions identical random content", () => {
  const run = (seed) => runInNewContext(randomScript(seed) + "[Math.random(),Math.random()].join(',')");
  assert.equal(run(1), run(1));
  assert.notEqual(run(1), run(2));
});
test("unsupported computed colors are refused instead of becoming invented RGB values", (t) => {
  const styles = {
    display: "flex",
    transform: "none",
    filter: "none",
    backgroundImage: "none",
    textShadow: "none",
    flexDirection: "row",
    justifyContent: "start",
    alignItems: "start",
    flexWrap: "nowrap",
    position: "static",
    boxShadow: "none",
    backgroundColor: "oklch(0.5 0.2 180)",
  };
  const previous = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.document = { querySelectorAll: () => [{ getBoundingClientRect: () => ({ width: 10, height: 10 }) }] };
  globalThis.getComputedStyle = () => styles;
  const P = {
    appearance: { parts: { root: { kind: "frame", selector: "button", sizing: ["fixed", "fixed"] } } },
    dependencies: {},
    instances: {},
  };
  assert.throws(() => observe({ P, variant: { key: "default", axes: {} } }), /unsupported computed color: oklch/);
  styles.backgroundColor = "rgb(1, 2, 3)";
  assert.equal(observe({ P, variant: { key: "default", axes: {} } }).parts.root.styles.fill, "#010203");
});
