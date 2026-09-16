import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { loadRecordedSourceProgram } from "./source-program.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";
import type {
  SourceTopology,
  TopologyNode,
  TopologyResult,
} from "./topology.js";
import {
  deriveSourceWrapperPredicates,
  evaluateSourceWrapperPredicate,
  type SourceWrapperPredicateInput,
} from "./source-wrapper-predicates.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const entryPath = "libs/al-web-components/components/button/button.ts";
const basePath = "libs/al-web-components/components/ALElement.ts";
type Files = Record<string, { sha256: string; text: string }>;

function fixture(change?: (files: Files) => void) {
  const pack = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/source-program-button-recorded.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const files = pack.files as Files;
  for (const record of Object.values(files))
    assert.equal(sha(record.text), record.sha256);
  change?.(files);
  const root = mkdtempSync(path.join(tmpdir(), "source-wrapper-"));
  const hashes: Record<string, string> = {};
  const put = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
    hashes[file] = sha(text);
  };
  try {
    put(pack.manifestPath, "{}");
    for (const [file, record] of Object.entries(files)) put(file, record.text);
    const program = loadRecordedSourceProgram({
      checkout: root,
      revision: pack.sourceRevision,
      manifestPath: pack.manifestPath,
      manifestSha256: hashes[pack.manifestPath],
      modulePath: "components/button/button.ts",
      className: "ALButton",
      sourceHashes: hashes,
    });
    const input: SourceWrapperPredicateInput = {
      program,
      expectedProgramSha256: program.digest,
      source: {
        source: files[entryPath].text,
        sourceSha256: hashes[entryPath],
        modulePath: "components/button/button.ts",
        className: "ALButton",
      },
    };
    return {
      input,
      close: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
function beforeWrapper(input: SourceWrapperPredicateInput) {
  const out = deriveSourceWrapperPredicates(input);
  const predicate = out.predicates.find(
    (p) =>
      p.normalForm?.value === "before" &&
      p.remainingGuards.some(
        (g) => g.when === "falsy" && g.expression.raw === "this.href",
      ),
  );
  assert.ok(predicate, JSON.stringify(out));
  return predicate.wrapper;
}
const element = (
  domPath: string,
  attributes: Record<string, string> = {},
  shadowHostDomPath?: string,
): TopologyNode => ({
  domPath,
  kind: "element",
  tag: "span",
  namespace: "http://www.w3.org/1999/xhtml",
  attributes,
  ...(shadowHostDomPath ? { shadowHostDomPath } : {}),
});
function topology(nodes: TopologyNode[]) {
  const observation: SourceTopology = {
    hostDomPath: "host",
    rootDomPath: "host/shadow/0",
    nodes: [
      element("host", { slot: "before" }),
      element("host/shadow/0", {}, "host"),
      ...nodes,
    ],
    slots: [],
    omitted: [],
  };
  const result: TopologyResult = {
    status: "captured",
    problems: [],
    limitations: [],
    sourceTreeSha256: "a".repeat(64),
    sourcePngSha256: "b".repeat(64),
    observation,
    observationSha256: sha(JSON.stringify(observation)),
  };
  return {
    topology: result,
    expected: {
      sourceTreeSha256: result.sourceTreeSha256,
      sourcePngSha256: result.sourcePngSha256,
      topologyObservationSha256: result.observationSha256!,
    },
  };
}

test("recorded helper AST reduces all four whole-wrapper identities and preserves true versus undefined", () => {
  const f = fixture();
  try {
    const bytes = JSON.stringify(f.input);
    const out = deriveSourceWrapperPredicates(f.input);
    assert.equal(out.status, "predicates-observed", JSON.stringify(out));
    assert.equal(out.acceptedContract, null);
    assert.equal(out.nativeQualification, "unqualified");
    assert.deepEqual(out.assumptions, [
      "original-dispatch",
      "stable-native-query",
    ]);
    assert.equal(out.predicates.length, 4);
    assert.deepEqual(out.predicates.map((p) => p.normalForm?.selector).sort(), [
      '[slot="after"]',
      '[slot="after"]',
      '[slot="before"]',
      '[slot="before"]',
    ]);
    for (const row of out.predicates) {
      assert.equal(row.status, "predicate-derived", JSON.stringify(row));
      assert.deepEqual(row.returns, {
        whenMatch: "true",
        whenAbsent: "undefined",
      });
      assert.ok(row.wrapper.sourceNodeId.startsWith("element:"));
      assert.equal(
        f.input.source.source
          .slice(row.wrapper.sourceSpan.start, row.wrapper.sourceSpan.end)
          .startsWith("<span"),
        true,
      );
      assert.equal(row.renderMember!.name, "render");
      assert.deepEqual(
        row.members.map((m) => [m.name, m.span.start, m.span.end]),
        [
          ["slotNotEmpty", 2879, 3036],
          ["slotEmpty", 2692, 2803],
        ],
      );
      assert.ok(
        row.members.every(
          (m) =>
            m.moduleSha256 ===
            "c44f4c642b6e9605de9ad93f9fbaaf24db73d9e92bebb65a56df7e6338995a78",
        ),
      );
      assert.ok(row.calls.some((c) => c.target === "native-query-selector"));
      assert.ok(
        row.remainingGuards.some((g) => g.expression.raw === "this.href"),
      );
    }
    assert.deepEqual(deriveSourceWrapperPredicates(f.input), out);
    assert.equal(JSON.stringify(f.input), bytes);
  } finally {
    f.close();
  }
});

test("literal query witnesses include empty and nested light elements but exclude text, host and shadows", async (t) => {
  const f = fixture();
  try {
    const wrapper = beforeWrapper(f.input);
    const cases: Array<{
      name: string;
      nodes: TopologyNode[];
      witnesses: string[];
    }> = [
      { name: "empty host", nodes: [], witnesses: [] },
      {
        name: "empty named element",
        nodes: [element("host/0", { slot: "before" })],
        witnesses: ["host/0"],
      },
      {
        name: "nested unassigned element",
        nodes: [element("host/0"), element("host/0/0", { slot: "before" })],
        witnesses: ["host/0/0"],
      },
      {
        name: "default text",
        nodes: [{ domPath: "host/0", kind: "text", text: "Button" }],
        witnesses: [],
      },
      {
        name: "default element",
        nodes: [element("host/0", { slot: "" })],
        witnesses: [],
      },
      {
        name: "host shadow",
        nodes: [element("host/shadow/0/0", { slot: "before" }, "host")],
        witnesses: [],
      },
      {
        name: "descendant shadow",
        nodes: [
          element("host/0"),
          element("host/0/shadow/0", { slot: "before" }, "host/0"),
        ],
        witnesses: [],
      },
      {
        name: "wrong named element",
        nodes: [element("host/0", { slot: "after" })],
        witnesses: [],
      },
      {
        name: "two matches",
        nodes: [
          element("host/0", { slot: "before" }),
          element("host/1", { slot: "before" }),
        ],
        witnesses: ["host/0", "host/1"],
      },
    ];
    for (const c of cases)
      await t.test(c.name, () => {
        const evidence = topology(c.nodes);
        const out = evaluateSourceWrapperPredicate({
          ...f.input,
          wrapper,
          ...evidence,
        });
        assert.equal(
          out.status,
          "snapshot-predicate-observed",
          JSON.stringify(out),
        );
        assert.deepEqual(out.witnesses, c.witnesses);
        assert.equal(out.matches, c.witnesses.length > 0);
        assert.deepEqual(
          out.callResult,
          c.witnesses.length
            ? { kind: "value", value: true }
            : { kind: "undefined" },
        );
        assert.equal(out.acceptedContract, null);
      });
  } finally {
    f.close();
  }
});

test("actual recorded default and icon originals join hash-bound topology without assigned-node heuristics", () => {
  const f = fixture();
  try {
    const pack = JSON.parse(
      readFileSync(
        new URL(
          "./fixtures/source-visual-button-recorded.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const raw = gunzipSync(Buffer.from(pack.payload, "base64"));
    assert.equal(sha(raw), pack.payloadSha256);
    const visual = JSON.parse(raw.toString()) as SourceVisualContractInput;
    const wrapper = beforeWrapper(f.input);
    for (const [suffix, expected] of [
      ["--default", false],
      ["--default-icon-before", true],
    ] as const) {
      const original = visual.cases.find((c) =>
        c.expectedCaseId.endsWith(suffix),
      )!;
      const record = original.boundTopology.topology!;
      const out = evaluateSourceWrapperPredicate({
        ...f.input,
        wrapper,
        topology: record,
        expected: {
          sourceTreeSha256: original.tree.sha256,
          sourcePngSha256: original.semantics.sourcePngSha256,
          topologyObservationSha256: record.observationSha256!,
        },
      });
      assert.equal(
        out.status,
        "snapshot-predicate-observed",
        JSON.stringify(out),
      );
      assert.equal(out.matches, expected);
      if (expected) assert.ok(out.witnesses.every((p) => /^host\/\d/.test(p)));
    }
  } finally {
    f.close();
  }
});

test("renamed helpers and imported base aliases derive from bodies and symbols without name recognition or execution", () => {
  const f = fixture((files) => {
    files[entryPath].text = files[entryPath].text
      .replace("import { ALElement }", "import { ALElement as Parent }")
      .replace("extends ALElement", "extends Parent")
      .replaceAll("slotNotEmpty", "containsNamedChild");
    files[basePath].text = files[basePath].text
      .replaceAll("slotNotEmpty", "containsNamedChild")
      .replaceAll("slotEmpty", "lacksNamedChild")
      .replaceAll("slotName", "nameOfChild");
    files[entryPath].text += '\nthrow Error("source-must-never-execute");\n';
  });
  try {
    const out = deriveSourceWrapperPredicates(f.input);
    assert.equal(out.status, "predicates-observed", JSON.stringify(out));
    assert.equal(
      out.predicates.filter((p) => p.status === "predicate-derived").length,
      4,
    );
    assert.ok(
      out.predicates.every(
        (p) =>
          p.members.map((m) => m.name).join(",") ===
          "containsNamedChild,lacksNamedChild",
      ),
    );
    assert.equal(out.predicates[0].normalForm!.selector, '[slot="before"]');
  } finally {
    f.close();
  }
});

test("changed bytes and forged source inventories never supply helper authority", async (t) => {
  for (const mutation of [
    "program-digest",
    "module-bytes",
    "source-bytes",
    "member-span",
    "import-path",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      try {
        if (mutation === "program-digest")
          f.input.expectedProgramSha256 = "f".repeat(64);
        if (mutation === "module-bytes")
          f.input.program.modules.find((m) => m.path === basePath)!.text +=
            "\n";
        if (mutation === "source-bytes") f.input.source.source += "\n";
        if (mutation === "member-span")
          f.input.program.modules
            .find((m) => m.path === basePath)!
            .classes[0].members.find((m) => m.name === "slotEmpty")!.span
            .start++;
        if (mutation === "import-path")
          f.input.program.modules
            .find((m) => m.path === entryPath)!
            .imports.find((i) => i.path === basePath)!.path = entryPath;
        if (["module-bytes", "member-span", "import-path"].includes(mutation)) {
          f.input.program.digest = sha(
            JSON.stringify({ ...f.input.program, digest: undefined }),
          );
          f.input.expectedProgramSha256 = f.input.program.digest;
        }
        const out = deriveSourceWrapperPredicates(f.input);
        assert.equal(out.status, "refused");
        assert.ok(
          out.problems.length || out.predicates.every((p) => p.problems.length),
        );
        assert.ok(out.predicates.every((p) => p.status === "refused"));
      } finally {
        f.close();
      }
    });
});

test("unsupported source programs preserve named refusals instead of guessing query semantics", async (t) => {
  const mutations: Record<string, (files: Files) => void> = {
    "dynamic argument": (files) => {
      files[entryPath].text = files[entryPath].text
        .replaceAll(
          "this.slotNotEmpty('before')",
          "this.slotNotEmpty(this.name)",
        )
        .replaceAll(
          "this.slotNotEmpty('after')",
          "this.slotNotEmpty(this.name)",
        );
    },
    "unsafe selector": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "[slot${",
        "[slot][onclick${",
      );
    },
    override: (files) => {
      files[entryPath].text = files[entryPath].text.replace(
        "  render() {",
        "  slotEmpty(slotName?: string) { return false; }\n  render() {",
      );
    },
    "native override": (files) => {
      files[entryPath].text = files[entryPath].text.replace(
        "  render() {",
        "  querySelector(selector: string) { return null; }\n  render() {",
      );
    },
    "ambiguous inherited member": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "  slotEmpty(slotName?: string) {",
        "  slotEmpty(slotName?: string) { return true; }\n  slotEmpty(slotName?: string) {",
      );
    },
    "mutation in helper": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "  slotEmpty(slotName?: string) {",
        "  slotEmpty(slotName?: string) { this.setAttribute('slot', 'before');",
      );
    },
    "source dispatch mutation": (files) => {
      files[entryPath].text = files[entryPath].text.replace(
        "    super.connectedCallback();",
        "    super.connectedCallback(); this.slotEmpty = () => false;",
      );
    },
    "increment native dispatch": (files) => {
      files[entryPath].text = files[entryPath].text.replace(
        "    super.connectedCallback();",
        "    super.connectedCallback(); this.querySelector++;",
      );
    },
    "decrement helper dispatch": (files) => {
      files[entryPath].text = files[entryPath].text.replace(
        "    super.connectedCallback();",
        "    super.connectedCallback(); --this.slotEmpty;",
      );
    },
    recursion: (files) => {
      files[basePath].text = files[basePath].text.replace(
        "return !this.querySelector(`[slot${slotName ? `=\"${slotName}\"` : ''}]`);",
        "return this.slotEmpty(slotName);",
      );
    },
    "wrong absence value": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "    } else {\n      return;",
        "    } else {\n      return false;",
      );
    },
    "shadow query": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "this.querySelector(",
        "this.shadowRoot.querySelector(",
      );
    },
    "static helper": (files) => {
      files[basePath].text = files[basePath].text.replace(
        "  slotEmpty(slotName?: string)",
        "  static slotEmpty(slotName?: string)",
      );
    },
  };
  for (const [name, change] of Object.entries(mutations))
    await t.test(name, () => {
      const f = fixture(change);
      try {
        const out = deriveSourceWrapperPredicates(f.input);
        assert.equal(out.status, "refused", JSON.stringify(out));
        assert.equal(out.acceptedContract, null);
        assert.ok(
          out.problems.length ||
            (out.predicates.length &&
              out.predicates.every((p) => p.problems.length)),
        );
        assert.ok(
          out.predicates.every((p) => !p.normalForm && p.status === "refused"),
        );
      } finally {
        f.close();
      }
    });
});

test("topology refusals, byte changes and ambiguous paths cannot become positive witnesses", async (t) => {
  const f = fixture();
  try {
    const wrapper = beforeWrapper(f.input);
    for (const mutation of [
      "refused",
      "bytes",
      "tree-pin",
      "png-pin",
      "missing-pins",
      "duplicate",
      "orphan",
      "shadow-metadata",
      "wrapper-identity",
    ])
      await t.test(mutation, () => {
        const evidence = topology([element("host/0", { slot: "before" })]);
        const selected = { ...wrapper };
        if (mutation === "refused") {
          evidence.topology.status = "refused";
          evidence.topology.problems.push("original-refused");
        }
        if (mutation === "bytes")
          evidence.topology.observation!.nodes[2].attributes!.slot = "after";
        if (mutation === "tree-pin")
          evidence.expected.sourceTreeSha256 = "f".repeat(64);
        if (mutation === "png-pin")
          evidence.expected.sourcePngSha256 = "f".repeat(64);
        if (mutation === "missing-pins") {
          delete (evidence.expected as Partial<typeof evidence.expected>)
            .sourceTreeSha256;
          delete (evidence.expected as Partial<typeof evidence.expected>)
            .sourcePngSha256;
          delete (evidence.topology as Partial<TopologyResult>)
            .sourceTreeSha256;
          delete (evidence.topology as Partial<TopologyResult>).sourcePngSha256;
        }
        if (mutation === "duplicate")
          evidence.topology.observation!.nodes.push(
            element("host/0", { slot: "before" }),
          );
        if (mutation === "orphan")
          evidence.topology.observation!.nodes[2].domPath = "host/9/0";
        if (mutation === "shadow-metadata")
          evidence.topology.observation!.nodes[2].shadowHostDomPath = "host";
        if (mutation === "wrapper-identity")
          selected.sourceNodeId = "element:unknown";
        if (["duplicate", "orphan", "shadow-metadata"].includes(mutation)) {
          evidence.topology.observationSha256 = sha(
            JSON.stringify(evidence.topology.observation),
          );
          evidence.expected.topologyObservationSha256 =
            evidence.topology.observationSha256;
        }
        const out = evaluateSourceWrapperPredicate({
          ...f.input,
          wrapper: selected,
          ...evidence,
        });
        assert.equal(out.status, "refused", JSON.stringify(out));
        assert.equal(out.matches, undefined);
        assert.equal(out.callResult, undefined);
        assert.deepEqual(out.witnesses, []);
        assert.ok(out.problems.length);
      });
  } finally {
    f.close();
  }
});
