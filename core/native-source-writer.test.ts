import assert from "node:assert/strict";
import test from "node:test";
import { revisionOf } from "./contract-provenance.js";
import {
  operation,
  clone,
  fixture,
  comparisonFixture,
} from "./native-source-writer-test-fixture.js";

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

test("comparison instances use observed variants, full SLOT IDs, source topology, measured text frames and font spelling", async () => {
  const f = await comparisonFixture();
  const fonts: Array<{
    family: string;
    style: string;
    beforeAllocation: boolean;
  }> = [];
  f.figma.loadFontAsync = async (font: { family: string; style: string }) => {
    fonts.push({
      ...font,
      beforeAllocation: f.figma.root.children.length === 1,
    });
    if (font.family === "IBM Plex Sans" && font.style === "Semi Bold")
      throw Error("use SemiBold");
  };
  const sourceBefore = JSON.stringify(f.context);
  const result = await f.run(f.emit());
  assert.equal(
    result.status,
    "created-candidate",
    JSON.stringify(result.problems),
  );
  assert.equal(JSON.stringify(f.context), sourceBefore);
  assert.equal(result.comparisons.length, 3);
  assert.equal(
    result.comparisons.filter((c: any) => c.status === "created-comparison")
      .length,
    2,
  );
  assert.equal(result.comparisons[2].status, "refused");
  const page = f.figma.root.children.find((p: any) => p.id === result.pageId);
  const set = page.children.find((n: any) => n.id === result.target.id);
  const board = page.children.find(
    (n: any) => n.id === result.comparisonBoardId,
  );
  assert.equal(board.children.length, 2);
  assert.equal(set.findAll((n: any) => n.type === "SLOT").length, 6);
  assert(
    set
      .findAll((n: any) => n.type === "SLOT")
      .every((n: any) => n.children.length === 0),
  );
  for (const [i, inst] of board.children.entries()) {
    assert.equal(
      (await inst.getMainComponentAsync()).name,
      i === 0 ? "Variant=(unset)" : "Variant=secondary",
    );
    assert.equal(result.comparisons[i].sourceParts.length, 7);
    for (const recorded of result.comparisons[i].slots) {
      const slot = inst.findOne((n: any) => n.id === recorded.nodeId);
      assert.equal(
        slot.componentPropertyReferences.slotContentId,
        recorded.propertyKey,
      );
      assert(recorded.propertyKey.includes("#"));
      assert.deepEqual(
        slot.children.map((n: any) => n.id),
        recorded.contentNodeIds,
      );
    }
    const text = inst.findOne((n: any) => n.type === "TEXT");
    assert.equal(text.characters, "Label");
    assert.deepEqual(clone(text.fontName), {
      family: "IBM Plex Sans",
      style: "SemiBold",
    });
    assert.equal(text.parent.width, 40.5625);
    assert.equal(text.parent.height, 24);
    assert.equal(text.parent.primaryAxisAlignItems, "CENTER");
    assert.equal(text.textAlignHorizontal, "CENTER");
    assert.equal(text.lineHeight.value, 24);
    assert.equal(
      JSON.parse(text.getSharedPluginData("ds_contracts", "nativeSourceSample"))
        .caseId,
      f.samples.cases[i].id,
    );
    const wrappers = inst.findAll((n: any) => {
      const raw = n.getSharedPluginData("ds_contracts", "nativeSourcePart");
      return raw && JSON.parse(raw).emptyMainVisible === false;
    });
    assert(wrappers.every((n: any) => n.visible === (i === 1)));
  }
  assert(
    fonts.some(
      (font) =>
        font.family === "Inter" &&
        font.style === "Semi Bold" &&
        font.beforeAllocation,
    ),
  );
  assert(
    fonts.some(
      (font) =>
        font.family === "IBM Plex Sans" &&
        font.style === "SemiBold" &&
        font.beforeAllocation,
    ),
  );
  assert.deepEqual(
    result.applied.results.flatMap((r: any) => r.degradations ?? []),
    [],
  );
});

for (const [name, change] of Object.entries({
  "missing source font": (f: any) => {
    f.figma.loadFontAsync = async (font: any) => {
      if (font.family === "IBM Plex Sans") throw Error("missing");
    };
  },
  "missing initial Inter face": (f: any) => {
    f.figma.loadFontAsync = async (font: any) => {
      if (font.family === "Inter" && font.style === "Semi Bold")
        throw Error("missing");
    };
  },
  "missing SVG API": (f: any) => {
    delete f.figma.createNodeFromSvg;
  },
  "missing text API": (f: any) => {
    delete f.figma.createText;
  },
}))
  test(`comparison preflight refuses ${name} before allocation`, async () => {
    const f = await comparisonFixture();
    change(f);
    const result = await f.run(f.emit());
    assert.equal(result.status, "refused");
    assert.equal(result.allocationAttempted, false);
    assert.equal(f.figma.root.children.length, 1);
  });

for (const [name, change] of Object.entries({
  "changed pinned content": (f: any) => {
    f.samples.cases[0].slots[0].specs[0].children[0].characters = "Changed";
  },
  "dropped case": (f: any) => {
    f.samples.cases.pop();
    f.repin();
  },
  "changed source tree": (f: any) => {
    f.samples.cases[0].sourceTreeSha256 = "f".repeat(64);
    f.repin();
  },
  "wrong source slot": (f: any) => {
    f.samples.cases[0].slots[0].sourceName = "missing";
    f.repin();
  },
  "duplicate slot": (f: any) => {
    f.samples.cases[0].slots.push(clone(f.samples.cases[0].slots[0]));
    f.repin();
  },
  "refused case promoted": (f: any) => {
    f.samples.cases[2].status = "lowered";
    f.repin();
  },
  "new sample binding": (f: any) => {
    const slot = f.samples.cases[0].slots[0];
    slot.specs[0].fill = "surface";
    slot.specRevision = revisionOf(slot.specs);
    f.repin();
  },
  "nested component reference": (f: any) => {
    const slot = f.samples.cases[0].slots[0];
    slot.specs[0].type = "instance";
    slot.specRevision = revisionOf(slot.specs);
    f.repin();
  },
}))
  test(`comparison context refuses ${name}`, async () => {
    const f = await comparisonFixture();
    change(f);
    assert.throws(f.emit, /native-source-comparisons-/);
    assert.equal(f.figma.root.children.length, 1);
  });

test("comparison failure retains instance/source identities and never alters main slots", async () => {
  const f = await comparisonFixture();
  f.figma.createText = () => {
    throw Error("text allocation failed");
  };
  const result = await f.run(f.emit());
  assert.equal(result.status, "partial-or-unknown-allocation");
  assert(result.comparisons[0].instanceId);
  assert.equal(result.comparisons[0].sourceParts.length, 7);
  const page = f.figma.root.children.find((p: any) => p.id === result.pageId);
  const set = page.children.find((n: any) => n.id === result.target.id);
  assert(
    set
      .findAll((n: any) => n.type === "SLOT")
      .every((n: any) => n.children.length === 0),
  );
});
