import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createStagedWriterTransportWrapper,
  createWriterTransportArtifact,
  createWriterTransportEnvelope,
  createWriterTransportWrapper,
  decodeWriterTransportEnvelope,
  validateWriterTransportArtifact,
  type WriterTransportEnvelope,
} from "./writer-transport.js";

const utf8 = (value: string): Uint8Array => Buffer.from(value, "utf8");
const copyEnvelope = (
  envelope: WriterTransportEnvelope,
): WriterTransportEnvelope => structuredClone(envelope);

test("exact UTF-8 bytes round-trip without source reserialization", () => {
  const source = "α\r\nβ\nNUL:\0 quotes:'\" slash:\\ end\n";
  const bytes = utf8(source);
  const envelope = createWriterTransportEnvelope(bytes);
  assert.deepEqual(decodeWriterTransportEnvelope(envelope), bytes);
  assert.equal(
    Buffer.from(decodeWriterTransportEnvelope(envelope)).toString("utf8"),
    source,
  );
});

test("transport corruption fails closed before eval", () => {
  const original = createWriterTransportEnvelope(
    utf8("globalThis.__transportEvalCount += 1;\nreturn 1;\n"),
  );
  const cases: Array<
    [string, (copy: WriterTransportEnvelope) => void, RegExp]
  > = [
    [
      "truncated payload",
      (copy) => {
        copy.payload = copy.payload.slice(0, -1);
      },
      /BASE64/,
    ],
    [
      "altered base64",
      (copy) => {
        copy.payload = `${copy.payload[0] === "A" ? "B" : "A"}${copy.payload.slice(1)}`;
      },
      /SHA256/,
    ],
    [
      "wrong length",
      (copy) => {
        copy.payloadBytes += 1;
      },
      /LENGTH/,
    ],
    [
      "wrong hash",
      (copy) => {
        copy.payloadSha256 = "0".repeat(64);
      },
      /SHA256/,
    ],
  ];
  for (const [name, mutate, expected] of cases) {
    const copy = copyEnvelope(original);
    mutate(copy);
    assert.throws(() => decodeWriterTransportEnvelope(copy), expected, name);
  }
});

test("historical manually reconstructed chunk mismatch is hash-visible", () => {
  const bytes = readFileSync("recipe/evidence/button-live-pivot-v2/writer.js");
  const envelope = createWriterTransportEnvelope(bytes);
  assert.ok(envelope.payload.length > 1500);
  const copy = copyEnvelope(envelope);
  const index = 1000;
  copy.payload =
    copy.payload.slice(0, index) +
    (copy.payload[index] === "A" ? "B" : "A") +
    copy.payload.slice(index + 1);
  assert.throws(
    () => decodeWriterTransportEnvelope(copy),
    /WRITER-TRANSPORT-SHA256/,
  );
});

test("wrapper executes only after byte length and SHA-256 verification", async () => {
  const source =
    "globalThis.__transportEvalCount=(globalThis.__transportEvalCount||0)+1;return {ok:true};\n";
  const envelope = createWriterTransportEnvelope(utf8(source));
  const wrapper = createWriterTransportWrapper(envelope);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  globalThis.__transportEvalCount = 0;
  const execute = new AsyncFunction("figma", "globalThis", wrapper) as (
    ...args: unknown[]
  ) => Promise<Record<string, any>>;
  const runtimeGlobal = { TextDecoder, __transportEvalCount: 0 };
  const response = await execute(
    {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      root: { name: "Scratch Project" },
      editorType: "figma",
    },
    runtimeGlobal,
  );
  assert.equal(runtimeGlobal.__transportEvalCount, 1);
  assert.equal(response.transport.evalBegan, true);
  assert.equal(response.transport.evalCompleted, true);
  assert.equal(response.transport.hashImplementation, "verified-js-fallback");
  assert.equal(response.transport.utf8Implementation, "native-text-decoder");
  assert.equal(response.transport.decodedSha256, envelope.payloadSha256);
  assert.deepEqual(response.result, { ok: true });
});

test("staged wrapper verifies the reassembled generated payload before eval", async () => {
  const source =
    "// Unicode survives the verified fallback: α β 😀\n" +
    "globalThis.__transportEvalCount=(globalThis.__transportEvalCount||0)+1;return 7;\n";
  const envelope = createWriterTransportEnvelope(utf8(source));
  const wrapper = createStagedWriterTransportWrapper(envelope);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction("figma", "globalThis", wrapper) as (
    ...args: unknown[]
  ) => Promise<Record<string, any>>;
  const runtimeGlobal = {
    TextDecoder: undefined,
    __recipeTransportV3Payload: envelope.payload,
    __transportEvalCount: 0,
  };
  const response = await execute(
    {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      root: { name: "Scratch Project" },
      editorType: "figma",
    },
    runtimeGlobal,
  );
  assert.equal(response.result, 7);
  assert.equal(response.transport.decodedSha256, envelope.payloadSha256);
  assert.equal(
    response.transport.utf8Implementation,
    "strict-rfc3629-fallback",
  );
  assert.equal(runtimeGlobal.__transportEvalCount, 1);
});

test("wrapper byte changes fail the independent artifact fingerprint", () => {
  const artifact = createWriterTransportArtifact(utf8("return 1;\n"));
  assert.deepEqual(
    validateWriterTransportArtifact(artifact, artifact.wrapperSha256),
    [],
  );
  const changed = {
    ...artifact,
    wrapper: `${artifact.wrapper} `,
  };
  assert.match(
    validateWriterTransportArtifact(changed, artifact.wrapperSha256).join("\n"),
    /WRAPPER-ARTIFACT-SHA256|WRAPPER-LENGTH/,
  );
  assert.match(
    validateWriterTransportArtifact(artifact, "f".repeat(64)).join("\n"),
    /WRAPPER-EXPECTED-SHA256/,
  );
});

declare global {
  var __recipeTransportV3Payload: string | undefined;
  var __transportEvalCount: number;
}
