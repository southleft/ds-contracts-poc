import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  createStagedWriterTransportWrapper,
  createWriterTransportArtifact,
} from "./writer-transport.js";

const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v3";
const WRITER_PATH = "recipe/evidence/button-live-pivot-v2/writer.js";
const WRITER_SHA256 =
  "336dbf2a0124fbd154c2dcde4013dca0db11a014f09417e83d5950cf181b686f";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const artifactHash = (path: string): string => sha256(readFileSync(path));

const writerBytes = readFileSync(WRITER_PATH);
if (sha256(writerBytes) !== WRITER_SHA256) {
  throw new Error("refusing to transport changed v2 writer bytes");
}
const conformance = await validateFigmaWriterConformance(
  writerBytes.toString("utf8"),
);
if (!conformance.ok) {
  throw new Error(
    `refusing to transport a writer that failed conformance:\n${conformance.failures.join("\n")}`,
  );
}

const transport = createWriterTransportArtifact(writerBytes);
const envelopeBytes = `${JSON.stringify(transport.envelope, null, 2)}\n`;
const payloadChunks = transport.envelope.payload.match(/.{1,4000}/g) ?? [];
const payloadChunksBytes = `${JSON.stringify(payloadChunks, null, 2)}\n`;
const stagedWrapper = createStagedWriterTransportWrapper(transport.envelope);
const planBytes = `${JSON.stringify(
  {
    version: 3,
    kind: "button-recipe-live-transport-plan",
    target: {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      fileName: "Scratch Project",
      editorType: "figma",
    },
    writer: {
      path: WRITER_PATH,
      bytes: writerBytes.byteLength,
      sha256: WRITER_SHA256,
      deterministicRegeneration: "inherited-pass-from-immutable-v2-plan",
      conformanceCounts: conformance.counts,
    },
    transport: {
      protocol: transport.envelope.protocol,
      encoding: transport.envelope.encoding,
      envelopePath: `${EVIDENCE_DIR}/transport-envelope.json`,
      envelopeSha256: transport.envelopeSha256,
      payloadBytes: transport.envelope.payloadBytes,
      payloadSha256: transport.envelope.payloadSha256,
      wrapperPath: `${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`,
      wrapperBytes: transport.wrapperBytes,
      wrapperSha256: transport.wrapperSha256,
      stagedPayloadChunksPath: `${EVIDENCE_DIR}/transport-payload-chunks.json`,
      stagedPayloadChunksSha256: sha256(payloadChunksBytes),
      stagedPayloadChunkCount: payloadChunks.length,
      stagedWrapperPath: `${EVIDENCE_DIR}/writer-staged-wrapper.txt`,
      stagedWrapperBytes: Buffer.byteLength(stagedWrapper),
      stagedWrapperSha256: sha256(stagedWrapper),
      preEvalChecks: [
        "exact Scratch file key/name/editor",
        "protocol and encoding",
        "strict canonical base64",
        "decoded byte length",
        "decoded SHA-256",
        "fatal UTF-8 decode",
      ],
      sha256Implementations: ["WebCrypto", "verified deterministic JS fallback"],
      utf8Implementations: ["TextDecoder", "verified deterministic JS fallback"],
      attempt1: {
        wrapperPath: `${EVIDENCE_DIR}/writer-wrapper.txt`,
        wrapperBytes: 46953,
        wrapperSha256:
          "d7a54125be27c9c4bd3a6bea069a7c72e0f00649ba5d56aadc82887ff37801e3",
        resultPath: `${EVIDENCE_DIR}/live-attempt-1.json`,
        defect: "TextDecoder is unavailable in the live Plugin API sandbox",
        evalBegan: false,
      },
    },
    immutableV1: {
      receiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot/receipt.json",
      ),
      planSha256: artifactHash(
        "recipe/evidence/button-live-pivot/writer-plan.json",
      ),
      writerSha256: artifactHash(
        "recipe/evidence/button-live-pivot/writer.js",
      ),
    },
    immutableV2: {
      receiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/receipt.json",
      ),
      planSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/writer-plan.json",
      ),
      writerSha256: artifactHash(WRITER_PATH),
      transportSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/writer-transport.txt",
      ),
      transportChunksSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/writer-transport-chunks.json",
      ),
      conformanceSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/conformance-report.json",
      ),
    },
    historicalMismatch: {
      boundary: "constructed figma_execute code argument",
      expectedSource:
        "generated writer-transport-chunks.json runtime base64 bytes",
      observedSource:
        "manually reconstructed repeated bridge-call string literals",
      isolatedRange: "[1000,1500)",
      expectedRuntimeFnv1a: "68686350",
      observedRuntimeFnv1a: "c32753a0",
      diskBytesChanged: false,
      evalBegan: false,
      repair:
        "one generated UTF-8 writer payload; decoded length and SHA-256 verified before eval",
    },
  },
  null,
  2,
)}\n`;

mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(`${EVIDENCE_DIR}/transport-envelope.json`, envelopeBytes);
if (
  artifactHash(`${EVIDENCE_DIR}/writer-wrapper.txt`) !==
  "d7a54125be27c9c4bd3a6bea069a7c72e0f00649ba5d56aadc82887ff37801e3"
) {
  throw new Error("v3 attempt-1 wrapper bytes changed");
}
writeFileSync(`${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`, transport.wrapper);
writeFileSync(
  `${EVIDENCE_DIR}/transport-payload-chunks.json`,
  payloadChunksBytes,
);
writeFileSync(`${EVIDENCE_DIR}/writer-staged-wrapper.txt`, stagedWrapper);
writeFileSync(`${EVIDENCE_DIR}/writer-plan.json`, planBytes);

console.log(
  JSON.stringify({
    evidenceDir: EVIDENCE_DIR,
    writerSha256: WRITER_SHA256,
    writerBytes: writerBytes.byteLength,
    payloadSha256: transport.envelope.payloadSha256,
    envelopeSha256: transport.envelopeSha256,
    wrapperSha256: transport.wrapperSha256,
    wrapperBytes: transport.wrapperBytes,
    stagedWrapperSha256: sha256(stagedWrapper),
    stagedWrapperBytes: Buffer.byteLength(stagedWrapper),
    payloadChunks: payloadChunks.length,
    conformanceCounts: conformance.counts,
  }),
);
