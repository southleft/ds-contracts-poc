import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as z from "zod";
import {
  CodeAnchorsSchema,
  ContractBindingsSchema,
  ContractSchema,
  PropSchema,
} from "../src/contract-schema.js";

const reference = () => ({
  version: 1,
  kind: "custom-element",
  artifactRevision: `sha256:${"1".repeat(64)}`,
  interfaceRevision: `sha256:${"2".repeat(64)}`,
  bindingRevision: `sha256:${"3".repeat(64)}`,
});
const bindings = () => ({
  figma: { anchors: { fileKey: null, componentSetKey: null } },
  code: { anchors: { importPath: "components/Example", export: "Example" } },
});
const parseReference = (runtime: unknown) =>
  ContractBindingsSchema.safeParse({
    ...bindings(),
    code: { ...bindings().code, runtime },
  });

test("runtime identity keeps artifact, full interface and binding revisions distinct and unchanged", () => {
  const runtime = reference();
  const input = { ...bindings(), code: { ...bindings().code, runtime } };
  const parsed = ContractBindingsSchema.parse(input);
  assert.equal(JSON.stringify(parsed), JSON.stringify(input));
  assert.deepEqual(
    ContractBindingsSchema.parse(JSON.parse(JSON.stringify(parsed))),
    parsed,
  );
  assert.deepEqual(
    parsed.code.anchors,
    input.code.anchors,
    "reference does not replace the consumer anchor",
  );
});

test("existing contracts retain byte-identical parsed output without injecting a runtime binding", () => {
  // The prior code-binding branch had exactly this shape. Reuse the unchanged
  // surrounding schema so this is an additive-field compatibility check, not a
  // frozen snapshot of unrelated contract descriptions or future capabilities.
  const previousBindings = ContractBindingsSchema.extend({
    code: z.strictObject({ anchors: CodeAnchorsSchema }),
  });
  const previousContract = ContractSchema.safeExtend({
    bindings: previousBindings,
  });
  for (const name of ["button", "checkbox", "card"]) {
    const input: unknown = JSON.parse(
      readFileSync(
        new URL(`../../../contracts/${name}.contract.json`, import.meta.url),
        "utf8",
      ),
    );
    const parsed = ContractSchema.parse(input);
    assert.equal(
      JSON.stringify(parsed),
      JSON.stringify(previousContract.parse(input)),
      name,
    );
    assert.equal(Object.hasOwn(parsed.bindings.code, "runtime"), false, name);
  }
  assert.equal(
    JSON.stringify(ContractBindingsSchema.parse(bindings())),
    JSON.stringify(bindings()),
  );
});

test("malformed, incomplete or unsupported runtime objects are refused, not stripped or defaulted", () => {
  for (const runtime of [
    null,
    true,
    1,
    "custom-element",
    [],
    {},
    { ...reference(), version: 2 },
    { ...reference(), version: "1" },
    { ...reference(), kind: "react" },
    { ...reference(), kind: "custom-element " },
    ...Object.keys(reference()).map((key) => {
      const copy: Record<string, unknown> = reference();
      delete copy[key];
      return copy;
    }),
  ])
    assert.equal(
      parseReference(runtime).success,
      false,
      JSON.stringify(runtime),
    );
});

test("all three revision fields require exact lowercase sha256 identifiers", () => {
  const invalid = [
    "",
    "1".repeat(64),
    `sha256:${"1".repeat(63)}`,
    `sha256:${"1".repeat(65)}`,
    `sha256:${"G".repeat(64)}`,
    `sha256:${"A".repeat(64)}`,
    `SHA256:${"1".repeat(64)}`,
    ` sha256:${"1".repeat(64)}`,
    `sha256:${"1".repeat(64)} `,
    `sha256:${"1".repeat(64)}\n`,
    null,
    123,
    true,
    { digest: "1".repeat(64) },
    [],
  ];
  for (const field of [
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
  ]) {
    for (const value of invalid) {
      assert.equal(
        parseReference({ ...reference(), [field]: value }).success,
        false,
        `${field}: ${JSON.stringify(value)}`,
      );
    }
  }
});

test("runtime reference refuses executable, location and unknown metadata fields at the contract boundary", () => {
  for (const [key, value] of Object.entries({
    path: "../untrusted.js",
    importPath: "https://example.invalid/runtime.js",
    export: "Untrusted",
    source: "globalThis.sideEffect = true",
    paths: { javascript: "/tmp/runtime.js" },
    constructor: "ALButton",
    props: ["label"],
    interface: { props: ["label"] },
    grade: "pass",
  })) {
    const result = parseReference({ ...reference(), [key]: value });
    assert.equal(result.success, false, key);
    if (!result.success)
      assert.ok(
        result.error.issues.some((issue) => issue.code === "unrecognized_keys"),
      );
  }
  const input = bindings();
  assert.equal(
    ContractBindingsSchema.safeParse({ ...input, runtime: reference() })
      .success,
    false,
  );
  assert.equal(
    ContractBindingsSchema.safeParse({
      ...input,
      code: { ...input.code, runtimes: [reference()] },
    }).success,
    false,
  );
});

test("full contracts preserve references and surface exact malformed revision paths", () => {
  const input = JSON.parse(
    readFileSync(
      new URL("../../../contracts/button.contract.json", import.meta.url),
      "utf8",
    ),
  );
  input.bindings.code.runtime = reference();
  const parsed = ContractSchema.parse(input);
  assert.deepEqual(parsed.bindings.code.runtime, reference());
  input.bindings.code.runtime.bindingRevision = "../mapping.json";
  const result = ContractSchema.safeParse(input);
  assert.equal(result.success, false);
  if (!result.success)
    assert.ok(
      result.error.issues.some(
        (issue) =>
          issue.path.join(".") === "bindings.code.runtime.bindingRevision",
      ),
    );
});

test("JSON Schema publishes only the optional strict reference, not runtime implementation or a widened prop union", () => {
  const projection = z.toJSONSchema(ContractBindingsSchema, {
    target: "draft-7",
    io: "input",
  });
  const code = projection.properties?.code;
  assert.ok(code && typeof code === "object");
  assert.equal(code.required?.includes("runtime"), false);
  const runtime = code.properties?.runtime;
  assert.ok(runtime && typeof runtime === "object");
  assert.equal(runtime.additionalProperties, false);
  assert.deepEqual(runtime.required, [
    "version",
    "kind",
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
  ]);
  assert.deepEqual(Object.keys(runtime.properties ?? {}), runtime.required);
  for (const field of [
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
  ]) {
    const revision:
      { type?: unknown; pattern?: unknown } | boolean | undefined =
      runtime.properties?.[field];
    assert.ok(revision && typeof revision === "object");
    assert.equal(revision.type, "string");
    assert.equal(revision.pattern, "^sha256:[0-9a-f]{64}$");
  }
  assert.equal(
    PropSchema.safeParse({
      name: "isPressed",
      type: { union: ["boolean", { enum: ["mixed"] }] },
      bindings: { code: { prop: "isPressed" }, figma: { kind: "NONE" } },
    }).success,
    false,
    "an immutable runtime reference does not invent a full API projection",
  );
});
