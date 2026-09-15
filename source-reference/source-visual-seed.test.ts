import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ContractSchema, walkAnatomy } from "../scripts/contract-schema.js";
import { revisionOf } from "../core/contract-provenance.js";
import { resolveRuntimeEmission } from "../core/runtime-emission.js";
import { emitReact } from "../core/emit-react.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import { refuseRetainedRuntime } from "../packages/core/src/runtime-emission.js";
import { readLitTemplateBindings } from "../extract/adapters/lit-template.js";
import { semanticHash } from "./semantics.js";
import {
  deriveButtonCandidateSemantics,
  type ButtonCandidateSemanticInput,
} from "./button-candidate-semantics.js";
import { buildSourceVisualSeed } from "./source-visual-seed.js";

const original = JSON.parse(
  readFileSync(
    new URL(
      "../extract/fixtures/lit-template/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const recorded = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/lit-render-match/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function fixture() {
  const cases = recorded.records.map((row: any) => ({
    id: row.story,
    story: row.story,
    sourceEligible: true,
    problems: [],
    semantics: JSON.parse(row.semantics.json),
    boundTopology: JSON.parse(row.measurement.json).bound,
  }));
  const declaration = cases[0].semantics.declaration;
  const properties = declaration.properties.map((p: any) => ({
    name: p.name,
    typeText: p.typeText,
    writable: p.name !== "slotNodes",
  }));
  properties.push({
    name: "styleModifier",
    typeText: "string",
    writable: true,
  });
  const api = {
    module: { path: "original.js", exportName: "ALButton" },
    declaration: { path: "original.d.ts", exportName: "ALButton" },
    properties,
    writableProperties: properties
      .filter((p: any) => p.writable)
      .map((p: any) => p.name),
    slots: declaration.slots.map((s: any) => ({ name: s.name })),
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  // This is a data-only trusted-host fixture, not a freshly qualified artifact.
  const input: ButtonCandidateSemanticInput = {
    source: structuredClone(original),
    sourceRevision: original.sourceRevision,
    sourceProgramSha256: semanticHash({ synthetic: "source program" }),
    declaration,
    declarationProblems: [],
    runtime: {
      artifactRevision: revisionOf({ synthetic: "runtime" }),
      interfaceRevision: revisionOf(api),
      registrationTag: "source-original-button",
      interface: api,
      stylesheets: [],
    },
    expectedCaseIds: cases.map((c: any) => c.id),
    cases,
  };
  return {
    source: input.source,
    semantics: deriveButtonCandidateSemantics(input),
    baseCaseId: cases[0].id,
    runtime: input.runtime,
  };
}

test("recorded source retains exact nested wrappers and all empty slots, never sample text or public defaults", () => {
  const input = fixture(),
    result = buildSourceVisualSeed(input);
  assert.equal(
    result.status,
    "unaccepted-seed",
    JSON.stringify(result.problems),
  );
  assert.equal(result.acceptedContract, null);
  const contract = ContractSchema.parse(result.contract),
    projection = result.projection!;
  assert.equal(contract.status, "draft");
  assert.equal(contract.semantics.element, "button");
  assert.deepEqual(contract.props, input.semantics.projectedProps);
  assert.deepEqual(contract.states, []);
  assert.deepEqual(contract.bindings.code.anchors, {
    importPath: original.modulePath,
    export: original.className,
  });
  assert.deepEqual(contract.bindings.figma.anchors, {
    fileKey: null,
    componentSetKey: null,
  });
  const parts = walkAnatomy(contract);
  assert.equal(parts.length, 7);
  assert.deepEqual(
    parts.filter((p) => p.part.slot).map((p) => p.part.slot),
    [{ name: "before" }, { name: "children" }, { name: "after" }],
  );
  assert.ok(
    parts.filter((p) => p.part.slot).every((p) => p.path.length === 3),
    "slots stay inside their source span wrappers",
  );
  assert.ok(
    parts.every(
      (p) =>
        !p.part.text &&
        !p.part.content &&
        !p.part.optional &&
        !p.part.visibleWhen,
    ),
  );
  assert.ok(
    contract.props.every(
      (p) =>
        p.default === undefined &&
        typeof p.type === "object" &&
        "enum" in p.type &&
        !p.type.enum.includes("(unset)"),
    ),
  );
  assert.deepEqual(
    projection.root.guards.map((g) => [g.expression.raw, g.when]),
    [["this.href", "falsy"]],
  );
  assert.equal(projection.root.semanticScope, "selected-template-only");
  assert.equal(projection.unprojectedBranches[0].tag, "a");
  assert.deepEqual(
    projection.unprojectedBranches[0].guards.map((g) => [
      g.expression.raw,
      g.when,
    ]),
    [["this.href", "truthy"]],
  );
  const after = projection.nodes.find((n) => n.sourceSlotName === "after")!;
  assert.deepEqual(after.matchedCaseIds, []);
  assert.ok(
    after.guards.some(
      (g) =>
        g.expression.raw === "this.slotNotEmpty('after')" &&
        g.expression.kind === "unsupported",
    ),
  );
  assert.ok(
    result.problems.includes("source-visual-conditional-presence-unqualified"),
  );
  assert.ok(
    result.problems.includes("source-visual-native-projection-unqualified"),
  );
  for (const node of projection.nodes) {
    assert.ok(
      original.source
        .slice(node.sourceSpan.start, node.sourceSpan.end)
        .startsWith("<" + node.tag),
    );
    assert.ok(
      parts.some(
        (p) =>
          p.name === node.partName &&
          JSON.stringify(p.path) === JSON.stringify(node.partPath),
      ),
    );
  }
});

test("unqualified runtime descriptor refuses both absent context and accidental trusted-map insertion", () => {
  const input = fixture(),
    result = buildSourceVisualSeed(input),
    contract = result.contract!;
  assert.equal(result.unqualifiedRuntimeBinding!.version, 0);
  assert.equal(
    contract.bindings.code.runtime!.bindingRevision,
    revisionOf(result.unqualifiedRuntimeBinding),
  );
  assert.throws(
    () => resolveRuntimeEmission(contract),
    /TRUSTED-CONTEXT-MISSING/,
  );
  assert.throws(
    () =>
      resolveRuntimeEmission(contract, {
        artifacts: new Map([[input.runtime.artifactRevision, input.runtime]]),
        bindings: new Map([
          [
            contract.bindings.code.runtime!.bindingRevision,
            result.unqualifiedRuntimeBinding as any,
          ],
        ]),
        tokens: {},
      }),
    /IDENTITY-MISMATCH/,
  );
  assert.throws(
    () => refuseRetainedRuntime(contract, "figma-script"),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
  assert.throws(
    () =>
      emitReact(contract, {
        tokens: new Set(),
        icons: new Map(),
        contracts: new Map([[contract.id, contract]]),
      }),
    /TRUSTED-CONTEXT-MISSING/,
  );
  assert.throws(
    () =>
      createFigmaEngine({
        tokens: {
          primitives: {},
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        },
        icons: new Map(),
      }).compileComponentData(contract, new Map()),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
});

test("source, branch, slot and default tampering refuse without returning a runtime-free contract", () => {
  const changes = [
    (i: ReturnType<typeof fixture>) => {
      i.source.source += " ";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.source.programSha256 = "bad";
    },
    (i: ReturnType<typeof fixture>) => {
      i.baseCaseId = "missing";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.cases[0].status = "refused";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.cases[0].branch!.tag = "a";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.cases[0].nodes = [];
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.slots[2].sourceNodes = [];
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.projectedProps[0].default = "secondary";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.projectedProps[0].type = "text";
    },
    (i: ReturnType<typeof fixture>) => {
      i.semantics.runtime = undefined;
    },
  ];
  for (const change of changes) {
    const input = fixture();
    change(input);
    const result = buildSourceVisualSeed(input);
    assert.equal(result.status, "refused", JSON.stringify(result));
    assert.equal(result.acceptedContract, null);
    assert.equal(result.contract, undefined);
    assert.ok(result.problems.length);
  }
});

function changedSource(body: string) {
  const input = fixture();
  input.source.source =
    "import {html} from 'lit'; export class ALButton { render(){ return html`" +
    body +
    "`; } }";
  // Test transport/shape refusal with a deliberately re-bound host fixture;
  // this does not pretend these edits passed original-source qualification.
  input.source.sourceSha256 = semanticHashText(input.source.source);
  input.semantics.source.sourceSha256 = input.source.sourceSha256;
  const read = readLitTemplateBindings(input.source),
    t = read.templates.find((t) => t.role === "returned")!;
  const root = t.roots.find((n) => n.kind === "element")!;
  if (root.kind !== "element") throw Error("fixture root");
  input.semantics.cases[0].branch = {
    templateId: t.id,
    sourceNodeId: root.id,
    tag: root.tag,
  };
  input.semantics.cases[0].nodes = [
    {
      templateId: t.id,
      sourceNodeId: root.id,
      sourceSpan: root.span,
      tag: root.tag,
      domPath: "host/shadow/0",
      observedAttributes: {},
    },
  ];
  return input;
}
const semanticHashText = (source: string) =>
  createHash("sha256").update(source).digest("hex");

test("literal text, slot fallback, dynamic content, multi-root and unresolved hierarchy refuse explicitly", () => {
  for (const [body, refusal] of [
    [
      "<button>Visible sample</button>",
      "source-visual-literal-text-unqualified",
    ],
    ["<button>\u00a0</button>", "source-visual-literal-text-unqualified"],
    [
      "<button><slot>Fallback</slot></button>",
      "source-visual-slot-fallback-unqualified",
    ],
    [
      "<button>${this.label}</button>",
      "source-visual-expression-hierarchy-unqualified",
    ],
    [
      "<button></button><span></span>",
      "source-visual-root-hierarchy-unqualified",
    ],
    [
      "<button>${helper(() => html`<slot></slot>`)}</button>",
      "source-visual-expression-hierarchy-unqualified",
    ],
    [
      "<button>${this.ready ? html`<span></span>` : html`<div></div>`}</button>",
      "source-visual-expression-hierarchy-unqualified",
    ],
  ]) {
    const result = buildSourceVisualSeed(changedSource(body));
    assert.equal(result.status, "refused", body);
    assert.equal(result.contract, undefined);
    assert.ok(
      result.problems.includes(refusal),
      JSON.stringify(result.problems),
    );
  }
});

test("repeat assembly is exact and detached from both inputs and returned results", () => {
  const input = fixture(),
    before = structuredClone(input),
    first = buildSourceVisualSeed(input);
  assert.deepEqual(input, before);
  const second = buildSourceVisualSeed(input);
  assert.deepEqual(first, second);
  first.contract!.props[0].name = "mutated";
  first.projection!.root.guards[0].expression.raw = "mutated";
  first.unqualifiedRuntimeBinding!.slots[0].sourceSlot = "mutated";
  assert.deepEqual(buildSourceVisualSeed(input), second);
});
