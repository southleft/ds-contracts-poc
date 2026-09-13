import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { portableGzipEnvelope, portableGzipSync } from "./portable-gzip.js";

test("portableGzipSync removes host OS metadata without changing the payload", () => {
  const input = Buffer.from("design-system-contract-proof\n".repeat(32));
  const compressed = portableGzipSync(input);

  assert.equal(compressed[9], 0xff);
  assert.deepEqual(gunzipSync(compressed), input);
  assert.deepEqual(portableGzipSync(input), compressed);
  const hostStamped = Buffer.from(compressed);
  hostStamped[9] = 19;
  assert.deepEqual(portableGzipEnvelope(hostStamped), compressed);
  assert.equal(hostStamped[9], 19, "normalization must not mutate the source buffer");
});
