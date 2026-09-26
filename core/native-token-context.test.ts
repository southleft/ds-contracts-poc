import assert from "node:assert/strict";
import test from "node:test";
import { revisionOf } from "./contract-provenance.js";
import { compileTokenSetRows } from "./token-set.js";
import {
  nativeTokenCollectionName,
  prepareNativeTokenContext,
  restoreNativeTokenAllocationInput,
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

test('only an explicit retained-library context can own an empty variable scope',()=>{
  const empty=input();empty.tokenPaths=[];
  assert.throws(()=>prepareNativeTokenContext(empty),/token-path/);
  empty.writeProtocol='explicit-modes-v1';
  assert.throws(()=>prepareNativeTokenContext(empty),/token-path/,'ordinary source history retains its nonempty invariant');
  empty.source={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),
    inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:'d'.repeat(64)};
  const prepared=prepareNativeTokenContext(empty);
  assert.deepEqual(prepared.variables,[]);assert.deepEqual(prepared.requestedTokenPaths,[]);
  delete empty.writeProtocol;
  assert.throws(()=>prepareNativeTokenContext(empty),/token-path/);
});

test('template history retains allocation values for requested leaves and alias dependencies', () => {
  const before = input();
  (before.modes[0].tokens.gap as any).$value = '8px';
  (before.modes[0].tokens.weight as any).$type = 'fontWeight'; revise(before);
  const after = copy(before);
  (after.modes[0].tokens.gap as any).$value = '12px';
  (after.modes[0].tokens.weight as any).$value = 700;
  (after.modes[0].tokens.palette as any).base.$value = '#abcdef'; revise(after);
  after.allocatedValueProtocol = 'template-values-v1';
  after.allocatedValues = [
    { sourceMode: 'dark', brand: 'default', tokenPath: 'gap', value: '8px' },
    { sourceMode: 'dark', brand: 'default', tokenPath: 'palette.base', value: '#12345680' },
    { sourceMode: 'dark', brand: 'default', tokenPath: 'weight', value: 600 },
  ];
  const original = copy(after), prepared = prepareNativeTokenContext(after);
  assert.equal(prepared.revision, prepareNativeTokenContext(before).revision);
  assert.ok(!after.tokenPaths.includes('palette.base'), 'dependency retains its original allocation without being requested');
  assert.deepEqual(restoreNativeTokenAllocationInput(after), before);
  assert.deepEqual(after, original);
  const historical = copy(after); delete historical.allocatedValueProtocol;
  assert.throws(() => prepareNativeTokenContext(historical), /allocated-value-/);
  const unrelated = copy(after); unrelated.modes[0].tokens.unused = { $type: 'color', $value: '#fff' }; revise(unrelated);
  unrelated.allocatedValues = [{ sourceMode: 'dark', brand: 'default', tokenPath: 'unused', value: '#000' }];
  assert.throws(() => prepareNativeTokenContext(unrelated), /allocated-value-unrequested/);
});

test('template history cannot carry aliases, relative dimensions, unsupported types or fabricated modes', () => {
  const before = input(); (before.modes[0].tokens.gap as any).$value = '8px'; revise(before);
  const current = copy(before); (current.modes[0].tokens.gap as any).$value = '12px'; revise(current);
  current.allocatedValueProtocol = 'template-values-v1';
  current.allocatedValues = [{ sourceMode: 'dark', brand: 'default', tokenPath: 'gap', value: '8px' }];
  for (const mutate of [
    (v: NativeTokenContextInput) => { v.allocatedValues![0].value = '0.5rem'; },
    (v: NativeTokenContextInput) => { (v.modes[0].tokens.gap as any).$value = '0.75rem'; },
    (v: NativeTokenContextInput) => { v.allocatedValues![0].value = '{weight}'; },
    (v: NativeTokenContextInput) => { (v.modes[0].tokens.gap as any).$value = '{weight}'; },
    (v: NativeTokenContextInput) => { (v.modes[0].tokens.gap as any).$type = 'string'; },
    (v: NativeTokenContextInput) => { v.allocatedValues![0].sourceMode = 'light'; },
    (v: NativeTokenContextInput) => { v.allocatedValues!.push(copy(v.allocatedValues![0])); },
    (v: NativeTokenContextInput) => { v.writeProtocol = 'explicit-modes-v1'; },
  ]) {
    const bad = copy(current); mutate(bad); revise(bad);
    assert.throws(() => prepareNativeTokenContext(bad), /native-token-context-/);
  }
});

test('explicit pixel-dimension history preserves allocation identity and carries the current FLOAT value', () => {
  const before = input();
  (before.modes[0].tokens.gap as any).$value = '18.390625px'; revise(before);
  const allocation = prepareNativeTokenContext(before), after = copy(before);
  (after.modes[0].tokens.gap as any).$value = '20px'; revise(after);
  after.allocatedValues = [{ sourceMode: 'dark', brand: 'default', tokenPath: 'gap', value: '18.390625px' }];
  assert.throws(() => prepareNativeTokenContext(after), /allocated-value-type/, 'the historical protocol stays number-only');
  after.allocatedValueProtocol = 'px-dimension-v1';
  const saved = copy(after), current = prepareNativeTokenContext(after);
  assert.equal(current.revision, allocation.revision);
  assert.equal(current.variables.find(v => v.tokenPath === 'gap')!.values[0].value, 20);
  assert.equal(allocation.variables.find(v => v.tokenPath === 'gap')!.values[0].value, 18.390625);
  assert.deepEqual(after, saved, 'history compilation cannot rewrite its evidence');
  assert.deepEqual(current.source, allocation.source);
  assert.deepEqual(current.variables.map(v => [v.tokenPath, v.name, v.resolvedType]),
    allocation.variables.map(v => [v.tokenPath, v.name, v.resolvedType]));
  const restored = copy(before);
  assert.deepEqual(prepareNativeTokenContext(restored), allocation, 'returning to allocation needs no history extension');
});

test('pixel history refuses relative units, aliases, structured values, other types and empty or unknown protocols', () => {
  const before = input(); (before.modes[0].tokens.gap as any).$value = '18.390625px'; revise(before);
  const after = copy(before); (after.modes[0].tokens.gap as any).$value = '20px'; revise(after);
  after.allocatedValueProtocol = 'px-dimension-v1';
  after.allocatedValues = [{ sourceMode: 'dark', brand: 'default', tokenPath: 'gap', value: '18.390625px' }];
  for (const value of ['1rem', '2em', '20%', 'auto', 'calc(20px)', '{weight}', { value: 20, unit: 'px' }, 20, 'Infinitypx', 'NaNpx']) {
    for (const side of ['current', 'allocation']) {
      const bad = copy(after);
      if (side === 'current') { (bad.modes[0].tokens.gap as any).$value = value; revise(bad); }
      else bad.allocatedValues![0].value = value;
      assert.throws(() => prepareNativeTokenContext(bad), /native-token-context-/, `${side}: ${JSON.stringify(value)}`);
    }
  }
  const wrong = copy(after); (wrong as any).allocatedValueProtocol = 'future';
  assert.throws(() => prepareNativeTokenContext(wrong), /allocated-value-protocol$/);
  const empty = copy(before); empty.allocatedValueProtocol = 'px-dimension-v1';
  assert.throws(() => prepareNativeTokenContext(empty), /allocated-value-protocol-empty/);
  const numberOnly = copy(before); (numberOnly.modes[0].tokens.weight as any).$value = 700; revise(numberOnly);
  numberOnly.allocatedValues = [{ sourceMode: 'dark', brand: 'default', tokenPath: 'weight', value: 600 }];
  const historical = prepareNativeTokenContext(numberOnly); assert.equal(historical.revision, prepareNativeTokenContext(before).revision);
  numberOnly.allocatedValueProtocol = 'px-dimension-v1';
  assert.throws(() => prepareNativeTokenContext(numberOnly), /allocated-value-protocol-empty/);
  for (const type of ['string', 'color', 'boolean']) {
    const bad = copy(after); (bad.modes[0].tokens.gap as any).$type = type; revise(bad);
    assert.throws(() => prepareNativeTokenContext(bad), /native-token-context-/);
  }
});

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

test('prepared-library token provenance preserves archive identity without claiming a source program', () => {
  const request = input();
  request.source = { kind: 'prepared-contract-library', revision: 'sha256:' + 'c'.repeat(64),
    artifactId: 'c'.repeat(64), inputSha256: 'd'.repeat(64), tarballSha256: 'e'.repeat(64), tokensSha256: 'b'.repeat(64) };
  const before = copy(request), result = prepareNativeTokenContext(request);
  assert.deepEqual(result.source, request.source);
  assert.equal('sourceProgramSha256' in result.source, false);
  assert.deepEqual(request, before);
  assert.deepEqual(result.variables, prepareNativeTokenContext(input()).variables,
    'provenance does not rewrite token values or alias identities');
  for (const change of [
    { revision: 'sha256:' + 'f'.repeat(64) },
    { artifactId: '../outside' },
    { inputSha256: '' },
    { tarballSha256: 'invalid' },
    { tokensSha256: 'invalid' },
    { sourceProgramSha256: 'a'.repeat(64) },
    { observedReact: true },
    { kind: 'future-protocol' },
  ]) assert.throws(() => prepareNativeTokenContext({ ...request, source: { ...request.source, ...change } as any }), /source-identity/);
});

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
