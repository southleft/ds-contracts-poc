import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = "recipe/evidence/button-live-pivot-v4";
const PACKET = `${ROOT}/blind-packet`;
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const fileHash = (path: string): string => sha256(readFileSync(path));
const verification = JSON.parse(
  readFileSync(`${ROOT}/live-verification.json`, "utf8"),
) as Record<string, any>;
const cells = verification.images.filter(
  (image: Record<string, any>) => image.kind === "paired-cell",
);
if (cells.length !== 12) {
  throw new Error(
    `v4 blind packet requires exactly 12 cells; found ${cells.length}`,
  );
}
mkdirSync(`${PACKET}/references`, { recursive: true });
mkdirSync(`${PACKET}/specimens`, { recursive: true });

const records: Array<{
  sort: string;
  packet: Record<string, any>;
  key: Record<string, any>;
}> = cells
  .map((cell: Record<string, any>) => {
    const source =
      cell.adapterIdentity === "altitude-button-reviewed-v2"
        ? "altitude"
        : cell.adapterIdentity === "fluent-button-reviewed-v2"
          ? "fluent"
          : null;
    if (!source) throw new Error("unknown live cell source");
    const identity = `${source}/${cell.variant}/${cell.state}`;
    const anonymousCell = `cell-${sha256(`v4-cell:${identity}`).slice(0, 12)}`;
    const anonymousSpecimen = `specimen-${sha256(`v4-live:${identity}`).slice(0, 12)}`;
    const referenceSource = `recipe/evidence/button-comparison-v2/source-reference/${source}__variant-${cell.variant}__state-${cell.state}.png`;
    const referenceTarget = `${PACKET}/references/${anonymousCell}.png`;
    const specimenTarget = `${PACKET}/specimens/${anonymousSpecimen}.png`;
    copyFileSync(referenceSource, referenceTarget);
    copyFileSync(cell.path, specimenTarget);
    return {
      sort: sha256(`v4-order:${identity}`),
      packet: {
        anonymousCell,
        reference: {
          image: `references/${anonymousCell}.png`,
          sha256: fileHash(referenceTarget),
        },
        specimen: {
          anonymousLabel: anonymousSpecimen,
          image: `specimens/${anonymousSpecimen}.png`,
          sha256: fileHash(specimenTarget),
          grade: {
            recognisable: null,
            defects: [],
            confidence: null,
          },
        },
      },
      key: {
        anonymousCell,
        anonymousSpecimen,
        adapterIdentity: cell.adapterIdentity,
        variant: cell.variant,
        state: cell.state,
        liveNodeId: cell.nodeId,
        sourceReferencePath: referenceSource,
        liveEvidencePath: cell.path,
      },
    };
  })
  .sort((left: { sort: string }, right: { sort: string }) =>
    left.sort.localeCompare(right.sort),
  );

const packet = {
  version: "button-live-canvas-v4",
  status: "awaiting-independent-blind-grade",
  instructions: [
    "Use only this blind-packet directory; do not inspect parent evidence, source code, or the sealed answer key.",
    "Compare each anonymous live specimen with its source reference.",
    "Set recognisable true or false, list concrete defects for every false result, and record low, medium, or high confidence.",
    "Do not infer implementation identities and do not grade whole-set images.",
  ],
  protocol: {
    version: "button-live-canvas-v4",
    cellCount: records.length,
    specimenCount: records.length,
    sourceReferenceFamily:
      "immutable button-comparison-v2 source-reference bytes",
    liveCapture: "Figma Plugin API exportAsync PNG at 2x",
    passThreshold: "independent recognisable=true for all 12 live specimens",
  },
  randomizedBatchSha256: sha256(
    records.map((record) => record.sort).join("\n"),
  ),
  cells: records.map((record) => record.packet),
};
const packetBytes = `${JSON.stringify(packet, null, 2)}\n`;
writeFileSync(`${PACKET}/packet.json`, packetBytes);
const answerKey = {
  version: "button-live-canvas-v4-sealed-key",
  status: "sealed-until-independent-grade",
  packetPath: `${PACKET}/packet.json`,
  packetSha256: sha256(packetBytes),
  mappings: records.map((record) => record.key),
};
writeFileSync(
  `${ROOT}/sealed-answer-key.json`,
  `${JSON.stringify(answerKey, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    packet: `${PACKET}/packet.json`,
    packetSha256: answerKey.packetSha256,
    cells: records.length,
    sealedKey: `${ROOT}/sealed-answer-key.json`,
  }),
);
