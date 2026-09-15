import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { revisionOf } from "./contract-provenance.js";
import { nativeSourceCompilerFixture } from "./native-source-test-fixture.js";
import {
  emitNativeTokenContextScript,
  emitNativeTokenContextReadbackScript,
} from "./token-set.js";
import {
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
} from "./native-token-context.js";
import { nativeFixtureHost } from "../source-reference/native-operation-test-fixture.js";
import { type NativeSourceWriteContext } from "./native-source-write.js";

const operation = {
  id: "10000000-0000-4000-8000-000000000001",
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
async function fixture(paths = ["surface", "space"]) {
  const source = nativeSourceCompilerFixture();
  const host = nativeFixtureHost(),
    { figma } = host;
  const modeCalls: string[] = [];
  // Explicit modes are not represented in the shared mock yet. This shim
  // records exactly what the real API receives; it does not prove layout.
  const prototype = Object.getPrototypeOf(figma.currentPage);
  prototype.setExplicitVariableModeForCollection = function (
    collection: any,
    modeId: string,
  ) {
    assert.equal(collection, host.collections[0]);
    assert.equal(modeId, collection.modes[0].modeId);
    this.explicitVariableModes = { [collection.id]: modeId };
    modeCalls.push(this.id);
  };
  const run = async (script: string) =>
    clone(
      await vm.runInNewContext(
        `(async () => {\n${script}\n})()`,
        { figma, console },
        { timeout: 5000 },
      ),
    );
  const input: NativeTokenContextInput = {
    ...operation,
    scopeId: `source-${operation.id}`,
    source: {
      revision: source.projection.source.revision,
      sourceProgramSha256: source.projection.source.programSha256,
      tokensSha256: "f".repeat(64),
    },
    tokenPaths: paths,
    modes: [
      {
        sourceMode: "dark",
        brand: "default",
        nativeModeName: "Dark",
        tokens: source.tokens.primitives,
        tokenTreeRevision: revisionOf(source.tokens.primitives),
      },
    ],
  };
  const creation = await run(emitNativeTokenContextScript(input).script);
  assert.equal(creation.status, "created-candidate");
  const observed = await run(
    emitNativeTokenContextReadbackScript(input, creation.creationIdentity),
  );
  assert.equal(observed.status, "readback-collected");
  const context: NativeSourceWriteContext = {
    operation,
    tokens: {
      input,
      identity: creation.creationIdentity,
      receipt: observed.receipt,
    },
  };
  assert.equal(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: context.tokens.identity,
      receipt: context.tokens.receipt,
    }).status,
    "native-token-context-observed",
  );
  const emit = () =>
    source
      .engine()
      .buildNativeSourceComponentScript(
        source.contract,
        new Map([[source.contract.id, source.contract]]),
        context,
      );
  return { ...host, source, modeCalls, context, emit, run };
}

test("shared native writer creates operation-owned empty mains with source identities, modes and full slot keys", async () => {
  const f = await fixture();
  // Force mode-before-paint: resolveForConsumer must see the explicit mode at
  // the first paint assignment, not after reparenting or the final stamp.
  for (const variable of f.variables) {
    const resolve = variable.resolveForConsumer.bind(variable);
    variable.resolveForConsumer = (node: any) => {
      assert.equal(
        node.explicitVariableModes?.[variable.variableCollectionId],
        f.context.tokens.identity.modes[0].modeId,
      );
      return resolve(node);
    };
  }
  const script = f.emit();
  assert(!script.includes("const slotUtility = retireSlotUtility()"));
  const result = await f.run(script);
  assert.equal(
    result.status,
    "created-candidate",
    JSON.stringify(result.problems),
  );
  assert.equal(result.acceptedContract, null);
  assert.equal(result.nativeQualification, "unqualified");
  assert.equal(result.allocationAttempted, true);
  const page = f.figma.root.children.find((p: any) => p.id === result.pageId);
  assert.equal(page.name, `DS source candidate / ${operation.id}`);
  const set = page.children[0];
  assert.equal(set.id, result.target.id);
  assert.equal(set.type, "COMPONENT_SET");
  assert.equal(set.children.length, 2);
  assert.equal(
    set.getSharedPluginData("ds_contracts", "contractId"),
    `source-native:${operation.id}:${f.source.contract.id}`,
  );
  assert.equal(result.nodes.length, 16); // page + 2*7 source parts + set
  assert.equal(f.modeCalls.length, 15);
  const slotDefs = Object.entries(set.componentPropertyDefinitions).filter(
    ([, d]: any) => d.type === "SLOT",
  );
  assert.equal(slotDefs.length, 3);
  assert(slotDefs.every(([key]) => key.includes("#")));
  assert(
    !Object.values(set.componentPropertyDefinitions).some(
      (d: any) => d.type === "BOOLEAN",
    ),
  );
  for (const main of set.children) {
    const parts = [main, ...main.findAll(() => true)];
    assert.equal(parts.length, 7);
    assert.equal(parts.filter((n: any) => !n.visible).length, 2);
    assert(main.getSharedPluginData("ds_contracts", "canvasFingerprint"));
    for (const node of parts) {
      const part = JSON.parse(
        node.getSharedPluginData("ds_contracts", "nativeSourcePart"),
      );
      assert(
        f.source.projection.parts.some(
          (p) => p.sourceNodeId === part.sourceNodeId,
        ),
      );
      assert.equal(
        JSON.parse(
          node.getSharedPluginData("ds_contracts", "nativeSourceOperation"),
        ).operationId,
        operation.id,
      );
      if (node.type === "SLOT") {
        assert.equal(node.children.length, 0);
        assert(
          slotDefs.some(
            ([key]) => key === node.componentPropertyReferences.slotContentId,
          ),
        );
      }
    }
  }
  assert.deepEqual(
    result.propertyDefinitions,
    clone(set.componentPropertyDefinitions),
  );
});

test("normal compiler and copied ComponentData remain outside the native write door", async () => {
  const f = await fixture(),
    engine = f.source.engine(),
    byId = new Map([[f.source.contract.id, f.source.contract]]);
  const data = engine.compileComponentData(f.source.contract, byId);
  assert.throws(
    () => engine.buildBatchScript([data], operation.fileKey),
    /WRITE_CONTEXT_REQUIRED/,
  );
  assert.throws(
    () => engine.buildBatchScript([clone(data)], operation.fileKey),
    /WRITE_CONTEXT_REQUIRED/,
  );
  assert.throws(() =>
    engine.buildNativeSourceComponentScript(
      clone(data) as any,
      byId,
      f.context,
    ),
  );
  f.source.candidates.clear();
  assert.throws(f.emit, /TRUSTED_CONTEXT_MISSING/);
});

for (const [label, change] of Object.entries({
  "operation ID": (f: any) => {
    f.context.operation = { ...operation, id: "not-an-operation" };
  },
  "other operation scope": (f: any) => {
    f.context.operation = {
      ...operation,
      id: "20000000-0000-4000-8000-000000000001",
    };
  },
  "source revision": (f: any) => {
    f.context.tokens.input.source.revision = "changed";
  },
  "source program": (f: any) => {
    f.context.tokens.input.source.sourceProgramSha256 = "e".repeat(64);
  },
  "token tree": (f: any) => {
    f.context.tokens.input.modes[0].tokens.space.$value = "99px";
  },
  mode: (f: any) => {
    f.context.tokens.input.modes[0].sourceMode = "light";
  },
  "adopted identity": (f: any) => {
    f.context.tokens.identity.origin = "existing";
  },
  "missing independent observation": (f: any) => {
    delete f.context.tokens.receipt;
  },
  "receipt value": (f: any) => {
    f.context.tokens.receipt.variables[0].valuesByMode[
      f.context.tokens.identity.modes[0].modeId
    ] = 99;
  },
  "receipt native key": (f: any) => {
    f.context.tokens.receipt.variables[0].key = "replacement";
  },
}))
  test(`host write context refuses changed ${label}`, async () => {
    const f = await fixture();
    change(f);
    assert.throws(
      f.emit,
      /native-source-write-|native-token-context-|NATIVE_SOURCE_CANDIDATE_/,
    );
    assert.equal(f.figma.root.children.length, 1);
  });

test("compiled bindings must all be in the exact token scope", async () => {
  const f = await fixture(["surface"]);
  assert.throws(f.emit, /token-binding-outside-scope/);
});

for (const [label, change] of Object.entries({
  "missing file key": (f: any) => {
    f.figma.fileKey = null;
  },
  "wrong file key": (f: any) => {
    f.figma.fileKey = "anotherFile";
  },
  "missing API": (f: any) => {
    delete f.figma.setCurrentPageAsync;
  },
  "token value drift": (f: any) => {
    f.variables
      .find((v: any) => v.resolvedType === "FLOAT")
      .setValueForMode(f.context.tokens.identity.modes[0].modeId, 99);
  },
  "token collection rename": (f: any) => {
    f.collections[0].name = "renamed";
  },
  "token ownership drift": (f: any) => {
    f.collections[0].setSharedPluginData(
      "ds_contracts",
      "nativeTokenContext",
      "{}",
    );
  },
  "page name collision": (f: any) => {
    f.figma.currentPage.name = `DS source candidate / ${operation.id}`;
  },
  "renamed page scope collision": (f: any) => {
    f.figma.currentPage.setSharedPluginData(
      "ds_contracts",
      "nativeSourceOperation",
      JSON.stringify({ operationId: operation.id }),
    );
  },
  "stranded child scope collision": (f: any) => {
    const n = f.figma.createFrame();
    f.figma.currentPage.appendChild(n);
    n.setSharedPluginData(
      "ds_contracts",
      "nativeSourceOperation",
      JSON.stringify({ operationId: operation.id }),
    );
  },
  "malformed existing ownership": (f: any) => {
    f.figma.currentPage.setSharedPluginData(
      "ds_contracts",
      "nativeSourceOperation",
      "{broken",
    );
  },
}))
  test(`native preflight refuses ${label} before any allocation`, async () => {
    const f = await fixture(),
      script = f.emit();
    change(f);
    const result = await f.run(script);
    assert.equal(result.status, "refused", JSON.stringify(result));
    assert.equal(result.allocationAttempted, false);
    assert.equal(result.pageId, null);
    assert.deepEqual(result.nodes, []);
    assert.equal(f.figma.root.children.length, 1);
  });

test("same-name foreign components and legacy Slot utility remain untouched; repeats refuse", async () => {
  const f = await fixture(),
    original = f.figma.currentPage;
  const foreign = f.figma.createComponent();
  foreign.name = f.source.contract.name;
  foreign.setSharedPluginData(
    "ds_contracts",
    "contractId",
    f.source.contract.id,
  );
  original.appendChild(foreign);
  const slot = f.figma.createComponent();
  slot.name = "Slot";
  original.appendChild(slot);
  const script = f.emit(),
    result = await f.run(script);
  assert.equal(
    result.status,
    "created-candidate",
    JSON.stringify(result.problems),
  );
  assert.deepEqual(original.children, [foreign, slot]);
  assert.equal(
    foreign.getSharedPluginData("ds_contracts", "contractId"),
    f.source.contract.id,
  );
  assert.equal(slot.removed, false);
  const ids = f.figma.root.children.map((p: any) => p.id);
  const repeated = await f.run(script);
  assert.equal(repeated.status, "refused");
  assert.equal(repeated.allocationAttempted, false);
  assert.deepEqual(
    f.figma.root.children.map((p: any) => p.id),
    ids,
  );
});

test("known allocation IDs survive metadata failure", async () => {
  const f = await fixture(),
    create = f.figma.createComponent;
  f.figma.createComponent = () => {
    const node = create();
    node.setSharedPluginData = () => {
      throw Error("metadata failed");
    };
    return node;
  };
  const result = await f.run(f.emit());
  assert.equal(result.status, "partial-or-unknown-allocation");
  assert(result.pageId);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[1].type, "COMPONENT");
  assert(result.nodes[1].id);
});

test("API allocation followed by throw retains unknown outcome and cannot look retryable", async () => {
  const f = await fixture(),
    create = f.figma.createPage;
  f.figma.createPage = () => {
    create();
    throw Error("allocated without returned identity");
  };
  const result = await f.run(f.emit());
  assert.equal(result.status, "partial-or-unknown-allocation");
  assert.equal(result.allocationAttempted, true);
  assert.equal(result.pageId, null);
  assert.deepEqual(result.nodes, []);
  assert.equal(f.figma.root.children.length, 2);
});

test("allocated node ID survives a failing key getter", async () => {
  const f = await fixture(),
    create = f.figma.createComponent;
  f.figma.createComponent = () => {
    const node = create();
    Object.defineProperty(node, "key", {
      get() {
        throw Error("key unavailable");
      },
    });
    return node;
  };
  const result = await f.run(f.emit());
  assert.equal(result.status, "partial-or-unknown-allocation");
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[1].type, "COMPONENT");
  assert(result.nodes[1].id);
});

test("colliding foreign variable names cannot replace exact operation bindings", async () => {
  const f = await fixture();
  const foreign = f.figma.variables.createVariableCollection("foreign");
  const variable = f.figma.variables.createVariable(
    "surface",
    foreign,
    "COLOR",
  );
  variable.setValueForMode(foreign.modes[0].modeId, { r: 1, g: 0, b: 0, a: 1 });
  const result = await f.run(f.emit());
  assert.equal(result.status, "created-candidate");
  const set = f.figma.root.children.find((p: any) => p.id === result.pageId)
    .children[0];
  const expectedId = f.context.tokens.identity.variables.find(
    (v) => v.tokenPath === "surface",
  )!.id;
  for (const main of set.children) {
    assert.equal(main.fills[0].boundVariables.color.id, expectedId);
    assert.notEqual(main.fills[0].boundVariables.color.id, variable.id);
  }
});

test("token drift during allocation cannot return a successful creation candidate", async () => {
  const f = await fixture(),
    create = f.figma.createComponent;
  f.figma.createComponent = () => {
    f.variables
      .find((v) => v.resolvedType === "FLOAT")
      .setValueForMode(f.context.tokens.identity.modes[0].modeId, 99);
    return create();
  };
  const result = await f.run(f.emit());
  assert.equal(result.status, "partial-or-unknown-allocation");
  assert(result.target.id);
  assert.deepEqual(result.problems, ["native-source-write-tokens-changed"]);
});
