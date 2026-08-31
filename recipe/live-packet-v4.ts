import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const ROOT = "recipe/evidence/button-live-pivot-v4";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const bytes = (path: string): Buffer => readFileSync(path);

export function validateLivePacketV4(
  packetInput: unknown,
  keyInput: unknown,
): string[] {
  const failures: string[] = [];
  const packet = packetInput as Record<string, any>;
  const key = keyInput as Record<string, any>;
  if (
    packet?.version !== "button-live-canvas-v4" ||
    packet?.status !== "awaiting-independent-blind-grade" ||
    packet?.protocol?.version !== "button-live-canvas-v4" ||
    packet?.protocol?.cellCount !== 12 ||
    packet?.protocol?.specimenCount !== 12
  ) {
    failures.push("packet version/status/protocol mismatch");
  }
  if (!Array.isArray(packet?.cells) || packet.cells.length !== 12) {
    failures.push("packet must contain exactly 12 cells");
    return failures;
  }
  if (
    /altitude|fluent|adapterIdentity|"variant"|"state"/i.test(
      JSON.stringify(packet),
    )
  ) {
    failures.push("packet leaks sealed source identity");
  }
  const cellIds = new Set<string>();
  const specimenIds = new Set<string>();
  for (const cell of packet.cells) {
    cellIds.add(cell.anonymousCell);
    specimenIds.add(cell.specimen?.anonymousLabel);
    if (
      cell.specimen?.grade?.recognisable !== null ||
      cell.specimen?.grade?.confidence !== null ||
      cell.specimen?.grade?.defects?.length !== 0
    ) {
      failures.push(`${cell.anonymousCell}: packet is already graded`);
    }
    for (const artifact of [cell.reference, cell.specimen]) {
      const path = `${ROOT}/blind-packet/${artifact?.image}`;
      try {
        if (sha256(bytes(path)) !== artifact?.sha256) {
          failures.push(`${artifact?.image}: hash mismatch`);
        }
      } catch {
        failures.push(`${artifact?.image}: artifact missing`);
      }
    }
  }
  if (cellIds.size !== 12 || specimenIds.size !== 12) {
    failures.push("anonymous identifiers must be unique");
  }
  const packetBytes = bytes(`${ROOT}/blind-packet/packet.json`);
  if (
    key?.version !== "button-live-canvas-v4-sealed-key" ||
    key?.status !== "sealed-until-independent-grade" ||
    key?.packetPath !== `${ROOT}/blind-packet/packet.json`
  ) {
    failures.push("sealed key version/status/path mismatch");
  }
  if (key?.packetSha256 !== sha256(packetBytes)) {
    failures.push("sealed key packet hash mismatch");
  }
  if (!Array.isArray(key?.mappings) || key.mappings.length !== 12) {
    failures.push("sealed key must contain exactly 12 mappings");
    return failures;
  }
  if (
    new Set(key.mappings.map((mapping: any) => mapping.anonymousCell)).size !==
      12 ||
    new Set(key.mappings.map((mapping: any) => mapping.anonymousSpecimen))
      .size !== 12
  ) {
    failures.push("sealed mapping must be bijective");
  }
  for (const mapping of key.mappings) {
    const cell = packet.cells.find(
      (candidate: any) => candidate.anonymousCell === mapping.anonymousCell,
    );
    if (!cell || cell.specimen.anonymousLabel !== mapping.anonymousSpecimen) {
      failures.push(`${mapping.anonymousCell}: sealed mapping mismatch`);
      continue;
    }
    try {
      if (
        !bytes(mapping.sourceReferencePath).equals(
          bytes(`${ROOT}/blind-packet/${cell.reference.image}`),
        ) ||
        !bytes(mapping.liveEvidencePath).equals(
          bytes(`${ROOT}/blind-packet/${cell.specimen.image}`),
        )
      ) {
        failures.push(`${mapping.anonymousCell}: copied evidence mismatch`);
      }
    } catch {
      failures.push(`${mapping.anonymousCell}: copied evidence missing`);
    }
  }
  return failures;
}

export function readAndValidateLivePacketV4(): void {
  const packet = JSON.parse(
    readFileSync(`${ROOT}/blind-packet/packet.json`, "utf8"),
  );
  const key = JSON.parse(
    readFileSync(`${ROOT}/sealed-answer-key.json`, "utf8"),
  );
  const failures = validateLivePacketV4(packet, key);
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    "✔ v4 live packet is sealed, ungraded, complete, and tamper-evident",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readAndValidateLivePacketV4();
}
