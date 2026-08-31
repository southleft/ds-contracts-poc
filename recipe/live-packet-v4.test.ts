import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateLivePacketV4 } from "./live-packet-v4.js";

const ROOT = "recipe/evidence/button-live-pivot-v4";
const load = () => ({
  packet: JSON.parse(readFileSync(`${ROOT}/blind-packet/packet.json`, "utf8")),
  key: JSON.parse(readFileSync(`${ROOT}/sealed-answer-key.json`, "utf8")),
});

test("v4 live packet validates as sealed and ungraded", () => {
  const { packet, key } = load();
  assert.deepEqual(validateLivePacketV4(packet, key), []);
});

test("v4 live packet planted tampering fails closed", () => {
  const identity = load();
  identity.packet.cells[0].adapterIdentity = "leak";
  assert.match(
    validateLivePacketV4(identity.packet, identity.key).join("\n"),
    /leaks sealed source identity/,
  );

  const graded = load();
  graded.packet.cells[0].specimen.grade.recognisable = true;
  assert.match(
    validateLivePacketV4(graded.packet, graded.key).join("\n"),
    /already graded/,
  );

  const missing = load();
  missing.key.mappings.pop();
  assert.match(
    validateLivePacketV4(missing.packet, missing.key).join("\n"),
    /exactly 12 mappings/,
  );

  const remapped = load();
  remapped.key.mappings[0].anonymousSpecimen = "specimen-tampered";
  assert.match(
    validateLivePacketV4(remapped.packet, remapped.key).join("\n"),
    /sealed mapping mismatch/,
  );
});
