import assert from "node:assert/strict";
import test from "node:test";
import { revisionOf } from "./contract-provenance.js";
import {
  comparisonFixture,
  clone,
} from "./native-source-writer-test-fixture.js";
import {
  emitNativeSourceReadbackScript,
  verifyNativeSourceReadback,
  scaledOrigin,
  type NativeSourceObservationInput,
} from "./native-source-observation.js";

async function observedFixture() {
  const f = await comparisonFixture();
  const creation = await f.run(f.emit());
  assert.equal(creation.status, "created-candidate");
  const input: NativeSourceObservationInput = {
    operation: f.context.operation,
    planRevision: revisionOf({ fixture: true }),
    component: f.source.compile(),
    projection: f.source.projection,
    samples: f.samples,
    tokenInput: f.context.tokens.input,
    tokenIdentity: f.context.tokens.identity,
    creation,
  };
  const read = () => f.run(emitNativeSourceReadbackScript(input));
  return { ...f, creation, input, read };
}

test("independent readback observes saved IDs and supported source structure without qualification", async () => {
  const f = await observedFixture();
  const receipt = await f.read();
  assert.equal(
    receipt.status,
    "native-readback-collected",
    JSON.stringify(receipt),
  );
  const result = verifyNativeSourceReadback(f.input, receipt);
  assert.equal(
    result.status,
    "supported-structure-observed",
    JSON.stringify(result),
  );
  assert.equal(result.acceptedContract, null);
  assert.equal(result.nativeQualification, "unqualified");
});

const mutations: Array<[string, (r: any) => void, string]> = [
  [
    "replaced node",
    (r) => {
      r.nodes[1].id = "foreign";
    },
    "node-inventory",
  ],
  [
    "duplicate node",
    (r) => {
      r.nodes.push(clone(r.nodes[1]));
    },
    "node-inventory",
  ],
  [
    "foreign owner",
    (r) => {
      r.nodes[1].metadata.nativeSourceOperation = "{}";
    },
    "ownership",
  ],
  [
    "node type",
    (r) => {
      r.nodes.find((n: any) => n.type === "SLOT").type = "FRAME";
    },
    "node-identity",
  ],
  [
    "parent moved",
    (r) => {
      r.nodes.find((n: any) => n.type === "SLOT").parentId = "outside";
    },
    "parent",
  ],
  [
    "extra child",
    (r) => {
      r.nodes.find((n: any) => n.type === "SLOT").childIds.push("outside");
    },
    "children",
  ],
  [
    "detached binding",
    (r) => {
      delete r.nodes.find((n: any) => n.values.boundVariables?.itemSpacing)
        .values.boundVariables.itemSpacing;
    },
    "binding-fields",
  ],
  [
    "same-name foreign variable",
    (r) => {
      r.nodes.find(
        (n: any) => n.values.boundVariables?.itemSpacing,
      ).values.boundVariables.itemSpacing.id = "foreign";
    },
    "binding-itemSpacing",
  ],
  [
    "array binding",
    (r) => {
      r.nodes.find(
        (n: any) => n.type === "COMPONENT",
      ).values.boundVariables.characters = [];
    },
    "extra-bindings",
  ],
  [
    "paint alias",
    (r) => {
      r.nodes.find(
        (n: any) => n.type === "COMPONENT",
      ).values.fills[0].boundVariables.color.id = "foreign";
    },
    "fill-binding",
  ],
  [
    "hidden paint",
    (r) => {
      r.nodes.find((n: any) => n.type === "COMPONENT").values.fills[0].visible =
        false;
    },
    "fill-binding",
  ],
  [
    "mode",
    (r) => {
      r.nodes.find((n: any) => n.type === "SLOT").values.explicitVariableModes =
        {};
    },
    "mode",
  ],
  [
    "slot key",
    (r) => {
      r.nodes.find(
        (n: any) => n.type === "SLOT",
      ).values.componentPropertyReferences.slotContentId = "Before";
    },
    "slot-key",
  ],
  [
    "wrapper visibility",
    (r) => {
      r.nodes.find((n: any) => n.values.visible === false).values.visible =
        true;
    },
    "visibility",
  ],
  [
    "source part",
    (r) => {
      r.nodes.find((n: any) => n.type === "SLOT").metadata.nativeSourcePart =
        "{}";
    },
    "source-part",
  ],
  [
    "case main",
    (r) => {
      r.nodes.find((n: any) => n.type === "INSTANCE").mainId = "foreign";
    },
    "case-main",
  ],
  [
    "case metadata",
    (r) => {
      r.nodes.find(
        (n: any) => n.type === "INSTANCE",
      ).metadata.nativeSourceCase = "{}";
    },
    "case-identity",
  ],
  [
    "font family",
    (r) => {
      r.nodes.find((n: any) => n.type === "TEXT").values.fontName.family =
        "Inter";
    },
    "text",
  ],
  [
    "text content",
    (r) => {
      r.nodes.find((n: any) => n.type === "TEXT").values.characters = "Other";
    },
    "text",
  ],
  [
    "text decoration",
    (r) => {
      r.nodes.find((n: any) => n.type === "TEXT").values.textDecoration =
        "UNDERLINE";
    },
    "text-decoration",
  ],
  [
    "sample identity",
    (r) => {
      r.nodes.find((n: any) => n.type === "TEXT").metadata.nativeSourceSample =
        "{}";
    },
    "sample-identity",
  ],
  [
    "variant default",
    (r) => {
      r.nodes.find(
        (n: any) => n.type === "COMPONENT_SET",
      ).definitions.Variant.defaultValue = "secondary";
    },
    "variant-axis",
  ],
  [
    "variant properties",
    (r) => {
      r.nodes.find((n: any) => n.type === "COMPONENT").variantProperties = {};
    },
    "variant-properties",
  ],
  [
    "clipping",
    (r) => {
      r.nodes.find((n: any) => n.type === "COMPONENT").values.clipsContent =
        true;
    },
    "clipping",
  ],
  [
    "token values",
    (r) => {
      r.tokens.receipt.variables = [];
    },
    "token-drift",
  ],
  [
    "malformed token values",
    (r) => {
      r.tokens.receipt.variables = "bad";
    },
    "token-drift",
  ],
  [
    "malformed node",
    (r) => {
      r.nodes[0] = null;
    },
    "node-inventory",
  ],
  [
    "malformed paint",
    (r) => {
      r.nodes.find((n: any) => n.type === "COMPONENT").values.fills = [null];
    },
    "malformed",
  ],
];
for (const [name, mutate, code] of mutations)
  test(`readback refuses ${name}`, async () => {
    const f = await observedFixture(),
      receipt = await f.read();
    mutate(receipt);
    const result = verifyNativeSourceReadback(f.input, receipt);
    assert.equal(result.status, "refused");
    assert(
      result.problems.some((p) => p.includes(code)),
      JSON.stringify(result),
    );
  });

test("reader measures live mutation even when writer metadata and fingerprint remain unchanged", async () => {
  const f = await observedFixture();
  const page = await f.figma.getNodeByIdAsync(f.creation.pageId);
  const text = page.findOne((n: any) => n.type === "TEXT");
  text.characters = "Changed after creation";
  assert(
    verifyNativeSourceReadback(f.input, await f.read()).problems.some((p) =>
      p.includes("-text:"),
    ),
  );
});

test("reader is read only and repeat observation remains identical", async () => {
  const f = await observedFixture();
  const page = f.figma.currentPage,
    selection = page.selection;
  for (const name of [
    "createPage",
    "createComponent",
    "createFrame",
    "createText",
    "createSlot",
    "createNodeFromSvg",
  ])
    f.figma[name] = () => {
      throw Error("reader attempted mutation");
    };
  const a = await f.read(),
    b = await f.read();
  assert.equal(a.status, "native-readback-collected");
  assert.deepEqual(a, b);
  assert.equal(f.figma.currentPage, page);
  assert.equal(page.selection, selection);
});

test("reader refuses changes during an async observation", async () => {
  const f = await observedFixture(),
    page = await f.figma.getNodeByIdAsync(f.creation.pageId);
  const inst = page.findOne((n: any) => n.type === "INSTANCE");
  const get = inst.getMainComponentAsync.bind(inst);
  let calls = 0;
  inst.getMainComponentAsync = async () => {
    if (++calls === 1) inst.name = "changed during read";
    return get();
  };
  const result = await f.read();
  assert.equal(result.status, "refused");
  assert.deepEqual(result.problems, [
    "native-source-readback-changed-during-observation",
  ]);
});

test("reader refuses file switches and unavailable image export", async () => {
  const f = await observedFixture();
  f.figma.base64Encode = undefined;
  const exported = await f.run(emitNativeSourceReadbackScript(f.input, true));
  assert.equal(exported.status, "refused");
  assert.deepEqual(exported.problems, [
    "native-source-readback-export-unavailable",
  ]);
  f.figma.fileKey = "other";
  assert.deepEqual((await f.read()).problems, [
    "native-source-readback-file-mismatch",
  ]);
});

test("mock instances retain isolated binding and paint objects from their mains", async () => {
  const f = await observedFixture(),
    page = await f.figma.getNodeByIdAsync(f.creation.pageId);
  const inst = page.findOne((n: any) => n.type === "INSTANCE"),
    main = await inst.getMainComponentAsync();
  assert.deepEqual(inst.boundVariables, main.boundVariables);
  inst.boundVariables.itemSpacing.id = "changed";
  inst.fills[0].boundVariables.color.id = "changed";
  assert.notEqual(main.boundVariables.itemSpacing.id, "changed");
  assert.notEqual(main.fills[0].boundVariables.color.id, "changed");
});

function settledSlotReceipt(input: NativeSourceObservationInput, receipt: any) {
  const out = clone(receipt);
  const aliases = new Map<string, string>();
  for (const [i, n] of input.creation.nodes.entries()) {
    if (n.slotIdentity)
      aliases.set(n.id, `${n.slotIdentity.slotId};settled:${i}`);
  }
  assert(
    aliases.size > 0,
    "fixture must contain actual allocated slot content",
  );
  for (const n of out.nodes) {
    n.id = aliases.get(n.id) ?? n.id;
    n.parentId = aliases.get(n.parentId) ?? n.parentId;
    n.childIds = n.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  return out;
}

test("settled slot IDs retain allocation identity without relaxing roots or supported properties", async () => {
  const f = await observedFixture();
  const first = await f.read();
  const settled = settledSlotReceipt(f.input, first);
  assert.equal(
    verifyNativeSourceReadback(f.input, settled).status,
    "supported-structure-observed",
  );
  const cases: Array<[string, (r: any) => void]> = [
    [
      "missing allocation stamp",
      (r) => {
        delete r.nodes.find((n: any) => n.id.includes(";settled:")).metadata
          .nativeSourceAllocation;
      },
    ],
    [
      "unknown replacement ID",
      (r) => {
        r.nodes.find((n: any) => n.id.includes(";settled:")).id = "unrelated";
      },
    ],
    [
      "copied allocation identity",
      (r) => {
        const ns = r.nodes.filter((n: any) => n.id.includes(";settled:"));
        ns[1].metadata.nativeSourceAllocation =
          ns[0].metadata.nativeSourceAllocation;
      },
    ],
    [
      "replaced root",
      (r) => {
        r.nodes.find((n: any) => n.type === "COMPONENT_SET").id =
          "foreign-root";
      },
    ],
    [
      "extra slot descendant",
      (r) => {
        const n = clone(r.nodes.find((n: any) => n.id.includes(";settled:")));
        n.id += "-extra";
        r.nodes.push(n);
      },
    ],
    [
      "changed text",
      (r) => {
        r.nodes.find(
          (n: any) => n.type === "TEXT" && n.id.includes(";settled:"),
        ).values.characters = "Changed";
      },
    ],
    [
      "foreign owner",
      (r) => {
        r.nodes.find((n: any) =>
          n.id.includes(";settled:"),
        ).metadata.nativeSourceOperation = "{}";
      },
    ],
    [
      "wrong slot",
      (r) => {
        const n = r.nodes.find((n: any) => n.id.includes(";settled:"));
        n.parentId = f.creation.pageId;
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    const changed = clone(settled);
    mutate(changed);
    assert.equal(
      verifyNativeSourceReadback(f.input, changed).status,
      "refused",
      name,
    );
  }
});

test("legacy slot identity requires a separately verified exact-ID anchor", async () => {
  const f = await observedFixture();
  const first = await f.read();
  const settled = settledSlotReceipt(f.input, first);
  const input = clone(f.input);
  for (const n of input.creation.nodes) delete n.slotIdentity;
  for (const r of [first, settled])
    for (const n of r.nodes) delete n.metadata.nativeSourceAllocation;
  assert.equal(verifyNativeSourceReadback(input, settled).status, "refused");
  input.allocationAnchor = first;
  assert.equal(
    verifyNativeSourceReadback(input, settled).status,
    "supported-structure-observed",
  );
  input.allocationAnchor = settled;
  assert.equal(
    verifyNativeSourceReadback(input, settled).status,
    "refused",
    "latest receipt cannot authorize its own new IDs",
  );
  input.allocationAnchor = clone(first);
  input.allocationAnchor!.nodes!.find(
    (n: any) => n.type === "TEXT",
  )!.values.characters = "false anchor";
  assert.equal(verifyNativeSourceReadback(input, settled).status, "refused");
  input.allocationAnchor = first;
  const changed = clone(settled);
  changed.nodes.find(
    (n: any) => n.type === "TEXT" && n.id.includes(";settled:"),
  ).values.characters = "Changed";
  assert.equal(
    verifyNativeSourceReadback(input, changed).status,
    "refused",
    "anchor supplies identity, never current semantics",
  );
});

test("an inherited SCALE origin may keep only the source's own float32-invisible offset", () => {
  // Live CBDS Checkbox warning glyph (op 46e5f671): half-scale instance, parent
  // frame at x=1.124997854…, Figma kept the main's 3.0959e-8 instead of halving it.
  const source = 3.0959117935935865e-8, parent = 1.124997854232788;
  assert.equal(scaledOrigin(source * 0.5, source, 0.5, parent), true, "the exact scaled value passes");
  assert.equal(scaledOrigin(source, source, 0.5, parent), true, "the verbatim source offset passes when float32-identical in the parent");
  assert.equal(scaledOrigin(0.125, source, 0.5, parent), false, "a real drift refuses");
  assert.equal(scaledOrigin(5e-8, source, 0.5, parent), false, "a retained offset that is not the source value refuses");
  assert.equal(scaledOrigin(source, source, 0.5, 0), false, "at a zero parent offset the difference is representable and refuses");
  assert.equal(scaledOrigin(source, source, 0.5, undefined), false, "without an observed parent offset it refuses");
  assert.equal(scaledOrigin(2, 2, 0.5, 100), false, "a representable retained origin still refuses");
});
