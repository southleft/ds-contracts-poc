import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  decodeRfc3629Utf8,
  FIGMA_PORTABLE_RUNTIME,
} from "./figma-runtime-portability.js";
import {
  createWriterTransportEnvelope,
  createWriterTransportWrapper,
} from "./writer-transport.js";

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (
  ...arguments_: string[]
) => (...values: unknown[]) => Promise<any>;

const executePortableDecoder = async (
  TextDecoderCandidate: unknown,
  bytes: Uint8Array,
): Promise<{ value: string; implementation: string }> => {
  const execute = new AsyncFunction(
    "globalThis",
    "bytes",
    `${FIGMA_PORTABLE_RUNTIME}
runtimePreflight();
return runtimeDecodeUtf8(bytes,"TEST-UTF8");`,
  );
  return execute({ TextDecoder: TextDecoderCandidate }, bytes);
};

test("strict RFC 3629 decoder preserves ASCII, NUL, Unicode, and surrogate pairs", () => {
  const expected = "ASCII\0¢€😀����";
  const bytes = Buffer.from(expected, "utf8");
  assert.equal(decodeRfc3629Utf8(bytes), expected);
});

test("strict RFC 3629 decoder names every malformed sequence class", () => {
  const malformed: Array<[number[], RegExp]> = [
    [[0x80], /LEAD-BYTE/],
    [[0xc0, 0x80], /OVERLONG/],
    [[0xe0, 0x80, 0x80], /OVERLONG/],
    [[0xed, 0xa0, 0x80], /SURROGATE/],
    [[0xf4, 0x90, 0x80, 0x80], /OUT-OF-RANGE/],
    [[0xf5, 0x80, 0x80, 0x80], /OUT-OF-RANGE/],
    [[0xe2, 0x28, 0xa1], /CONTINUATION/],
    [[0xe2, 0x82], /TRUNCATED/],
  ];
  for (const [bytes, pattern] of malformed) {
    assert.throws(
      () => decodeRfc3629Utf8(new Uint8Array(bytes), "PLANTED-UTF8"),
      pattern,
    );
  }
});

test("native decoder is selected only after conformance and exact equality", async () => {
  const bytes = Buffer.from("portable α 😀\0", "utf8");
  const native = await executePortableDecoder(TextDecoder, bytes);
  assert.equal(native.value, "portable α 😀\0");
  assert.equal(native.implementation, "native-text-decoder");

  const unavailable = [
    undefined,
    {},
    class ThrowingDecoder {
      constructor() {
        throw new Error("constructor unavailable");
      }
    },
  ];
  for (const candidate of unavailable) {
    const fallback = await executePortableDecoder(candidate, bytes);
    assert.equal(fallback.value, native.value);
    assert.equal(fallback.implementation, "strict-rfc3629-fallback");
  }
});

test("behavior-divergent TextDecoder cannot influence decoded source", async () => {
  const actual = Buffer.from("payload α", "utf8");
  class DivergentDecoder {
    readonly #decoder = new TextDecoder("utf-8", { fatal: true });

    decode(bytes: Uint8Array): string {
      const value = this.#decoder.decode(bytes);
      return bytes === actual ? `${value} altered` : value;
    }
  }
  const decoded = await executePortableDecoder(DivergentDecoder, actual);
  assert.deepEqual(decoded, {
    value: "payload α",
    implementation: "strict-rfc3629-fallback",
  });
});

test("portable SHA-256 matches Node across padding boundaries", async () => {
  const execute = new AsyncFunction(
    "bytes",
    `${FIGMA_PORTABLE_RUNTIME}
runtimePreflight();
return runtimeSha256(bytes);`,
  );
  for (const length of [0, 1, 55, 56, 63, 64, 65, 1_024]) {
    const bytes = Uint8Array.from(
      { length },
      (_, index) => (index * 131) & 255,
    );
    assert.equal(
      await execute(bytes),
      createHash("sha256").update(bytes).digest("hex"),
      `length ${length}`,
    );
  }
});

test("preflight names a missing runtime builtin before writer eval", async () => {
  const execute = new AsyncFunction(
    "DataView",
    `${FIGMA_PORTABLE_RUNTIME}
return runtimePreflight();`,
  );
  await assert.rejects(
    execute(undefined),
    /FIGMA-RUNTIME-UNSUPPORTED:DataView/,
  );
});

test("transport refuses planted malformed UTF-8 before eval without Web APIs", async () => {
  const bytes = new Uint8Array([
    0x72, 0x65, 0x74, 0x75, 0x72, 0x6e, 0xc0, 0x80,
  ]);
  const wrapper = createWriterTransportWrapper(
    createWriterTransportEnvelope(bytes),
  );
  const execute = new AsyncFunction("figma", wrapper);
  await assert.rejects(
    execute({
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      root: { name: "Scratch Project" },
      editorType: "figma",
    }),
    /WRITER-TRANSPORT-UTF8:OVERLONG/,
  );
});
