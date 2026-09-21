import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import { build } from "esbuild";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import { revisionOf } from "./contract-provenance.js";
import {
  prepareNativeTokenContext,
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
} from "./native-token-context.js";
import {
  emitNativeTokenContextReadbackScript,
  emitNativeTokenContextScript,
  emitTokenSetScript,
  type NativeTokenCreationResult,
  type NativeTokenReadbackResult,
} from "./token-set.js";

const NS = "ds_contracts",
  KEY = "nativeTokenContext";
function request(): NativeTokenContextInput {
  const tokens = {
    palette: {
      $type: "color",
      base: { $value: "#4375ff" },
      twin: { $value: "#4375ff" },
    },
    action: { $type: "color", background: { $value: "{palette.base}" } },
    alias: { $type: "color", $value: "{action.background}" },
    weight: { $type: "number", $value: 600 },
  };
  return {
    fileKey: "scratch-key",
    scopeId: "owned-operation-123",
    source: {
      revision: "source-commit",
      sourceProgramSha256: "a".repeat(64),
      tokensSha256: "b".repeat(64),
    },
    tokenPaths: ["alias", "palette.twin", "weight"],
    modes: [
      {
        sourceMode: "dark",
        brand: "default",
        nativeModeName: "Dark",
        tokens,
        tokenTreeRevision: revisionOf(tokens),
      },
    ],
  };
}

type Variable = {
  id: string;
  key: string;
  name: string;
  variableCollectionId: string;
  resolvedType: string;
  remote: boolean;
  valuesByMode: Record<string, unknown>;
  setValueForMode(modeId: string, value: unknown): void;
  getSharedPluginData(ns: string, key: string): string;
  setSharedPluginData(ns: string, key: string, value: string): void;
};
type Collection = {
  id: string;
  key: string;
  name: string;
  remote: boolean;
  defaultModeId: string;
  variableIds: string[];
  modes: { modeId: string; name: string }[];
  renameMode(id: string, name: string): void;
  addMode(name: string): string;
  getSharedPluginData(ns: string, key: string): string;
  setSharedPluginData(ns: string, key: string, value: string): void;
};
type Host = {
  fileKey: string | undefined;
  variables: {
    createVariableCollection(name: string): Collection;
    createVariable(
      name: string,
      collection: Collection,
      type: string,
    ): Variable;
    createVariableAlias(variable: Variable): {
      type: "VARIABLE_ALIAS";
      id: string;
    };
    getLocalVariableCollectionsAsync(): Promise<Collection[]>;
    getLocalVariablesAsync(): Promise<Variable[]>;
    getVariableCollectionByIdAsync(id: string): Promise<Collection | null>;
    getVariableByIdAsync(id: string): Promise<Variable | null>;
  };
};

/** The existing writer mock supplies allocation/aliases/modes/metadata. Add
 * only read-only identity fields present in actual Plugin API typings. */
function host(modeLimit = 1) {
  const handle = createFigmaMock({ modeLimit });
  const figma = handle.figma as unknown as Host;
  const variables = handle.variables as unknown as Variable[];
  const collections = handle.collections as unknown as Collection[];
  const mutations: string[] = [];
  figma.fileKey = "scratch-key";
  const oldCreateCollection = figma.variables.createVariableCollection.bind(
    figma.variables,
  );
  const oldCreateVariable = figma.variables.createVariable.bind(
    figma.variables,
  );
  figma.variables.createVariableCollection = (name) => {
    mutations.push("create-collection");
    const collection = oldCreateCollection(name);
    Object.defineProperties(collection, {
      key: { value: `key-${collection.id}`, configurable: true },
      remote: { value: false, configurable: true },
      defaultModeId: {
        get: () => collection.modes[0].modeId,
        configurable: true,
      },
      variableIds: {
        get: () =>
          variables
            .filter((v) => v.variableCollectionId === collection.id)
            .map((v) => v.id),
        configurable: true,
      },
    });
    const set = collection.setSharedPluginData.bind(collection),
      rename = collection.renameMode.bind(collection),
      add = collection.addMode.bind(collection);
    collection.setSharedPluginData = (...args) => {
      mutations.push("collection-metadata");
      set(...args);
    };
    collection.renameMode = (...args) => {
      mutations.push("rename-mode");
      rename(...args);
    };
    collection.addMode = (name) => {
      mutations.push("add-mode");
      return add(name);
    };
    return collection;
  };
  figma.variables.createVariable = (name, collection, type) => {
    mutations.push("create-variable");
    const variable = oldCreateVariable(name, collection, type);
    Object.defineProperties(variable, {
      key: { value: `key-${variable.id}`, configurable: true },
      remote: { value: false, configurable: true },
    });
    const set = variable.setSharedPluginData.bind(variable),
      value = variable.setValueForMode.bind(variable);
    variable.setSharedPluginData = (...args) => {
      mutations.push("variable-metadata");
      set(...args);
    };
    variable.setValueForMode = (mode, data) => {
      mutations.push("set-value");
      // Actual Figma stores color channels as float32. Other values stay exact.
      const v = data as { r?: number; g: number; b: number; a: number };
      value(
        mode,
        v && typeof v === "object" && typeof v.r === "number"
          ? {
              r: Math.fround(v.r),
              g: Math.fround(v.g),
              b: Math.fround(v.b),
              a: Math.fround(v.a),
            }
          : data,
      );
    };
    return variable;
  };
  const run = async <T>(script: string): Promise<T> => {
    const context = vm.createContext({
      figma,
      globalThis: { DS_PRUNE_TOKENS: true, DS_OVERWRITE_TOKENS: true },
      console: { log() {}, warn() {}, error() {} },
    });
    const result = await vm.runInContext(
      `(async () => {\n${script}\n})()`,
      context,
      { timeout: 5000 },
    );
    return JSON.parse(JSON.stringify(result)) as T;
  };
  return { figma, variables, collections, mutations, run };
}
function historical(h: ReturnType<typeof host>) {
  const collection = h.figma.variables.createVariableCollection("Altitude");
  collection.renameMode(collection.defaultModeId, "Historical");
  const variable = h.figma.variables.createVariable(
    "palette/base",
    collection,
    "COLOR",
  );
  variable.setValueForMode(collection.defaultModeId, {
    r: 1,
    g: 0,
    b: 0,
    a: 1,
  });
  h.mutations.length = 0;
  return { collection, variable };
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("legacy writer bytes stay unchanged after shared-loop extraction", () => {
  const script = emitTokenSetScript(
    {
      name: "Historical",
      base: {
        "color.base": { $type: "color", $value: "#123456" },
        size: { $type: "dimension", $value: "2px" },
      },
      modes: { dark: { "color.base": { $value: "#abcdef" } } },
      minted: { alias: { $type: "color", $value: "{color.base}" } },
    },
    "historical-file",
  );
  assert.equal(
    sha(script),
    "57a7166bcb2f7bdfd77e91e5c8882bce4bb847e6691b71229e868c362b49fbeb",
  );
});

test("scoped creation uses one explicit Dark mode, exact source names and native alias chain", async () => {
  const input = request(),
    h = host(),
    old = historical(h);
  const before = JSON.stringify({
    name: old.collection.name,
    modes: old.collection.modes,
    values: old.variable.valuesByMode,
  });
  const { preparation, script } = emitNativeTokenContextScript(input);
  assert.deepEqual(preparation, prepareNativeTokenContext(input));
  const result = await h.run<NativeTokenCreationResult>(script);
  assert.equal(
    result.status,
    "created-candidate",
    JSON.stringify(result.problems),
  );
  assert.equal(result.receiptKind, "creation-objects-only");
  assert.equal(result.acceptedContract, null);
  assert.equal(result.nativeQualification, "unqualified");
  assert.equal(result.created, 5);
  assert.equal(result.aliased, 2);
  assert.deepEqual(
    result.creationIdentity!.modes.map((m) => [m.sourceMode, m.brand, m.name]),
    [["dark", "default", "Dark"]],
  );
  assert.deepEqual(
    result.creationIdentity!.variables.map((v) => v.tokenPath),
    ["palette.base", "palette.twin", "weight", "action.background", "alias"],
  );
  const identity = result.creationIdentity!,
    receipt = result.receipt!;
  assert.deepEqual(result.allocation.variables, identity.variables);
  assert.equal(h.collections.length, 2);
  assert.equal(h.mutations.includes("add-mode"), false);
  assert.equal(
    JSON.stringify({
      name: old.collection.name,
      modes: old.collection.modes,
      values: old.variable.valuesByMode,
    }),
    before,
  );
  assert.equal(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: identity,
      receipt,
    }).status,
    "native-token-context-observed",
  );
  const alias = receipt.variables.find((v) => v.name === "alias")!;
  const target = identity.variables.find(
    (v) => v.tokenPath === "action.background",
  )!;
  assert.deepEqual(alias.valuesByMode[identity.modes[0].modeId], {
    type: "VARIABLE_ALIAS",
    id: target.id,
  });
  assert.equal(alias.resolvedType, "COLOR");
  for (const v of h.variables.filter(
    (v) => v.variableCollectionId === identity.collection.id,
  )) {
    const owner = JSON.parse(v.getSharedPluginData(NS, KEY));
    assert.equal(owner.scopeId, input.scopeId);
    assert.equal(owner.preparationRevision, preparation.revision);
    assert.equal(owner.collectionId, identity.collection.id);
    assert.equal(owner.collectionKey, identity.collection.key);
    assert.equal(owner.tokenPath.replaceAll(".", "/"), v.name);
  }
});

test("separate readback uses persisted IDs and current native values without mutations", async () => {
  const input = request(),
    h = host();
  const created = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(input).script,
  );
  const identity = structuredClone(created.creationIdentity!);
  const script = emitNativeTokenContextReadbackScript(input, identity);
  h.mutations.length = 0;
  const readback = await h.run<NativeTokenReadbackResult>(script);
  assert.equal(readback.status, "readback-collected");
  assert.equal(readback.receiptKind, "independent-native-readback");
  assert.equal(readback.nativeQualification, "unqualified");
  assert.deepEqual(h.mutations, []);
  assert.equal(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: identity,
      receipt: readback.receipt!,
    }).status,
    "native-token-context-observed",
  );
  const weight = h.variables.find((v) => v.name === "weight")!;
  weight.valuesByMode[identity.modes[0].modeId] = 700;
  const changed = await h.run<NativeTokenReadbackResult>(script);
  assert.equal(changed.status, "readback-collected");
  assert.deepEqual(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: identity,
      receipt: changed.receipt!,
    }).problems,
    ["native-token-context-variable-value"],
  );
  assert.equal(
    created.receipt!.variables.find((v) => v.name === "weight")!.valuesByMode[
      identity.modes[0].modeId
    ],
    600,
    "creation receipt cannot masquerade as a fresh read",
  );
  assert.deepEqual(h.mutations, []);
});

const preflightFailures: [
  string,
  (h: ReturnType<typeof host>) => void,
  string,
][] = [
  [
    "wrong file",
    (h) => {
      h.figma.fileKey = "wrong";
    },
    "file-mismatch",
  ],
  [
    "missing file",
    (h) => {
      h.figma.fileKey = undefined;
    },
    "file-mismatch",
  ],
  [
    "file changes during awaited inventory",
    (h) => {
      const read = h.figma.variables.getLocalVariablesAsync;
      h.figma.variables.getLocalVariablesAsync = async () => {
        const vars = await read();
        h.figma.fileKey = "wrong";
        return vars;
      };
    },
    "file-mismatch",
  ],
  [
    "same collection name",
    (h) => {
      h.figma.variables.createVariableCollection(
        prepareNativeTokenContext(request()).collectionName,
      );
    },
    "collection-name-collision",
  ],
  [
    "renamed collection from same scope",
    (h) => {
      const c = h.figma.variables.createVariableCollection(
        "Renamed old candidate",
      );
      c.setSharedPluginData(
        NS,
        KEY,
        JSON.stringify({ scopeId: request().scopeId }),
      );
    },
    "scope-collision",
  ],
  [
    "stranded variable from same scope",
    (h) => {
      const c = h.figma.variables.createVariableCollection("Different");
      const v = h.figma.variables.createVariable("orphan", c, "FLOAT");
      v.setSharedPluginData(
        NS,
        KEY,
        JSON.stringify({ scopeId: request().scopeId }),
      );
    },
    "scope-collision",
  ],
  [
    "malformed ownership cannot hide a scope collision",
    (h) => {
      const c = h.figma.variables.createVariableCollection("Different");
      c.setSharedPluginData(NS, KEY, "{");
    },
    "ownership-unreadable",
  ],
  [
    "missing ownership reader",
    (h) => {
      const c = h.figma.variables.createVariableCollection("Different");
      c.getSharedPluginData =
        undefined as unknown as Collection["getSharedPluginData"];
    },
    "ownership-unreadable",
  ],
  [
    "missing required API",
    (h) => {
      h.figma.variables.createVariableAlias =
        undefined as unknown as Host["variables"]["createVariableAlias"];
    },
    "api-unavailable",
  ],
];
for (const [name, mutate, code] of preflightFailures)
  test(`preflight refuses ${name} before every mutation`, async () => {
    const h = host();
    historical(h);
    mutate(h);
    h.mutations.length = 0;
    const collectionCount = h.collections.length,
      variableCount = h.variables.length;
    const result = await h.run<NativeTokenCreationResult>(
      emitNativeTokenContextScript(request()).script,
    );
    assert.equal(result.status, "refused");
    assert.deepEqual(result.problems, [`native-token-write-${code}`]);
    assert.deepEqual(result.allocation, {
      collection: null,
      modes: [],
      variables: [],
    });
    assert.equal(result.creationIdentity, undefined);
    assert.equal(result.receipt, undefined);
    assert.deepEqual(h.mutations, []);
    assert.equal(h.collections.length, collectionCount);
    assert.equal(h.variables.length, variableCount);
  });

test("successful scope repeat refuses; explicit readback is the no-write route", async () => {
  const input = request(),
    h = host(),
    { script } = emitNativeTokenContextScript(input);
  const first = await h.run<NativeTokenCreationResult>(script);
  h.mutations.length = 0;
  const repeat = await h.run<NativeTokenCreationResult>(script);
  assert.equal(repeat.status, "refused");
  assert.deepEqual(repeat.problems, [
    "native-token-write-collection-name-collision",
  ]);
  assert.deepEqual(h.mutations, []);
  assert.equal(
    (
      await h.run<NativeTokenReadbackResult>(
        emitNativeTokenContextReadbackScript(input, first.creationIdentity!),
      )
    ).status,
    "readback-collected",
  );
  assert.deepEqual(h.mutations, []);
});

test("unsupported multi-mode requests and changed tree pins fail before script generation", () => {
  const input = request();
  input.modes.push({
    ...structuredClone(input.modes[0]),
    sourceMode: "light",
    nativeModeName: "Light",
  });
  assert.throws(() => emitNativeTokenContextScript(input), {
    message: "native-token-write-single-mode-required",
  });
  input.modes.pop();
  input.modes[0].tokens.weight = { $type: "number", $value: 700 };
  assert.throws(() => emitNativeTokenContextScript(input), {
    message: "native-token-context-token-tree-revision",
  });
});

test("failed value write preserves exact allocated IDs and marks partial allocation", async () => {
  const h = host(),
    create = h.figma.variables.createVariable;
  h.figma.variables.createVariable = (...args) => {
    const v = create(...args);
    v.setValueForMode = () => {
      throw Error("injected value write failure");
    };
    return v;
  };
  const result = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(request()).script,
  );
  assert.equal(result.status, "partial-allocation");
  assert.equal(result.allocation.collection!.id, h.collections[0].id);
  assert.equal(result.allocation.variables.length, 1);
  assert.equal(result.allocation.variables[0].id, h.variables[0].id);
  assert.equal(result.allocation.variables[0].key, h.variables[0].key);
  assert.equal(result.creationIdentity, undefined);
  assert.equal(result.receipt, undefined);
  assert.equal(h.collections.length, 1);
  assert.equal(h.variables.length, 1);
  h.mutations.length = 0;
  assert.equal(
    (
      await h.run<NativeTokenCreationResult>(
        emitNativeTokenContextScript(request()).script,
      )
    ).status,
    "refused",
  );
  assert.deepEqual(h.mutations, []);
});

test("collection metadata failure preserves its allocated default mode before any variable write", async () => {
  const h = host(),
    create = h.figma.variables.createVariableCollection;
  h.figma.variables.createVariableCollection = (name) => {
    const collection = create(name);
    collection.setSharedPluginData = () => {
      throw Error("metadata failed");
    };
    return collection;
  };
  const result = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(request()).script,
  );
  assert.equal(result.status, "partial-allocation");
  assert.equal(result.allocation.collection!.id, h.collections[0].id);
  assert.equal(
    result.allocation.modes[0].modeId,
    h.collections[0].defaultModeId,
  );
  assert.equal(result.allocation.modes[0].name, "Mode 1");
  assert.deepEqual(result.allocation.variables, []);
  assert.equal(h.variables.length, 0);
});

test("a file change immediately after allocation prevents metadata and value writes while retaining IDs", async () => {
  const h = host(),
    create = h.figma.variables.createVariableCollection;
  h.figma.variables.createVariableCollection = (name) => {
    const collection = create(name);
    h.figma.fileKey = "other-file";
    return collection;
  };
  const result = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(request()).script,
  );
  assert.equal(result.status, "partial-allocation");
  assert.deepEqual(result.problems, ["native-token-write-file-mismatch"]);
  assert.equal(result.allocation.collection!.id, h.collections[0].id);
  assert.equal(
    result.allocation.modes[0].modeId,
    h.collections[0].defaultModeId,
  );
  assert.deepEqual(h.mutations, ["create-collection"]);
});

test("shared compiler types and values remain FLOAT dimensions and exact STRING variables", async () => {
  const input = request(),
    h = host();
  const tokens = {
    space: { $type: "dimension", $value: "0.5rem" },
    label: { $type: "string", $value: "Unchanged label" },
  };
  input.tokenPaths = ["space", "label"];
  input.modes[0].tokens = tokens;
  input.modes[0].tokenTreeRevision = revisionOf(tokens);
  const result = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(input).script,
  );
  assert.equal(result.status, "created-candidate");
  const mode = result.creationIdentity!.modes[0].modeId;
  assert.deepEqual(
    result.receipt!.variables.map((v) => [
      v.name,
      v.resolvedType,
      v.valuesByMode[mode],
    ]),
    [
      ["label", "STRING", "Unchanged label"],
      ["space", "FLOAT", 8],
    ],
  );
  assert.equal(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: result.creationIdentity!,
      receipt: result.receipt!,
    }).status,
    "native-token-context-observed",
  );
});

test("failure reading creation objects retains completed creation identity before independent readback", async () => {
  const h = host(),
    create = h.figma.variables.createVariableCollection;
  h.figma.variables.createVariableCollection = (name) => {
    const c = create(name);
    c.getSharedPluginData = () => {
      throw Error("receipt unavailable");
    };
    return c;
  };
  const result = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(request()).script,
  );
  assert.equal(result.status, "partial-allocation");
  assert.equal(result.creationIdentity!.variables.length, 5);
  assert.deepEqual(
    result.creationIdentity!.variables,
    result.allocation.variables,
  );
  assert.equal(result.receipt, undefined);
});

test("independent readback refuses substituted IDs, unaccounted variables and wrong file with zero writes", async (t) => {
  for (const mutation of [
    "collection-key",
    "variable-key",
    "extra-variable",
    "wrong-file",
  ])
    await t.test(mutation, async () => {
      const input = request(),
        h = host();
      const created = await h.run<NativeTokenCreationResult>(
        emitNativeTokenContextScript(input).script,
      );
      const script = emitNativeTokenContextReadbackScript(
        input,
        created.creationIdentity!,
      );
      if (mutation === "collection-key")
        Object.defineProperty(h.collections[0], "key", { value: "wrong" });
      if (mutation === "variable-key")
        Object.defineProperty(h.variables[0], "key", { value: "wrong" });
      if (mutation === "extra-variable")
        h.figma.variables.createVariable(
          "unaccounted",
          h.collections[0],
          "FLOAT",
        );
      if (mutation === "wrong-file") h.figma.fileKey = "wrong";
      h.mutations.length = 0;
      const result = await h.run<NativeTokenReadbackResult>(script);
      assert.equal(result.status, "refused");
      assert.equal(result.receipt, undefined);
      assert.deepEqual(h.mutations, []);
    });
});

test("readback generation rejects a name-only or stale expected identity", async () => {
  const input = request(),
    h = host();
  const created = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(input).script,
  );
  const identity = created.creationIdentity!;
  identity.collection.id = "";
  assert.throws(
    () => emitNativeTokenContextReadbackScript(input, identity),
    /collection-identity/,
  );
  identity.collection.id = h.collections[0].id;
  identity.preparationRevision = "stale";
  assert.throws(
    () => emitNativeTokenContextReadbackScript(input, identity),
    /preparation-identity/,
  );
});

test("readback brackets variable reads with the complete collection inventory", async () => {
  const input = request(),
    h = host();
  const created = await h.run<NativeTokenCreationResult>(
    emitNativeTokenContextScript(input).script,
  );
  const script = emitNativeTokenContextReadbackScript(
    input,
    created.creationIdentity!,
  );
  const read = h.figma.variables.getVariableByIdAsync;
  let changed = false;
  h.figma.variables.getVariableByIdAsync = async (id) => {
    const variable = await read(id);
    if (!changed) {
      changed = true;
      // Simulate another actor adding a variable while native reads are pending.
      h.variables.push({
        ...h.variables[0],
        id: "external-id",
        key: "external-key",
        name: "External",
      });
    }
    return variable;
  };
  h.mutations.length = 0;
  const result = await h.run<NativeTokenReadbackResult>(script);
  assert.equal(result.status, "refused");
  assert.deepEqual(result.problems, [
    "native-token-write-readback-variable-inventory",
  ]);
  assert.equal(result.receipt, undefined);
  assert.deepEqual(h.mutations, []);
});

test("browser bundle initializes both imports and invokes the scoped compiler across their function-only cycle", async () => {
  const bundled = await build({
    entryPoints: [new URL("./token-set.ts", import.meta.url).pathname],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "TokenSet",
    write: false,
  });
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(bundled.outputFiles[0].text, context);
  const compiled = context.TokenSet.emitNativeTokenContextScript(request());
  assert.equal(compiled.preparation.modes[0].nativeModeName, "Dark");
  assert.match(compiled.script, /createOwnedVariable/);
  assert.equal(compiled.preparation.nativeQualification, "unqualified");
});


function explicitModesRequest(): NativeTokenContextInput {
  const input = request(); input.writeProtocol = 'explicit-modes-v1';
  const second = structuredClone(input.modes[0]);
  second.sourceMode = 'light'; second.nativeModeName = 'Light';
  (second.tokens.action as any).background.$value = '{palette.twin}';
  (second.tokens.weight as any).$value = 400;
  second.tokenTreeRevision = revisionOf(second.tokens); input.modes.push(second);
  return input;
}

test('single-mode scoped writer remains byte-identical without the explicit mode protocol', () => {
  assert.equal(sha(emitNativeTokenContextScript(request()).script), '703d28842312f3846abb20da7c73aab67f9969f611e63dbee8f2dae7db9e100d');
  const input = explicitModesRequest(); delete input.writeProtocol;
  assert.throws(() => emitNativeTokenContextScript(input), /single-mode-required/);
  assert.throws(() => emitNativeTokenContextScript({ ...request(), writeProtocol: 'unknown' as any }), /write-protocol/);
});

test('explicit modes allocate once and retain per-mode alias identities through independent readback', async () => {
  const input = explicitModesRequest(), h = host(3), old = historical(h);
  const before = JSON.stringify({ collection: old.collection, variable: old.variable });
  const written = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
  assert.equal(written.status, 'created-candidate', JSON.stringify(written));
  const identity = written.creationIdentity!;
  assert.equal(identity.modes.length, 2); assert.equal(identity.variables.length, 5);
  const read = await h.run<NativeTokenReadbackResult>(emitNativeTokenContextReadbackScript(input, identity));
  assert.equal(read.status, 'readback-collected', JSON.stringify(read));
  assert.equal(verifyNativeTokenContextReceipt({ input, expectedIdentity: identity, receipt: read.receipt! }).status, 'native-token-context-observed');
  const vars = new Map(read.receipt!.variables.map(v => [v.name, v]));
  const [dark, light] = identity.modes;
  assert.deepEqual(vars.get('action/background')!.valuesByMode, {
    [dark.modeId]: { type: 'VARIABLE_ALIAS', id: vars.get('palette/base')!.id },
    [light.modeId]: { type: 'VARIABLE_ALIAS', id: vars.get('palette/twin')!.id },
  });
  assert.deepEqual(vars.get('weight')!.valuesByMode, { [dark.modeId]: 600, [light.modeId]: 400 });
  assert.equal(JSON.stringify({ collection: old.collection, variable: old.variable }), before);
  const aliased = h.variables.find(v => v.id === vars.get('action/background')!.id)!;
  aliased.setValueForMode(light.modeId, { type: 'VARIABLE_ALIAS', id: vars.get('palette/base')!.id });
  const altered = await h.run<NativeTokenReadbackResult>(emitNativeTokenContextReadbackScript(input, identity));
  assert.equal(verifyNativeTokenContextReceipt({ input, expectedIdentity: identity, receipt: altered.receipt! }).status, 'refused', 'same-value target substitution is not identity preservation');
  h.mutations.length = 0;
  const repeat = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
  assert.equal(repeat.status, 'refused'); assert.deepEqual(h.mutations, []);
});

test('mode capacity and later value failures retain partial owned allocation without retrying it', async () => {
  for (const kind of ['capacity', 'second-value'] as const) {
    const input = explicitModesRequest(), h = host(kind === 'capacity' ? 1 : 2);
    if (kind === 'second-value') {
      const create = h.figma.variables.createVariable.bind(h.figma.variables);
      h.figma.variables.createVariable = (...args) => {
        const v = create(...args), set = v.setValueForMode.bind(v);
        v.setValueForMode = (id, value) => {
          if (v.name === 'weight' && id === h.collections[0].modes[1].modeId) throw Error('write interrupted');
          set(id, value);
        };
        return v;
      };
    }
    const written = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
    assert.equal(written.status, 'partial-allocation', kind);
    assert.ok(written.allocation.collection?.id, kind);
    assert.equal(written.allocation.modes.length, kind === 'capacity' ? 1 : 2, kind);
    assert.equal(written.allocation.variables.length, kind === 'capacity' ? 0 : 5, kind);
    assert.equal(written.creationIdentity, undefined, kind);
    if (kind === 'capacity') assert.deepEqual(written.problems, ['native-token-write-mode-allocation-failed']);
    h.mutations.length = 0;
    const repeat = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
    assert.equal(repeat.status, 'refused'); assert.deepEqual(h.mutations, []);
  }
});

test('explicit mode creation permits an alias to become concrete without allocating a same-name peer', async () => {
  const input = explicitModesRequest(), h = host(2);
  (input.modes[1].tokens.action as any).background.$value = '#4375ff';
  input.modes[1].tokenTreeRevision = revisionOf(input.modes[1].tokens);
  const written = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
  assert.equal(written.status, 'created-candidate', JSON.stringify(written));
  const read = await h.run<NativeTokenReadbackResult>(emitNativeTokenContextReadbackScript(input, written.creationIdentity!));
  assert.equal(verifyNativeTokenContextReceipt({ input, expectedIdentity: written.creationIdentity!, receipt: read.receipt! }).status, 'native-token-context-observed');
  assert.equal(h.variables.filter(v => v.name === 'action/background').length, 1);
});


test('native selections distinguish physical variant modes without inventing a source theme', async () => {
  const input = explicitModesRequest(), h = host(2);
  const planRevision = revisionOf('a host-derived template projection');
  for (const [index, mode] of input.modes.entries()) {
    mode.sourceMode = 'light'; mode.brand = 'default';
    mode.nativeSelection = { planRevision, modeKey: revisionOf(index) };
  }
  const written = await h.run<NativeTokenCreationResult>(emitNativeTokenContextScript(input).script);
  assert.equal(written.status, 'created-candidate', JSON.stringify(written));
  assert.deepEqual(written.creationIdentity!.modes.map(m => m.nativeSelection), input.modes.map(m => m.nativeSelection));
  const read = await h.run<NativeTokenReadbackResult>(emitNativeTokenContextReadbackScript(input, written.creationIdentity!));
  assert.equal(verifyNativeTokenContextReceipt({ input, expectedIdentity: written.creationIdentity!, receipt: read.receipt! }).status, 'native-token-context-observed');
  const altered = structuredClone(written.creationIdentity!); delete altered.modes[1].nativeSelection;
  assert.equal(verifyNativeTokenContextReceipt({ input, expectedIdentity: altered, receipt: read.receipt! }).status, 'refused');
  for (const change of [
    (i: NativeTokenContextInput) => { delete i.modes[1].nativeSelection; },
    (i: NativeTokenContextInput) => { i.modes[1].nativeSelection!.planRevision = revisionOf('other'); },
    (i: NativeTokenContextInput) => { i.modes[1].nativeSelection!.modeKey = i.modes[0].nativeSelection!.modeKey; },
    (i: NativeTokenContextInput) => { delete i.writeProtocol; },
    (i: NativeTokenContextInput) => { i.modes[1].brand = 'other'; },
  ]) {
    const bad = structuredClone(input); change(bad);
    assert.throws(() => emitNativeTokenContextScript(bad), /native-token-context-(native-mode-selection|source-mode-ambiguous)/);
  }
});
