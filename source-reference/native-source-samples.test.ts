import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import vm from "node:vm";
import { revisionOf } from "../core/contract-provenance.js";
import { createFigmaEngine, type NodeSpec } from "../core/emit-figma-script.js";
import { ContractSchema } from "../scripts/contract-schema.js";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import {
  buildSourceVisualContractCandidate,
  type SourceVisualContractInput,
} from "./source-visual-contract.js";
import { buildNativeSourceSamples } from "./native-source-samples.js";
import { matchLitRender } from "./lit-render-match.js";

const sha = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
function fixture() {
  const pack = JSON.parse(
    readFileSync(
      new URL("./fixtures/source-visual-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const bytes = gunzipSync(Buffer.from(pack.payload, "base64"));
  assert.equal(sha(bytes), pack.payloadSha256);
  const source = JSON.parse(bytes.toString()) as SourceVisualContractInput;
  return {
    source,
    expectedVisualRevision: revisionOf(
      buildSourceVisualContractCandidate(source),
    ),
  };
}
const allSpecs = (specs: NodeSpec[]): NodeSpec[] =>
  specs.flatMap((s) => [s, ...allSpecs(s.children ?? [])]);
function repin(f: ReturnType<typeof fixture>) {
  for (const raw of f.source.cases) {
    const row = f.source.semantics.cases.find(
      (c) => c.id === raw.expectedCaseId,
    )!;
    raw.tree.sha256 = sha(JSON.stringify(raw.tree.root));
    raw.semantics.sourceTreeSha256 = raw.tree.sha256;
    raw.boundTopology.sourceTreeSha256 = raw.tree.sha256;
    raw.boundTopology.topology!.sourceTreeSha256 = raw.tree.sha256;
    raw.semantics.observationSha256 = sha(
      JSON.stringify(raw.semantics.observation),
    );
    raw.boundTopology.semanticObservationSha256 =
      raw.semantics.observationSha256;
    raw.boundTopology.topology!.observationSha256 = sha(
      JSON.stringify(raw.boundTopology.topology!.observation),
    );
    row.sourceTreeSha256 = raw.tree.sha256;
    row.semanticObservationSha256 = raw.semantics.observationSha256;
    row.topologyObservationSha256 =
      raw.boundTopology.topology!.observationSha256;
  }
  f.expectedVisualRevision = revisionOf(
    buildSourceVisualContractCandidate(f.source),
  );
}
function iconNodes(f: ReturnType<typeof fixture>) {
  const raw = f.source.cases.find((c) =>
    c.expectedCaseId.endsWith("--default-icon-before"),
  )!;
  const hostFact = raw.boundTopology.topology!.observation!.nodes.find(
    (n) => n.domPath === "host/1",
  )!;
  let host: unknown = raw.tree.root;
  for (const segment of hostFact.visualPath!.split("/").slice(1))
    host = (host as Record<string, unknown>)[segment];
  const hostElement =
    host as SourceVisualContractInput["cases"][number]["tree"]["root"];
  const wrapper = hostElement.nodes.find((c) => c.t === "el")!;
  assert.equal(wrapper.t, "el");
  const svg = wrapper.el.nodes.find((c) => c.t === "el")!;
  assert.equal(svg.t, "el");
  const path = svg.el.nodes.find((c) => c.t === "el")!;
  assert.equal(path.t, "el");
  return {
    raw,
    host: hostElement,
    wrapper: wrapper.el,
    svg: svg.el,
    path: path.el,
    svgTopology: raw.boundTopology.topology!.observation!.nodes.find(
      (n) => n.tag === "svg" && n.domPath.startsWith("host/1/"),
    )!,
    pathTopology: raw.boundTopology.topology!.observation!.nodes.find(
      (n) => n.tag === "path" && n.domPath.startsWith("host/1/"),
    )!,
  };
}

test("recorded samples use shared text and SVG specs, preserving topology and source identities", () => {
  const f = fixture(),
    before = JSON.stringify(f);
  const out = buildNativeSourceSamples(f);
  assert.equal(
    out.status,
    "comparison-samples-lowered",
    JSON.stringify({
      p: out.problems,
      c: out.cases.map((c) => ({
        id: c.id,
        p: c.problems,
        s: c.slots.map((s) => s.problems),
      })),
    }),
  );
  assert.equal(out.acceptedContract, null);
  assert.equal(out.qualification, "comparison-instance-samples-only");
  assert.equal(out.nativeQualification, "unqualified");
  assert.equal(out.cases.length, 7);
  assert.equal(out.cases.filter((c) => c.status === "lowered").length, 6);
  assert.equal(out.cases.filter((c) => c.status === "refused").length, 1);
  const slots = out.cases.flatMap((c) => c.slots);
  assert.equal(slots.length, 7);
  assert.equal(slots.flatMap((s) => s.sampleIds).length, 8);
  const text = slots.filter((s) => s.expectations?.characters !== undefined);
  assert.equal(text.length, 6);
  for (const slot of text) {
    assert.equal(slot.expectations!.characters, "Label");
    assert.deepEqual(slot.expectations!.geometry, {
      width: 40.5625,
      height: 24,
      source: "slot-owner-content-box",
    });
    const specs = allSpecs(slot.specs);
    assert.equal(specs.length, 2);
    assert.equal(specs[0].type, "frame");
    assert.equal(specs[0].lits?.width, 40.5625);
    assert.equal(specs[0].lits?.height, 24);
    assert.equal(specs[0].layout?.primary, "CENTER");
    assert.equal(specs[1].type, "text");
    assert.equal(specs[1].characters, "Label");
    assert.equal(specs[1].fontFamily, "IBM Plex Sans");
    assert.equal(specs[1].fontSize, 16);
    assert.equal(specs[1].fontStyle, "Semi Bold");
    assert.deepEqual(specs[1].lineHeight, { value: 24, unit: "PIXELS" });
    assert.equal(specs[1].fontWeightVar, undefined);
    assert.equal(specs[1].textAlignH, "CENTER");
    assert.equal(specs[1].lits?.width, undefined);
    assert.ok(specs[1].textFillLit);
    assert.equal(slot.specRevision, revisionOf(slot.specs));
    assert.equal(slot.styleRevision, revisionOf(slot.observedStyles));
  }
  const icon = slots.find((s) => s.sourceName === "before")!;
  const svg = allSpecs(icon.specs).find((s) => s.type === "svg")!;
  assert.equal(svg.iconSize, 24);
  assert.match(svg.svg!, /viewBox="0 0 20 20"/);
  assert.match(svg.svg!, /fill-rule="evenodd"/);
  assert.match(svg.svg!, /^<svg\b[^>]*\sfill="rgb\(0, 11, 41\)"(?:\s|>)/);
  assert.match(svg.svg!, /^<svg\b[^>]*\swidth="24"(?:\s|>)/);
  assert.match(svg.svg!, /^<svg\b[^>]*\sheight="24"(?:\s|>)/);
  assert.doesNotMatch(svg.svg!, /currentColor/);
  assert.equal(svg.svgPaintVar, undefined);
  assert.equal(icon.expectations!.svg[0].viewBox, "0 0 20 20");
  assert.equal(icon.expectations!.svg[0].width, 24);
  assert.equal(icon.expectations!.svg[0].fill, "rgb(0, 11, 41)");
  assert.ok(icon.observedStyles!.some((s) => s.vrefs));
  const iconText = out.cases
    .find((c) => c.id.endsWith("--default-icon-before"))!
    .slots.find((s) => s.sourceName === "")!;
  assert.deepEqual(iconText.expectations!.rawTextRuns, [
    "\n    ",
    "\n    Label\n  ",
  ]);
  assert.equal(JSON.stringify(f), before);
  assert.ok(
    allSpecs(slots.flatMap((s) => s.specs)).every(
      (s) => s.type !== "slot" && !s.slotDefault && !s.contentProp,
    ),
  );
});

test("expected visual revision rejects substituted source, token style, tree, topology and cases", async (t) => {
  for (const mutation of [
    "revision",
    "source",
    "source-program",
    "tree-style",
    "topology",
    "case-identity",
    "dropped-case",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      if (mutation === "revision")
        f.expectedVisualRevision = `sha256:${"f".repeat(64)}`;
      if (mutation === "source") f.source.source.source += "\n// changed";
      if (mutation === "source-program")
        f.source.semantics.source.programSha256 = "f".repeat(64);
      if (mutation === "tree-style")
        f.source.cases[0].tree.root.style.color = "rgb(255, 0, 0)";
      if (mutation === "topology")
        f.source.cases[0].boundTopology.topology!.observation!.slots[0].name =
          "forged";
      if (mutation === "case-identity")
        f.source.cases[0].expectedCaseId = f.source.cases[1].expectedCaseId;
      if (mutation === "dropped-case") f.source.cases.pop();
      const out = buildNativeSourceSamples(f);
      assert.equal(out.status, "refused");
      assert.ok(
        out.problems.includes("native-source-samples-visual-revision-mismatch"),
      );
      assert.equal(out.cases.length, 7);
      assert.ok(
        out.cases.every((row) =>
          row.slots.every((slot) => slot.specs.length === 0),
        ),
      );
    });
});

test("authenticated unsupported icon grammar refuses the whole comparison case without partial content", async (t) => {
  for (const mutation of [
    "missing-viewbox",
    "nonsquare-viewbox",
    "viewbox-crop",
    "path-disagrees",
    "path-missing",
    "filter",
    "transform",
    "pseudo",
    "padding",
    "paint-url",
    "svg-event",
    "mixed-text",
    "nonsquare-size",
  ])
    await t.test(mutation, () => {
      const f = fixture(),
        n = iconNodes(f);
      if (mutation === "missing-viewbox")
        delete n.svgTopology.attributes!.viewBox;
      if (mutation === "nonsquare-viewbox")
        n.svgTopology.attributes!.viewBox = "0 0 20 24";
      if (mutation === "viewbox-crop")
        n.svgTopology.attributes!.viewBox = "0 0 10 10";
      if (mutation === "path-disagrees")
        n.pathTopology.attributes!.d += " M0 0";
      if (mutation === "path-missing") delete n.path.style.d;
      if (mutation === "filter") n.svg.style.filter = "blur(2px)";
      if (mutation === "transform") n.wrapper.style.transform = "rotate(20deg)";
      if (mutation === "pseudo")
        n.wrapper.pseudo["::before"] = { content: '"extra"' };
      if (mutation === "padding") n.wrapper.style["padding-left"] = "2px";
      if (mutation === "paint-url")
        n.path.style.fill = "url(https://example.invalid/paint)";
      if (mutation === "svg-event")
        n.svgTopology.attributes!.onclick = "alert(1)";
      if (mutation === "mixed-text")
        n.wrapper.nodes[0] = { t: "text", v: "Extra" };
      if (mutation === "nonsquare-size") n.svg.style.width = "25px";
      repin(f);
      const out = buildNativeSourceSamples(f);
      assert.equal(out.status, "refused");
      const icon = out.cases.find((row) =>
        row.id.endsWith("--default-icon-before"),
      )!;
      assert.equal(icon.status, "refused");
      assert.ok(icon.slots.every((slot) => slot.specs.length === 0));
      assert.equal(out.cases.length, 7);
      assert.ok(out.problems.length);
    });
});

test("text comes from complete ordered sample runs, not the API label or original literal", () => {
  const f = fixture();
  const raw = f.source.cases.find((c) =>
    c.expectedCaseId.endsWith("--default-icon-before"),
  )!;
  const priorLabel = structuredClone(
    raw.semantics.observation.properties.label,
  );
  const textNodes = raw.boundTopology.topology!.observation!.nodes.filter((n) =>
    ["host/0", "host/2"].includes(n.domPath),
  );
  for (const [i, fact] of textNodes.entries()) {
    const value = i === 0 ? "\t  Hello\n" : " \r world\f  ";
    fact.text = value;
    const pointer = fact.visualPath!.split("/").slice(1);
    let target: unknown = raw.tree.root;
    for (const segment of pointer)
      target = (target as Record<string, unknown>)[segment];
    (target as { v: string }).v = value;
    const slot = raw.semantics.observation.slots.find((s) => s.name === "")!;
    (slot.assigned[i] as { text: string }).text = value;
  }
  repin(f);
  const out = buildNativeSourceSamples(f);
  assert.equal(
    out.status,
    "comparison-samples-lowered",
    JSON.stringify(out.problems),
  );
  const slot = out.cases
    .find((c) => c.id === raw.expectedCaseId)!
    .slots.find((s) => s.sourceName === "")!;
  assert.equal(slot.expectations!.characters, "Hello world");
  assert.equal(
    allSpecs(slot.specs).find((s) => s.type === "text")!.characters,
    "Hello world",
  );
  assert.deepEqual(raw.semantics.observation.properties.label, priorLabel);
});

test("unrepresented whitespace, shaping and line geometry refuse text samples", async (t) => {
  for (const [channel, value] of [
    ["white-space-collapse", "preserve"],
    ["font-feature-settings", '"liga" 0'],
    ["font-stretch", "125%"],
    ["text-indent", "8px"],
    ["height", "48px"],
  ])
    await t.test(channel, () => {
      const f = fixture();
      const raw = f.source.cases[0];
      const owner = raw.tree.root.nodes.find((n) => n.t === "el")!;
      assert.equal(owner.t, "el");
      owner.el.style[channel] = value;
      repin(f);
      const out = buildNativeSourceSamples(f);
      assert.equal(out.status, "refused");
      assert.equal(out.cases[0].status, "refused");
      assert.ok(out.cases[0].slots.every((s) => !s.specs.length));
    });
});

test("SVG inherited fill and currentColor stay separate after shared reconstruction and compilation", () => {
  const f = fixture(),
    n = iconNodes(f);
  n.svg.style.fill = "rgb(0, 0, 255)";
  n.svg.style.color = "rgb(255, 0, 0)";
  n.path.style.fill = "rgb(0, 0, 255)";
  n.path.style.color = "rgb(255, 0, 0)";
  const extra = structuredClone(n.path);
  extra.style.fill = "rgb(255, 0, 0)";
  extra.style.d = 'path("M 0 0 L 1 0 L 1 1 Z")';
  const index = n.svg.nodes.length;
  n.svg.nodes.push({ t: "el", el: extra });
  n.raw.boundTopology.topology!.observation!.nodes.push({
    ...structuredClone(n.pathTopology),
    domPath: `${n.svgTopology.domPath}/3`,
    visualPath: `${n.svgTopology.visualPath}/nodes/${index}/el`,
    semanticPath: n.pathTopology.semanticPath!.replace(/\d+$/, "1"),
    attributes: { d: "M0 0L1 0L1 1Z", "fill-rule": "evenodd" },
  });
  for (const slot of n.raw.boundTopology.topology!.observation!.slots)
    if (slot.visualPaths.includes(n.pathTopology.visualPath!))
      slot.visualPaths.push(`${n.svgTopology.visualPath}/nodes/${index}/el`);
  const semanticHost = n.raw.semantics.observation.slots.find(
    (s) => s.name === "before",
  )!.assigned[0];
  assert.equal(semanticHost.kind, "element");
  if (semanticHost.kind !== "element") throw Error("fixture-host");
  const semanticSpan = semanticHost.shadow!.find((s) => s.kind === "element")!;
  if (semanticSpan.kind !== "element") throw Error("fixture-span");
  const semanticSvg = semanticSpan.children.find((s) => s.kind === "element")!;
  if (semanticSvg.kind !== "element") throw Error("fixture-svg");
  semanticSvg.children.push({
    kind: "element",
    tag: "path",
    attributes: { d: "M0 0L1 0L1 1Z", "fill-rule": "evenodd" },
    properties: {},
    children: [],
  });
  repin(f);
  const matched = matchLitRender({
    source: f.source.source,
    semantics: n.raw.semantics,
    boundTopology: n.raw.boundTopology,
  });
  assert.equal(
    matched.status,
    "structure-matched",
    JSON.stringify(matched.problems),
  );
  const result = buildNativeSourceSamples(f);
  assert.equal(
    result.status,
    "comparison-samples-lowered",
    JSON.stringify(result.cases.map((c) => c.problems)),
  );
  const slot = result.cases
    .find((c) => c.id === n.raw.expectedCaseId)!
    .slots.find((s) => s.sourceName === "before")!;
  const svg = allSpecs(slot.specs).find((s) => s.type === "svg")!;
  assert.match(svg.svg!, /^<svg\b[^>]*\sfill="rgb\(0, 0, 255\)"(?:\s|>)/);
  assert.match(svg.svg!, /<path[^>]+fill="rgb\(255, 0, 0\)"/);
  assert.match(svg.svg!, /^<svg\b[^>]*\swidth="24"(?:\s|>)/);
  assert.match(svg.svg!, /^<svg\b[^>]*\sheight="24"(?:\s|>)/);
  assert.doesNotMatch(svg.svg!, /currentColor/);
  assert.equal(slot.expectations!.svg[0].fill, "rgb(0, 0, 255)");
  assert.equal(slot.expectations!.svg[0].color, "rgb(255, 0, 0)");
});

test("comparison text preserves the measured width and alignment without changing a main slot", () => {
  const f = fixture();
  const owner = f.source.cases[0].tree.root.nodes.find((n) => n.t === "el")!;
  assert.equal(owner.t, "el");
  owner.el.style.width = "100px";
  owner.el.style["text-align"] = "right";
  repin(f);
  const result = buildNativeSourceSamples(f);
  assert.equal(result.status, "comparison-samples-lowered");
  const slot = result.cases[0].slots[0];
  const frame = slot.specs[0];
  const text = allSpecs(slot.specs).find((s) => s.type === "text")!;
  assert.equal(frame.type, "frame");
  assert.equal(frame.lits!.width, 100);
  assert.equal(frame.layout!.primary, "MAX");
  assert.equal(text.type, "text");
  assert.equal(text.lits?.width, undefined);
  assert.equal(text.textAlignH, "RIGHT");
  assert.equal(slot.expectations!.geometry.width, 100);
  assert.equal(slot.expectations!.font!.align, "right");
  assert.equal(text.slotDefault, undefined);
});

test("existing shared writer applies the sample frame width and alignment on the native node path", async () => {
  const f = fixture();
  const owner = f.source.cases[0].tree.root.nodes.find((n) => n.t === "el")!;
  assert.equal(owner.t, "el");
  owner.el.style.width = "100px";
  owner.el.style["text-align"] = "right";
  repin(f);
  const lowered = buildNativeSourceSamples(f);
  assert.equal(lowered.status, "comparison-samples-lowered");
  const samples = lowered.cases[0].slots[0].specs;
  // The adapter emits pure NodeSpecs. This test runs those exact specs through
  // the production generated writer in the existing Figma mock. Substituting
  // the generated data literal is test-only; no runtime or alternate renderer
  // is copied, and production compilation/write guards are left intact.
  const contract = ContractSchema.parse({
    id: "check.sample-writer",
    name: "SampleWriter",
    version: "0.1.0",
    status: "draft",
    description: "Writer capability fixture",
    semantics: { element: "div" },
    props: [],
    states: [],
    anatomy: {
      root: {
        layout: { display: "flex" },
        parts: {
          support: {
            layout: { display: "flex" },
            literals: { width: "1px", height: "24px" },
            parts: {
              text: {
                text: "Support",
                tokens: { "font-weight": "{weight}" },
                literals: {
                  color: "#000000",
                  "font-size": "16px",
                  "line-height": "24px",
                },
                declared: {
                  "font-family": "IBM Plex Sans",
                  "text-align": "right",
                },
              },
            },
          },
        },
      },
    },
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: {
        anchors: { importPath: "@private/test", export: "SampleWriter" },
      },
    },
  });
  const engine = createFigmaEngine({
    tokens: {
      primitives: { weight: { $type: "number", $value: "600" } },
      semantic: {},
      light: {},
      dark: {},
      brands: { default: {} },
    },
    icons: new Map(),
  });
  const data = engine.compileComponentData(
    contract,
    new Map([[contract.id, contract]]),
  );
  const generated = engine.buildBatchScript([data], null);
  const injected = structuredClone(data);
  injected.variants[0].spec.children = structuredClone(samples);
  const marker = `const COMPONENTS = ${JSON.stringify([data], null, 2)};`;
  assert.equal(generated.split(marker).length, 2);
  const source = generated.replace(
    marker,
    `const COMPONENTS = ${JSON.stringify([injected], null, 2)};`,
  );
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({
    figma,
    console: { log() {}, warn() {}, error() {} },
  });
  await vm.runInContext(`(async () => {\n${source}\n})()`, context, {
    timeout: 10000,
  });
  const frame = root.findOne(
    (n: { type: string; name: string }) =>
      n.type === "FRAME" && n.name === samples[0].name,
  );
  assert.ok(frame);
  assert.equal(frame.width, 100);
  assert.equal(frame.height, 24);
  assert.equal(frame.primaryAxisSizingMode, "FIXED");
  assert.equal(frame.counterAxisSizingMode, "FIXED");
  assert.equal(frame.primaryAxisAlignItems, "MAX");
  assert.ok(frame.children);
  assert.equal(frame.children.length, 1);
  assert.equal(frame.children[0].type, "TEXT");
  assert.equal(frame.children[0].characters, "Label");
  assert.ok(frame.children[0].fontName);
  assert.equal(frame.children[0].fontName.family, "IBM Plex Sans");
  assert.ok(
    frame.children[0].width < frame.width,
    "HUG text remains narrower; alignment belongs to the measured frame",
  );
});
