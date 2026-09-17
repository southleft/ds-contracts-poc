import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readReactCallbackInspectionRecord } from "./react-callback-inspection.js";
import { evidenceSha, inventoryEvidence } from "./react-validation-evidence.js";
import type { ReactNativeRequest } from "./react-native-request.js";

test("sealed callback records reopen independently of inventory insertion order and refuse tampering or stale source", () => {
  const root = mkdtempSync(path.join(tmpdir(), "callback-record-")),
    id = randomUUID(),
    dir = path.join(root, id),
    source = path.join(root, "source.tsx");
  mkdirSync(dir);
  writeFileSync(source, "original source");
  const hash = "a".repeat(64),
    anchor: ReactNativeRequest = {
      version: 1,
      kind: "react-root-draft",
      referenceId: hash,
      caseId: "checkbox-unchecked",
      ownership: { id: randomUUID(), sha256: hash },
      inventorySha256: hash,
      matrixRevision: "sha256:" + hash,
    };
  const request = { version: 1 as const, anchor, caseId: "checkbox-unchecked" };
  const report = {
    id,
    caseId: request.caseId,
    phase: "complete",
    sourceUnchanged: true,
    problems: [],
  };
  const save = (file: string, value: unknown) =>
    writeFileSync(path.join(dir, file), JSON.stringify(value));
  try {
    save("request.json", request);
    save("program.json", {
      files: { [source]: evidenceSha(readFileSync(source)) },
    });
    save("report.json", report);
    // Deliberately reverse serialized ordering. The verifier must compare a
    // canonical inventory, including its separately authenticated seal file.
    save("integrity.json", {
      version: 1,
      files: Object.fromEntries(
        Object.entries(inventoryEvidence(dir)).reverse(),
      ),
    });
    writeFileSync(
      path.join(root, "latest.json"),
      JSON.stringify({
        id,
        inventorySha256: evidenceSha(
          readFileSync(path.join(dir, "integrity.json")),
        ),
      }),
    );
    const input = { root, request };
    assert.deepEqual(readReactCallbackInspectionRecord(input), report);
    assert.throws(
      () =>
        readReactCallbackInspectionRecord({
          ...input,
          request: { ...request, caseId: "checkbox-checked" },
        }),
      /evidence-changed/,
    );
    writeFileSync(source, "changed source");
    assert.throws(
      () => readReactCallbackInspectionRecord(input),
      /program-changed/,
    );
    writeFileSync(source, "original source");
    const original = readFileSync(path.join(dir, "report.json"));
    save("report.json", { ...report, sourceUnchanged: false });
    assert.throws(
      () => readReactCallbackInspectionRecord(input),
      /evidence-changed/,
    );
    writeFileSync(path.join(dir, "report.json"), original);
    save("unexpected.json", {});
    assert.throws(
      () => readReactCallbackInspectionRecord(input),
      /evidence-changed/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
