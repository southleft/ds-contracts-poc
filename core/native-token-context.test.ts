import assert from "node:assert/strict";
import test from "node:test";
import { revisionOf } from "./contract-provenance.js";
import { compileTokenSetRows } from "./token-set.js";
import {
  nativeTokenCollectionName,
  prepareNativeTokenContext,
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
  type NativeTokenContextReceipt,
  type NativeTokenIdentity,
  type NativeTokenValue,
} from "./native-token-context.js";

const copy = <T>(value: T): T => structuredClone(value);
const tree = {
  palette: {
    $type: "color",
    base: { $value: "#12345680" },
    // Equal values grant no identity substitution.
    twin: { $value: "#12345680" },
  },
  action: {
    $type: "color",
    background: { $value: "{palette.base}" },
  },
  gap: { $type: "dimension", $value: "0.5rem" },
  weight: { $type: "number", $value: 600 },
};
function input(): NativeTokenContextInput {
  return {
    fileKey: "scratch-key",
    scopeId: "candidate-123",
    source: {
      revision: "source-commit",
      sourceProgramSha256: "a".repeat(64),
      tokensSha256: "b".repeat(64),
    },
    tokenPaths: ["action.background", "palette.twin", "gap", "weight"],
    modes: [
      {
        sourceMode: "dark",
        brand: "default",
        nativeModeName: "Dark",
        tokens: copy(tree),
        tokenTreeRevision: revisionOf(tree),
      },
    ],
  };
}
const rgba = { r: 0x12 / 255, g: 0x34 / 255, b: 0x56 / 255, a: 0x80 / 255 };
/** An independent readback fixture: values are explicit, not copied from plan. */
function fixture() {
  const request = input(),
    preparation = prepareNativeTokenContext(request);
  const expectedIdentity: NativeTokenIdentity = {
    origin: "created",
    preparationRevision: preparation.revision,
    fileKey: "scratch-key",
    collection: {
      id: "collection:7",
      key: "collection-key",
      name: "DS candidate tokens / candidate-123",
    },
    modes: [
      { sourceMode: "dark", brand: "default", modeId: "7:0", name: "Dark" },
    ],
    variables: [
      { tokenPath: "palette.base", id: "variable:base", key: "key-base" },
      { tokenPath: "palette.twin", id: "variable:twin", key: "key-twin" },
      { tokenPath: "action.background", id: "variable:bg", key: "key-bg" },
      { tokenPath: "gap", id: "variable:gap", key: "key-gap" },
      { tokenPath: "weight", id: "variable:weight", key: "key-weight" },
    ],
  };
  const values: Record<string, NativeTokenValue> = {
    "palette.base": rgba,
    "palette.twin": rgba,
    "action.background": { type: "VARIABLE_ALIAS", id: "variable:base" },
    gap: 8,
    weight: 600,
  };
  const receipt: NativeTokenContextReceipt = {
    fileKey: "scratch-key",
    collection: {
      ...expectedIdentity.collection,
      remote: false,
      ownership: {
        scopeId: "candidate-123",
        preparationRevision: preparation.revision,
        source: copy(request.source),
      },
      defaultModeId: "7:0",
      modes: [{ modeId: "7:0", name: "Dark" }],
    },
    variables: expectedIdentity.variables.map((v) => ({
      id: v.id,
      key: v.key,
      name: v.tokenPath.replaceAll(".", "/"),
      variableCollectionId: "collection:7",
      resolvedType: ["gap", "weight"].includes(v.tokenPath) ? "FLOAT" : "COLOR",
      remote: false,
      valuesByMode: { "7:0": copy(values[v.tokenPath]) },
    })),
  };
  return { input: request, expectedIdentity, receipt };
}
function revise(request: NativeTokenContextInput) {
  for (const mode of request.modes)
    mode.tokenTreeRevision = revisionOf(mode.tokens);
  return request;
}

test("preparation preserves exact names and aliases through the existing compiler, with dark-only mapping", () => {
  const request = input(),
    original = copy(request),
    prep = prepareNativeTokenContext(request);
  assert.deepEqual(request, original);
  assert.equal(prep.acceptedContract, null);
  assert.equal(prep.nativeQualification, "unqualified");
  assert.equal(prep.collectionName, nativeTokenCollectionName(request.scopeId));
  assert.deepEqual(prep.dependencyTokenPaths, ["palette.base"]);
  assert.deepEqual(
    prep.modes.map((m) => [m.sourceMode, m.brand, m.nativeModeName]),
    [["dark", "default", "Dark"]],
  );
  assert.deepEqual(
    prep.variables.find((v) => v.tokenPath === "action.background"),
    {
      tokenPath: "action.background",
      name: "action/background",
      resolvedType: "COLOR",
      values: [
        {
          sourceMode: "dark",
          brand: "default",
          value: {
            type: "TOKEN_ALIAS",
            targetPath: "palette.base",
            targetName: "palette/base",
          },
        },
      ],
    },
  );
  const rows = compileTokenSetRows({
    name: prep.collectionName,
    base: {
      "palette.base": { $type: "color", $value: "#12345680" },
      "palette.twin": { $type: "color", $value: "#12345680" },
      gap: tree.gap,
      weight: tree.weight,
    },
    minted: {
      "action/background": { $type: "color", $value: "{palette.base}" },
    },
  }).rows;
  assert.deepEqual(
    [...prep.modes[0].rows].sort((a, b) => a.name.localeCompare(b.name)),
    rows.sort((a, b) => a.name.localeCompare(b.name)),
  );
  const { revision, ...body } = prep;
  assert.equal(revision, revisionOf(body));
  request.tokenPaths.reverse();
  assert.equal(prepareNativeTokenContext(request).revision, revision);
});

test("exact creation identity verifies, and a pinned existing identity reopens without promotion", () => {
  const args = fixture();
  for (const origin of ["created", "existing"] as const) {
    args.expectedIdentity.origin = origin;
    const result = verifyNativeTokenContextReceipt(args);
    assert.equal(result.status, "native-token-context-observed");
    assert.equal(result.acceptedContract, null);
    assert.equal(result.nativeQualification, "unqualified");
    assert.deepEqual(result.identity, args.expectedIdentity);
    assert.deepEqual(result.problems, []);
  }
});

test("aliases retain their graph identity, including dependency-before-consumer order", () => {
  const request = input();
  request.modes[0].tokens = {
    ...request.modes[0].tokens,
    second: { $type: "color", $value: "{action.background}" },
  };
  request.tokenPaths = ["second"];
  const prep = prepareNativeTokenContext(revise(request));
  assert.deepEqual(
    prep.modes[0].rows.map((r) => r.name),
    ["palette/base", "action/background", "second"],
  );
  assert.deepEqual(prep.dependencyTokenPaths, [
    "action.background",
    "palette.base",
  ]);
  assert.equal(
    prep.variables.some((v) => v.tokenPath === "palette.twin"),
    false,
  );
});

test("different explicit mode values and native IDs are preserved, with no base fallback", () => {
  const args = fixture();
  const lightTree = copy(tree);
  lightTree.gap.$value = "1rem";
  args.input.modes.push({
    sourceMode: "light",
    brand: "default",
    nativeModeName: "Light",
    tokens: lightTree,
    tokenTreeRevision: revisionOf(lightTree),
  });
  const prep = prepareNativeTokenContext(args.input);
  args.expectedIdentity.preparationRevision = prep.revision;
  args.expectedIdentity.modes.push({
    sourceMode: "light",
    brand: "default",
    modeId: "7:1",
    name: "Light",
  });
  args.receipt.collection.ownership.preparationRevision = prep.revision;
  args.receipt.collection.modes.push({ modeId: "7:1", name: "Light" });
  for (const v of args.receipt.variables)
    v.valuesByMode["7:1"] = v.name === "gap" ? 16 : copy(v.valuesByMode["7:0"]);
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  args.receipt.variables.find((v) => v.name === "gap")!.valuesByMode["7:1"] = 8;
  assert.deepEqual(verifyNativeTokenContextReceipt(args).problems, [
    "native-token-context-variable-value",
  ]);
});

const badInputs: [string, (value: NativeTokenContextInput) => void, string][] =
  [
    [
      "missing target file",
      (v) => {
        v.fileKey = "";
      },
      "file-key",
    ],
    [
      "unscoped historical collection name",
      (v) => {
        v.scopeId = "Altitude";
      },
      "scope-id",
    ],
    [
      "missing source token pin",
      (v) => {
        v.source.tokensSha256 = "";
      },
      "source-identity",
    ],
    [
      "changed token tree bytes",
      (v) => {
        v.modes[0].tokens.gap = { $type: "dimension", $value: "16px" };
      },
      "token-tree-revision",
    ],
    [
      "duplicate request paths",
      (v) => {
        v.tokenPaths.push(v.tokenPaths[0]);
      },
      "token-path-ambiguous",
    ],
    [
      "dots normalize to a duplicate variable name",
      (v) => {
        v.modes[0].tokens["palette.base"] = {
          $type: "color",
          $value: "#ffffff",
        };
        revise(v);
      },
      "token-path-ambiguous",
    ],
    [
      "slash spelling cannot shadow dot identity",
      (v) => {
        v.modes[0].tokens["palette/base"] = {
          $type: "color",
          $value: "#ffffff",
        };
        revise(v);
      },
      "token-path",
    ],
    [
      "alias target missing",
      (v) => {
        v.modes[0].tokens.action = {
          background: { $type: "color", $value: "{absent}" },
        };
        revise(v);
      },
      "token-missing",
    ],
    [
      "alias cycle",
      (v) => {
        v.modes[0].tokens.palette = {
          base: { $type: "color", $value: "{action.background}" },
          twin: { $type: "color", $value: "#12345680" },
        };
        revise(v);
      },
      "alias-cycle",
    ],
    [
      "alias type mismatch",
      (v) => {
        v.modes[0].tokens.action = {
          background: { $type: "number", $value: "{palette.base}" },
        };
        revise(v);
      },
      "alias-type-mismatch",
    ],
    [
      "unparsed color cannot become STRING",
      (v) => {
        v.modes[0].tokens.palette = {
          base: { $type: "color", $value: "nonsense" },
          twin: { $type: "color", $value: "#12345680" },
        };
        revise(v);
      },
      "token-compilation-refused",
    ],
    [
      "composite token",
      (v) => {
        v.modes[0].tokens.gap = {
          $type: "dimension",
          $value: { value: 8, unit: "px" },
        };
        revise(v);
      },
      "token-compilation-refused",
    ],
    [
      "nonfinite compiled number",
      (v) => {
        v.modes[0].tokens.weight = { $type: "number", $value: "." };
        revise(v);
      },
      "compiled-value-unsupported",
    ],
    [
      "nonfinite color cannot hash as null",
      (v) => {
        v.modes[0].tokens.palette = {
          base: { $type: "color", $value: "rgb(1e999,0,0)" },
          twin: { $type: "color", $value: "#12345680" },
        };
        revise(v);
      },
      "compiled-value-unsupported",
    ],
    [
      "no inferred mode",
      (v) => {
        v.modes = [];
      },
      "modes-missing",
    ],
    [
      "two source modes cannot use one native name",
      (v) => {
        v.modes.push({ ...copy(v.modes[0]), sourceMode: "light" });
      },
      "mode-name-ambiguous",
    ],
    [
      "source mode cannot be duplicated under another native name",
      (v) => {
        v.modes.push({ ...copy(v.modes[0]), nativeModeName: "Duplicate" });
      },
      "source-mode-ambiguous",
    ],
    [
      "missing secondary mode token",
      (v) => {
        v.modes.push({
          ...copy(v.modes[0]),
          sourceMode: "light",
          nativeModeName: "Light",
          tokens: {},
        });
        revise(v);
      },
      "token-missing",
    ],
    [
      "mode type disagreement",
      (v) => {
        const mode = {
          ...copy(v.modes[0]),
          sourceMode: "light",
          nativeModeName: "Light",
        };
        mode.tokens.weight = { $type: "string", $value: "heavy" };
        v.modes.push(mode);
        revise(v);
      },
      "mode-type-mismatch",
    ],
  ];
for (const [label, mutate, code] of badInputs)
  test(`preparation refuses ${label}`, () => {
    const request = input();
    mutate(request);
    assert.throws(() => prepareNativeTokenContext(request), {
      message: `native-token-context-${code}`,
    });
  });

type Fixture = ReturnType<typeof fixture>;
const badReceipts: [string, (args: Fixture) => void, string][] = [
  [
    "wrong file",
    (a) => {
      a.receipt.fileKey = "other";
    },
    "file-identity",
  ],
  [
    "missing current file",
    (a) => {
      a.receipt.fileKey = "";
    },
    "file-identity",
  ],
  [
    "name-only identity",
    (a) => {
      a.expectedIdentity.collection.id = "";
    },
    "collection-identity",
  ],
  [
    "historical Altitude collection even with expected IDs",
    (a) => {
      a.expectedIdentity.collection.name = a.receipt.collection.name =
        "Altitude";
    },
    "collection-identity",
  ],
  [
    "same-named substitute collection",
    (a) => {
      a.receipt.collection.id = "substitute";
    },
    "collection-identity",
  ],
  [
    "wrong collection key",
    (a) => {
      a.receipt.collection.key = "wrong";
    },
    "collection-identity",
  ],
  [
    "remote collection",
    (a) => {
      a.receipt.collection.remote = true;
    },
    "collection-identity",
  ],
  [
    "unowned collection",
    (a) => {
      a.receipt.collection.ownership.scopeId = "old-history";
    },
    "collection-ownership",
  ],
  [
    "old source revision",
    (a) => {
      a.receipt.collection.ownership.source.revision = "old";
    },
    "collection-ownership",
  ],
  [
    "altered source token hash",
    (a) => {
      a.receipt.collection.ownership.source.tokensSha256 = "c".repeat(64);
    },
    "collection-ownership",
  ],
  [
    "stale expectation",
    (a) => {
      a.expectedIdentity.preparationRevision = "sha256:" + "0".repeat(64);
    },
    "preparation-identity",
  ],
  [
    "new source request against old identity",
    (a) => {
      a.input.source.revision = "new";
    },
    "preparation-identity",
  ],
  [
    "changed tree against old identity",
    (a) => {
      a.input.modes[0].tokens.weight = { $type: "number", $value: 700 };
      revise(a.input);
    },
    "preparation-identity",
  ],
  [
    "native mode substituted with same name",
    (a) => {
      a.receipt.collection.modes[0].modeId = "other-mode";
    },
    "mode-identity",
  ],
  [
    "renamed native mode",
    (a) => {
      a.receipt.collection.modes[0].name = "Light";
    },
    "mode-identity",
  ],
  [
    "extra unsupported mode",
    (a) => {
      a.receipt.collection.modes.push({ modeId: "extra", name: "Light" });
    },
    "mode-identity",
  ],
  [
    "wrong default mode",
    (a) => {
      a.receipt.collection.defaultModeId = "extra";
    },
    "mode-identity",
  ],
  [
    "mode identity source mapping changed",
    (a) => {
      a.expectedIdentity.modes[0].sourceMode = "light";
    },
    "mode-mapping",
  ],
  [
    "mode identity brand changed",
    (a) => {
      a.expectedIdentity.modes[0].brand = "other";
    },
    "mode-mapping",
  ],
  [
    "duplicate variable IDs",
    (a) => {
      a.expectedIdentity.variables[1].id = a.expectedIdentity.variables[0].id;
    },
    "variable-identity",
  ],
  [
    "duplicate variable keys",
    (a) => {
      a.expectedIdentity.variables[1].key = a.expectedIdentity.variables[0].key;
    },
    "variable-identity",
  ],
  [
    "duplicate observed IDs",
    (a) => {
      a.receipt.variables[1].id = a.receipt.variables[0].id;
    },
    "variable-identity",
  ],
  [
    "missing variable",
    (a) => {
      a.receipt.variables.pop();
    },
    "variable-identity",
  ],
  [
    "unaccounted variable",
    (a) => {
      a.receipt.variables.push(copy(a.receipt.variables[0]));
    },
    "variable-identity",
  ],
  [
    "same-named substituted variable",
    (a) => {
      a.receipt.variables[0].id = "other";
    },
    "variable-identity",
  ],
  [
    "same-ID wrong key",
    (a) => {
      a.receipt.variables[0].key = "other";
    },
    "variable-identity",
  ],
  [
    "same-ID renamed variable",
    (a) => {
      a.receipt.variables[0].name = "same-value-peer";
    },
    "variable-identity",
  ],
  [
    "variable in another collection",
    (a) => {
      a.receipt.variables[0].variableCollectionId = "historical";
    },
    "variable-identity",
  ],
  [
    "wrong native type",
    (a) => {
      a.receipt.variables[0].resolvedType = "STRING";
    },
    "variable-identity",
  ],
  [
    "remote variable",
    (a) => {
      a.receipt.variables[0].remote = true;
    },
    "variable-identity",
  ],
  [
    "changed literal value",
    (a) => {
      a.receipt.variables.find((v) => v.name === "weight")!.valuesByMode[
        "7:0"
      ] = 700;
    },
    "variable-value",
  ],
  [
    "wrong mode value key",
    (a) => {
      const v = a.receipt.variables[0];
      v.valuesByMode = { other: v.valuesByMode["7:0"] };
    },
    "variable-value",
  ],
  [
    "extra mode value",
    (a) => {
      a.receipt.variables[0].valuesByMode.extra = copy(rgba);
    },
    "variable-value",
  ],
  [
    "equal-value alias target substitution",
    (a) => {
      a.receipt.variables.find(
        (v) => v.name === "action/background",
      )!.valuesByMode["7:0"] = { type: "VARIABLE_ALIAS", id: "variable:twin" };
    },
    "variable-value",
  ],
  [
    "alias flattened to its equal literal",
    (a) => {
      a.receipt.variables.find(
        (v) => v.name === "action/background",
      )!.valuesByMode["7:0"] = copy(rgba);
    },
    "variable-value",
  ],
  [
    "rounded alpha",
    (a) => {
      a.receipt.variables[0].valuesByMode["7:0"] = { ...rgba, a: 0.5 };
    },
    "variable-value",
  ],
];
for (const [label, mutate, code] of badReceipts)
  test(`readback refuses ${label}`, () => {
    const args = fixture();
    mutate(args);
    const result = verifyNativeTokenContextReceipt(args);
    assert.equal(result.status, "refused");
    assert.equal(result.acceptedContract, null);
    assert.equal(result.nativeQualification, "unqualified");
    assert.equal(result.identity, undefined);
    assert.deepEqual(result.problems, [`native-token-context-${code}`]);
  });

test("observation order grants no identity and does not affect a valid readback", () => {
  const args = fixture();
  args.receipt.variables.reverse();
  args.expectedIdentity.variables.reverse();
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
});

test("per-mode alias target IDs stay distinct even when both targets have equal values", () => {
  const args = fixture(),
    lightTree = copy(tree);
  lightTree.action.background.$value = "{palette.twin}";
  args.input.modes.push({
    sourceMode: "light",
    brand: "default",
    nativeModeName: "Light",
    tokens: lightTree,
    tokenTreeRevision: revisionOf(lightTree),
  });
  const prep = prepareNativeTokenContext(args.input);
  args.expectedIdentity.preparationRevision = prep.revision;
  args.expectedIdentity.modes.push({
    sourceMode: "light",
    brand: "default",
    modeId: "7:1",
    name: "Light",
  });
  args.receipt.collection.ownership.preparationRevision = prep.revision;
  args.receipt.collection.modes.push({ modeId: "7:1", name: "Light" });
  for (const variable of args.receipt.variables)
    variable.valuesByMode["7:1"] =
      variable.name === "action/background"
        ? { type: "VARIABLE_ALIAS", id: "variable:twin" }
        : copy(variable.valuesByMode["7:0"]);
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  args.receipt.variables.find(
    (v) => v.name === "action/background",
  )!.valuesByMode["7:1"] = { type: "VARIABLE_ALIAS", id: "variable:base" };
  assert.deepEqual(verifyNativeTokenContextReceipt(args).problems, [
    "native-token-context-variable-value",
  ]);
});

test("two explicitly requested source modes cannot share a native mode ID", () => {
  const args = fixture();
  args.input.modes.push({
    ...copy(args.input.modes[0]),
    sourceMode: "light",
    nativeModeName: "Light",
  });
  const prep = prepareNativeTokenContext(args.input);
  args.expectedIdentity.preparationRevision = prep.revision;
  args.receipt.collection.ownership.preparationRevision = prep.revision;
  args.expectedIdentity.modes.push({
    sourceMode: "light",
    brand: "default",
    modeId: "7:0",
    name: "Light",
  });
  assert.deepEqual(verifyNativeTokenContextReceipt(args).problems, [
    "native-token-context-mode-identity",
  ]);
});

test("recorded native float32 color channels verify under an explicit pinned precision policy", () => {
  const args = fixture();
  args.input.modes[0].tokens.palette = {
    $type: "color",
    base: { $value: "#4375ff" },
    twin: { $value: "#4375ff" },
  };
  const prep = prepareNativeTokenContext(revise(args.input));
  assert.equal(prep.valueComparison, "exact-or-float32-color-v1");
  args.expectedIdentity.preparationRevision = prep.revision;
  args.receipt.collection.ownership.preparationRevision = prep.revision;
  // Actual recorded primary color channels from the inventory readback. Only
  // values are fixtures here; the historical Altitude IDs never grant reuse.
  const native = { r: 0.26274511218070984, g: 0.4588235318660736, b: 1, a: 1 };
  for (const v of args.receipt.variables.filter((v) =>
    v.name.startsWith("palette/"),
  ))
    v.valuesByMode["7:0"] = copy(native);
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  const base = args.receipt.variables.find((v) => v.name === "palette/base")!;
  for (const wrong of [
    native.r + Number.EPSILON,
    Math.fround(native.r + 2 ** -25),
    0.2627,
  ]) {
    base.valuesByMode["7:0"] = { ...native, r: wrong };
    assert.deepEqual(verifyNativeTokenContextReceipt(args).problems, [
      "native-token-context-variable-value",
    ]);
  }
});

test("float32 color allowance preserves alpha; a number variable verifies as itself or its exact float32, never a neighbour", () => {
  const args = fixture();
  for (const v of args.receipt.variables.filter((v) =>
    v.name.startsWith("palette/"),
  ))
    v.valuesByMode["7:0"] = {
      r: Math.fround(rgba.r),
      g: Math.fround(rgba.g),
      b: Math.fround(rgba.b),
      a: Math.fround(rgba.a),
    };
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  args.input.modes[0].tokens.weight = { $type: "number", $value: 0.1 };
  const prep = prepareNativeTokenContext(revise(args.input));
  args.expectedIdentity.preparationRevision = prep.revision;
  args.receipt.collection.ownership.preparationRevision = prep.revision;
  const weight = args.receipt.variables.find((v) => v.name === "weight")!;
  weight.valuesByMode["7:0"] = 0.1;
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  // Figma stores number variables as float32 (a planned 18.3906 read back as
  // 18.390600204467773 on the live canvas). That one representation verifies.
  weight.valuesByMode["7:0"] = Math.fround(0.1);
  assert.equal(
    verifyNativeTokenContextReceipt(args).status,
    "native-token-context-observed",
  );
  // The adjacent float32, a rounded decimal and a numeric string still refuse.
  for (const drifted of [Math.fround(0.1) + 2 ** -26, 0.10000000149, 0.1000001, "0.1"]) {
    weight.valuesByMode["7:0"] = drifted as number;
    assert.deepEqual(verifyNativeTokenContextReceipt(args).problems, [
      "native-token-context-variable-value",
    ], String(drifted));
  }
});
