import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import type { CapturedNode } from "../extract/computed/lib.js";
import { flatten } from "../extract/computed/lib.js";
import { matchLitRender } from "./lit-render-match.js";
import { semanticHash } from "./semantics.js";
import {
  projectSourceBoundAnatomy,
  type SourceBoundAnatomyInput,
} from "./source-bound-anatomy.js";

const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const source = JSON.parse(
  readFileSync(
    new URL(
      "../extract/fixtures/lit-template/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const records = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/lit-render-match/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const pack = JSON.parse(
  readFileSync(
    new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url),
    "utf8",
  ),
);
const files = JSON.parse(
  gunzipSync(Buffer.from(pack.payload, "base64")).toString(),
);

// Original normalized reader tree, serialized exactly as its recorded digest:
// private/source-reference-app/2d9e45b2-b81c-4712-b0e9-e029c0ff10df/
// atoms-button--default-icon-before/source-tree.json .tree. This is historical
// source evidence, not a recapture, modified reference or accepted component.
// SHA-256 976a09488b91561676da58fd142c4f5dc8d612484be2dad4117c5b8d864d9c77.
// Kept compressed inline so this test does not require private archives.
const originalIconTreeGzip =
  "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";

function fixture(story = "atoms-button--default"): SourceBoundAnatomyInput {
  const record = records.records.find((row: any) => row.story === story);
  assert.ok(record);
  assert.equal(sha(record.semantics.json), record.semantics.sha256);
  assert.equal(sha(record.measurement.json), record.measurement.sha256);
  const semantics = JSON.parse(record.semantics.json),
    boundTopology = JSON.parse(record.measurement.json).bound;
  let root: CapturedNode;
  if (story === "atoms-button--default-icon-before") {
    const bytes = gunzipSync(Buffer.from(originalIconTreeGzip, "base64"));
    assert.equal(
      sha(bytes),
      "976a09488b91561676da58fd142c4f5dc8d612484be2dad4117c5b8d864d9c77",
    );
    root = JSON.parse(bytes.toString());
  } else {
    const saved = files[`${story}/source-tree.json`];
    const bytes =
      saved.utf8 === undefined
        ? Buffer.from(saved.base64, "base64")
        : Buffer.from(saved.utf8);
    assert.equal(sha(bytes), saved.sha256);
    root = JSON.parse(bytes.toString()).tree;
  }
  const match = matchLitRender({ source, semantics, boundTopology });
  assert.equal(
    match.status,
    "structure-matched",
    JSON.stringify(match.problems),
  );
  const branch = match.nodes.find(
    (node) => node.domPath === boundTopology.topology.observation.rootDomPath,
  )!;
  return {
    expectedCaseId: story,
    sourceProgramSha256: "a".repeat(64),
    source: structuredClone(source),
    semantics,
    boundTopology,
    tree: { root, sha256: sha(JSON.stringify(root)) },
    // Actual matcher evidence in the authenticated candidate case shape. Full
    // source/runtime admission is covered by the separate candidate tests.
    case: {
      id: story,
      story,
      status: "structure-matched",
      problems: [],
      limitations: [...match.limitations],
      variant: story.endsWith("secondary")
        ? { kind: "value", value: "secondary" }
        : { kind: "omitted" },
      branch: {
        templateId: branch.templateId,
        sourceNodeId: branch.sourceNodeId,
        tag: branch.tag,
      },
      nodes: structuredClone(match.nodes),
      sourcePngSha256: match.sourcePngSha256,
      sourceTreeSha256: match.sourceTreeSha256,
      semanticObservationSha256: match.semanticObservationSha256,
      topologyObservationSha256: match.topologyObservationSha256,
    },
  };
}
function texts(root: CapturedNode): string[] {
  return root.nodes.flatMap((child) =>
    child.t === "text" ? [child.v] : texts(child.el),
  );
}
/** Synthetic mutations update only the dependent digests/structural candidate,
 * so negatives exercise the new raw visual-tree partition, not stale hashes. */
function rebind(input: SourceBoundAnatomyInput) {
  const topology = input.boundTopology.topology!;
  input.tree.sha256 = sha(JSON.stringify(input.tree.root));
  input.semantics.sourceTreeSha256 = input.tree.sha256;
  input.boundTopology.sourceTreeSha256 = input.tree.sha256;
  topology.sourceTreeSha256 = input.tree.sha256;
  topology.observationSha256 = semanticHash(topology.observation);
  input.source.sourceSha256 = sha(input.source.source);
  input.semantics.observationSha256 = semanticHash(input.semantics.observation);
  input.boundTopology.semanticObservationSha256 =
    input.semantics.observationSha256;
  if (input.staticRender)
    input.staticRender.sourceTreeSha256 = input.tree.sha256;
  const match = matchLitRender({
    source: input.source,
    semantics: input.semantics,
    boundTopology: input.boundTopology,
    ...(input.staticRender ? { staticRender: input.staticRender } : {}),
  });
  if (match.status === "structure-matched") {
    input.case.nodes = structuredClone(match.nodes);
    const root = match.nodes.find(
      (node) => node.domPath === topology.observation!.rootDomPath,
    )!;
    input.case.branch = {
      templateId: root.templateId,
      sourceNodeId: root.sourceNodeId,
      tag: root.tag,
    };
  }
  input.case.sourceTreeSha256 = input.tree.sha256;
  input.case.topologyObservationSha256 = topology.observationSha256;
  input.case.semanticObservationSha256 = input.semantics.observationSha256;
}

test("recorded default separates accessible label from terminal visible slot without changing source bytes", () => {
  const input = fixture(),
    before = JSON.stringify(input),
    result = projectSourceBoundAnatomy(input);
  assert.equal(
    result.status,
    "structural-projection",
    JSON.stringify(result.problems),
  );
  assert.equal(result.acceptedContract, null);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.sourceTreeSha256, input.tree.sha256);
  assert.notEqual(result.projectionTreeSha256, result.sourceTreeSha256);
  assert.equal(result.projectionTreeSha256, sha(JSON.stringify(result.root)));
  assert.deepEqual(
    result.elements.map((row) => [
      row.node.tag,
      row.visualPath,
      row.flatPath,
      row.projectionFlatPath,
    ]),
    [
      ["button", "", "", ""],
      ["span", "/nodes/2/el", "0", "0"],
    ],
  );
  assert.equal(result.elements[0].observedAttributes["aria-label"], "Label");
  assert.deepEqual(
    result.samples.map((sample) => [
      sample.sourceName,
      sample.kind,
      sample.text,
    ]),
    [["", "text", "Label"]],
  );
  assert.ok(texts(result.root!).every((text) => !text.trim()));
  assert.deepEqual(result.root!.style, input.tree.root.style);
  assert.deepEqual(result.root!.vrefs, input.tree.root.vrefs);
  assert.equal(result.slots.length, 1);
  assert.equal(result.slots[0].sourceName, "");
  assert.equal(
    result.slots[0].owner.sourceNodeId,
    result.elements[1].sourceNodeId,
  );
  assert.equal(result.slots[0].sampleIds[0], result.samples[0].id);
  assert.equal("props" in result, false);
  assert.equal("defaultContent" in result.slots[0], false);
});

test("recorded icon composition keeps source wrappers but all consumer custom-element/SVG content stays in samples", () => {
  const input = fixture("atoms-button--default-icon-before"),
    before = JSON.stringify(input),
    result = projectSourceBoundAnatomy(input);
  assert.equal(
    result.status,
    "structural-projection",
    JSON.stringify(result.problems),
  );
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(
    result.elements.map((row) => row.node.tag),
    ["button", "span", "span"],
  );
  assert.deepEqual(
    result.elements.map((row) => row.visualPath),
    ["", "/nodes/1/el", "/nodes/3/el"],
  );
  assert.deepEqual(
    result.slots.map((slot) => slot.sourceName),
    ["before", ""],
  );
  assert.equal(
    result.slots.some((slot) => slot.sourceName === "after"),
    false,
    "unobserved source branch is not invented",
  );
  const icon = result.samples.find((sample) => sample.sourceName === "before")!;
  assert.equal(icon.kind, "element");
  assert.equal(icon.element!.tag, "al-icon-success");
  assert.ok(flatten(icon.element!).some((el) => el.node.tag === "svg"));
  assert.equal(
    flatten(result.root!).some(
      (el) => el.node.tag === "svg" || el.node.tag.includes("-"),
    ),
    false,
  );
  assert.ok(texts(result.root!).every((text) => !text.trim()));
  assert.equal(
    result.elements[1].node.nodes.length,
    0,
    "source icon wrapper survives with an empty terminal boundary",
  );
  assert.ok(result.samples.some((sample) => sample.text?.includes("Label")));
  assert.deepEqual(
    result.elements[1].node.style,
    (input.tree.root.nodes[1] as { t: "el"; el: CapturedNode }).el.style,
  );
  assert.ok(
    result.guards.some((guard) => guard.evidence === "structure-only-unproven"),
  );
});

test("default and secondary retain identical source identities despite different classes and variable values", () => {
  const a = projectSourceBoundAnatomy(fixture()),
    b = projectSourceBoundAnatomy(fixture("atoms-button--secondary"));
  assert.equal(a.status, "structural-projection");
  assert.equal(b.status, "structural-projection");
  assert.deepEqual(
    a.elements.map((n) => [n.templateId, n.sourceNodeId, n.sourceSpan]),
    b.elements.map((n) => [n.templateId, n.sourceNodeId, n.sourceSpan]),
  );
  assert.notDeepEqual(a.root!.classes, b.root!.classes);
});

test("wrong or unavailable case/source/tree/branch identities refuse without partial promoted nodes", async (t) => {
  for (const change of [
    "case",
    "refused",
    "branch",
    "hash",
    "tree",
    "source",
    "duplicate-source",
    "wrong-slot-path",
  ])
    await t.test(change, () => {
      const input = fixture();
      if (change === "case") input.expectedCaseId = "another-case";
      if (change === "refused") input.case.status = "refused";
      if (change === "branch") input.case.branch!.tag = "a";
      if (change === "hash") input.tree.sha256 = "b".repeat(64);
      if (change === "tree") input.tree.root.style.color = "rgb(255, 0, 0)";
      if (change === "source") input.source.source += "\n// changed";
      if (change === "duplicate-source")
        input.case.nodes.push(structuredClone(input.case.nodes[0]));
      if (change === "wrong-slot-path")
        input.case.nodes.find((node) => node.tag === "slot")!.domPath =
          "host/shadow/99";
      const result = projectSourceBoundAnatomy(input);
      assert.equal(result.status, "refused");
      assert.equal(result.root, undefined);
      assert.deepEqual(result.elements, []);
      assert.deepEqual(result.samples, []);
      assert.deepEqual(result.slots, []);
      assert.ok(result.problems.length);
    });
});

test("self-consistent altered topology cannot hide unmatched visual elements or misassign slot content", async (t) => {
  for (const change of [
    "extra-owned-element",
    "duplicate-visual",
    "visual-tag",
    "visual-text",
    "slot-path-list",
    "slot-chain",
    "duplicate-assignment",
    "assignment-parent",
    "source-text",
  ])
    await t.test(change, () => {
      const input = fixture(),
        topology = input.boundTopology.topology!.observation!;
      const sample = topology.nodes.find(
        (node) => node.slotChain?.length && node.kind === "text",
      )!;
      if (change === "extra-owned-element")
        input.tree.root.nodes.push({
          t: "el",
          el: { tag: "span", classes: [], style: {}, pseudo: {}, nodes: [] },
        });
      if (change === "duplicate-visual")
        topology.nodes.find(
          (node) => node.visualPath === "/nodes/0",
        )!.visualPath = "";
      if (change === "visual-tag")
        (input.tree.root.nodes[2] as { t: "el"; el: CapturedNode }).el.tag =
          "div";
      if (change === "visual-text")
        sample.text = "Different bytes at the same proven identity";
      if (change === "slot-path-list") topology.slots[0].visualPaths = [];
      if (change === "slot-chain") sample.slotChain = [];
      if (change === "duplicate-assignment")
        topology.slots[0].assigned.push(topology.slots[0].assigned[0]);
      if (change === "assignment-parent") {
        sample.visualPath = "/nodes/0";
        topology.slots[0].visualPaths = ["/nodes/0"];
      }
      if (change === "source-text") {
        const ownedText = topology.nodes.find(
          (node) => node.visualPath === "/nodes/0",
        )!;
        ownedText.text = "Unproven source text";
        (input.tree.root.nodes[0] as { t: "text"; v: string }).v =
          ownedText.text;
      }
      rebind(input);
      const result = projectSourceBoundAnatomy(input);
      assert.equal(result.status, "refused", change);
      assert.ok(result.problems.length);
      assert.equal(result.root, undefined);
      assert.deepEqual(result.elements, []);
    });
});

test("malformed input fails closed", () => {
  for (const input of [undefined, null, {}, { expectedCaseId: "x" }]) {
    const result = projectSourceBoundAnatomy(input as never);
    assert.equal(result.status, "refused");
    assert.equal(result.acceptedContract, null);
  }
});

test("rehashed visual pointers cannot swap same-tag source wrappers", () => {
  const input = fixture("atoms-button--default-icon-before"),
    topology = input.boundTopology.topology!.observation!;
  const flip = (pointer: string) =>
    pointer.replace(
      /^\/nodes\/([13])\/el/,
      (_, index) => `/nodes/${index === "1" ? "3" : "1"}/el`,
    );
  for (const node of topology.nodes)
    if (node.visualPath !== undefined) node.visualPath = flip(node.visualPath);
  for (const slot of topology.slots)
    slot.visualPaths = slot.visualPaths.map(flip);
  [input.tree.root.nodes[1], input.tree.root.nodes[3]] = [
    input.tree.root.nodes[3],
    input.tree.root.nodes[1],
  ];
  rebind(input);
  const result = projectSourceBoundAnatomy(input);
  assert.equal(result.status, "refused");
});

test("synthetic source-declared fallback stays terminal sample content, not owned anatomy or an invented default", () => {
  const input = fixture(),
    topology = input.boundTopology.topology!.observation!;
  const slot = topology.slots[0],
    oldSample = topology.nodes.find(
      (node) => node.domPath === slot.assigned[0],
    )!;
  const oldPointer = oldSample.visualPath!;
  input.source.source = input.source.source.replaceAll(
    "<slot></slot>",
    "<slot><span></span></slot>",
  );
  const fallbackDom = `${slot.domPath}/0`,
    fallbackPointer = `${oldPointer}/el`;
  topology.nodes = topology.nodes.filter(
    (node) => node.domPath !== oldSample.domPath,
  );
  topology.nodes.push({
    kind: "element",
    tag: "span",
    namespace: "http://www.w3.org/1999/xhtml",
    attributes: {},
    domPath: fallbackDom,
    semanticPath: `${slot.semanticPath}/0`,
    shadowHostDomPath: "host",
    visualPath: fallbackPointer,
    slotChain: [slot.domPath],
  });
  slot.assigned = [];
  slot.fallback = [fallbackDom];
  slot.distribution = "fallback";
  slot.visualPaths = [fallbackPointer];
  input.semantics.observation.slots[0].assigned = [];
  input.semantics.observation.slots[0].fallback = [
    {
      kind: "element",
      tag: "span",
      attributes: {},
      properties: {},
      children: [],
    },
  ];
  const wrapper = input.tree.root.nodes.find((node) => node.t === "el") as {
    t: "el";
    el: CapturedNode;
  };
  const position = Number(oldPointer.split("/").at(-1));
  wrapper.el.nodes[position] = {
    t: "el",
    el: { tag: "span", classes: [], style: {}, pseudo: {}, nodes: [] },
  };
  rebind(input);
  assert.equal(
    matchLitRender({
      source: input.source,
      semantics: input.semantics,
      boundTopology: input.boundTopology,
    }).status,
    "structure-matched",
  );
  const result = projectSourceBoundAnatomy(input);
  assert.equal(
    result.status,
    "structural-projection",
    JSON.stringify(result.problems),
  );
  assert.equal(result.elements.length, 2);
  assert.equal(result.samples.length, 1);
  assert.equal(result.samples[0].distribution, "fallback");
  assert.equal(result.samples[0].element!.tag, "span");
  assert.equal(result.samples[0].sourceNodes.length, 1);
  assert.equal(result.slots[0].distribution, "fallback");
  assert.ok(texts(result.root!).every((text) => !text.trim()));
});

test("synthetic direct slot keeps original flat paths distinct from pruned-tree paths", () => {
  const input = fixture("atoms-button--default-icon-before"),
    topology = input.boundTopology.topology!.observation!;
  input.source.source =
    'import {html} from "lit"; export class ALButton { render(){ return html`<button part="button"><slot name="before"></slot><span><slot></slot></span></button>`; } }';
  const slot = topology.slots.find((slot) => slot.name === "before")!;
  const oldSlotPath = slot.domPath,
    oldOwnerPath = oldSlotPath.slice(0, oldSlotPath.lastIndexOf("/"));
  const pointer = (value: string) =>
    value.replace(/^\/nodes\/1\/el\/nodes\/0\/el/, "/nodes/1/el");
  topology.nodes = topology.nodes.filter(
    (node) => node.domPath !== oldOwnerPath,
  );
  for (const node of topology.nodes) {
    if (node.domPath === oldSlotPath) {
      node.domPath = oldOwnerPath;
      node.semanticPath = "0/0";
    }
    if (node.visualPath !== undefined)
      node.visualPath = pointer(node.visualPath);
    if (node.slotChain)
      node.slotChain = node.slotChain.map((value) =>
        value === oldSlotPath ? oldOwnerPath : value,
      );
  }
  slot.domPath = oldOwnerPath;
  slot.semanticPath = "0/0";
  slot.visualPaths = slot.visualPaths.map(pointer);
  input.semantics.observation.slots.find(
    (slot) => slot.name === "before",
  )!.path = "0/0";
  const wrapper = input.tree.root.nodes[1] as { t: "el"; el: CapturedNode };
  input.tree.root.nodes[1] = structuredClone(wrapper.el.nodes[0]);
  rebind(input);
  const result = projectSourceBoundAnatomy(input);
  assert.equal(
    result.status,
    "structural-projection",
    JSON.stringify(result.problems),
  );
  assert.deepEqual(
    result.elements.map((element) => [
      element.node.tag,
      element.flatPath,
      element.projectionFlatPath,
    ]),
    [
      ["button", "", ""],
      ["span", "1", "0"],
    ],
  );
  assert.equal(
    result.slots.find((slot) => slot.sourceName === "before")!.ownerVisualPath,
    "",
  );
  assert.equal(
    result.samples.find((sample) => sample.sourceName === "before")!.flatPath,
    "0",
  );
});

function checkboxFixture(): SourceBoundAnatomyInput {
  const read = (name: string) =>
    JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
  const record = read("./fixtures/lit-render-match/altitude-checkbox.json");
  const input = JSON.parse(
    gunzipSync(Buffer.from(record.payload, "base64")).toString(),
  );
  const tree = read("./fixtures/checkbox-anatomy-tree.json");
  const bytes = gunzipSync(Buffer.from(tree.payload, "base64"));
  assert.equal(sha(bytes), tree.sha256);
  const match = matchLitRender(input);
  assert.equal(
    match.status,
    "structure-matched",
    JSON.stringify(match.problems),
  );
  const root = match.nodes.find(
    (node) =>
      node.domPath === input.boundTopology.topology.observation.rootDomPath,
  )!;
  const story = "atoms-checkbox--default";
  return {
    ...input,
    version: 2,
    expectedCaseId: story,
    // Synthetic host envelope only; source/runtime admission has separate tests.
    sourceProgramSha256: "a".repeat(64),
    tree: { root: JSON.parse(bytes.toString()), sha256: tree.sha256 },
    case: {
      id: story,
      story,
      status: "structure-matched",
      problems: [],
      limitations: match.limitations,
      branch: {
        templateId: root.templateId,
        sourceNodeId: root.sourceNodeId,
        tag: root.tag,
      },
      nodes: match.nodes,
      sourcePngSha256: match.sourcePngSha256,
      sourceTreeSha256: match.sourceTreeSha256,
      semanticObservationSha256: match.semanticObservationSha256,
      topologyObservationSha256: match.topologyObservationSha256,
    },
  };
}

test("recorded Checkbox v2 preserves pseudo owners and authored nested fallback separately from consumer content", () => {
  const input = checkboxFixture(),
    before = JSON.stringify(input);
  const result = projectSourceBoundAnatomy(input);
  assert.equal(
    result.status,
    "structural-projection",
    JSON.stringify(result.problems),
  );
  assert.equal(result.version, 2);
  assert.equal(result.acceptedContract, null);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.pseudoPlanes?.length, 2);
  assert.equal(result.sourceTexts?.length, 1);
  const fallback = result.samples.find((sample) => sample.nestedHosts?.length);
  assert.ok(fallback, JSON.stringify(result.samples));
  assert.equal(fallback.distribution, "fallback");
  assert.equal(fallback.nestedHosts?.length, 1);
  assert.equal(fallback.sourceTexts?.[0].sourceProperty, "fieldNote");
  assert.ok(
    result.samples.some((sample) => sample.distribution === "assigned"),
  );
  for (const plane of result.pseudoPlanes!) {
    const element = result.elements.find(
      (element) => element.visualPath === plane.ownerVisualPath,
    );
    assert.ok(element);
    assert.equal(plane.owner.sourceNodeId, element.sourceNodeId);
    assert.deepEqual(element.node.pseudo[plane.pseudo], plane.style);
  }
  assert.deepEqual(projectSourceBoundAnatomy(input), result);
});

test("v2 refuses unproven text, pseudo changes and missing static-render evidence without publishing a partial projection", async (t) => {
  for (const mutation of [
    "missing-proof",
    "plane-style",
    "plane-census",
    "plane-owner",
    "raw-style",
    "authored-text",
  ]) {
    await t.test(mutation, () => {
      const input = checkboxFixture();
      const topology = input.boundTopology.topology!.observation!;
      if (mutation === "missing-proof") delete input.staticRender;
      if (mutation === "plane-style")
        topology.pseudoPlanes![0].style.color = "rgb(1, 2, 3)";
      if (mutation === "plane-census") topology.pseudoPlanes!.pop();
      if (mutation === "plane-owner")
        topology.pseudoPlanes![0].ownerDomPath = topology.rootDomPath;
      if (mutation === "raw-style") {
        const change = (node: CapturedNode): boolean => {
          if (node.pseudo["::before"]) {
            node.pseudo["::before"].color = "rgb(1, 2, 3)";
            return true;
          }
          return node.nodes.some(
            (child) => child.t === "el" && change(child.el),
          );
        };
        assert.ok(change(input.tree.root));
      }
      if (mutation === "authored-text") {
        const text = matchLitRender(input).texts![0];
        const raw = text
          .visualPath!.split("/")
          .slice(1)
          .reduce((value: any, key) => value[key], input.tree.root);
        raw.v = "Unproven fallback";
        topology.nodes.find((node) => node.domPath === text.domPath)!.text =
          raw.v;
      }
      // Rebind changed bytes so a stale hash alone cannot explain rejection.
      rebind(input);
      if (input.staticRender)
        input.staticRender.sourceTreeSha256 = input.tree.sha256;
      const result = projectSourceBoundAnatomy(input);
      assert.equal(result.status, "refused");
      assert.equal(result.root, undefined);
      assert.equal(result.pseudoPlanes, undefined);
      assert.deepEqual(result.elements, []);
      assert.ok(result.problems.length);
      if (mutation.startsWith("plane-") || mutation === "raw-style")
        assert.match(result.problems.join(), /pseudo|correspondence/);
    });
  }
});

test("v2 requires explicit opt-in and legacy anatomy still refuses pseudo-bearing trees", () => {
  const input = checkboxFixture();
  delete input.version;
  assert.deepEqual(projectSourceBoundAnatomy(input).problems, [
    "source-anatomy-projection-version-invalid",
  ]);
  delete input.staticRender;
  assert.equal(projectSourceBoundAnatomy(input).status, "refused");
  const button = fixture();
  button.tree.root.pseudo["::before"] = { content: '""' };
  rebind(button);
  assert.deepEqual(projectSourceBoundAnatomy(button).problems, [
    "source-anatomy-tree-shape-unavailable",
  ]);
});

test("pseudo on a nested component implementation cannot borrow its host's source identity", () => {
  const input = checkboxFixture();
  const topology = input.boundTopology.topology!.observation!;
  const host = matchLitRender(input).nodes.find((node) =>
    node.tag.includes("-"),
  )!;
  const internal = topology.nodes.find(
    (node) =>
      node.kind === "element" &&
      node.domPath.startsWith(host.domPath + "/shadow/") &&
      node.visualPath,
  )!;
  assert.ok(internal);
  const raw = internal
    .visualPath!.split("/")
    .slice(1)
    .reduce((value: any, key) => value[key], input.tree.root) as CapturedNode;
  raw.pseudo["::after"] = { content: '""', width: "1px", height: "1px" };
  topology.pseudoPlanes!.push({
    ownerDomPath: internal.domPath,
    ownerVisualPath: internal.visualPath!,
    visualPath: internal.visualPath! + "/pseudo/::after",
    pseudo: "::after",
    style: raw.pseudo["::after"],
    ...(internal.slotChain ? { slotChain: internal.slotChain } : {}),
  });
  rebind(input);
  const result = projectSourceBoundAnatomy(input);
  assert.equal(result.status, "refused");
  assert.deepEqual(result.problems, [
    "source-anatomy-pseudo-source-owner-unmapped",
  ]);
  assert.equal(result.root, undefined);
  assert.deepEqual(result.elements, []);
});
