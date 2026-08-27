import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import LZString from "lz-string";
import { format } from "prettier";

import { adaptReviewedButton } from "./adapters/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { emitButtonFigmaWriter } from "./interpret.js";
import { hashRecipeInstance } from "./recipe.js";
import { buttonRecipe, compileButtonRecipe } from "./recipes/button.js";

const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v2";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const sources = [
  {
    adapterIdentity: "altitude-button-reviewed-v2",
    displayName: "Altitude",
    contractPath: "examples/altitude/contracts/button.contract.json",
    config: altitudeButtonAdapterConfig,
  },
  {
    adapterIdentity: "fluent-button-reviewed-v2",
    displayName: "Fluent",
    contractPath: "examples/fluent/contracts/button.contract.json",
    config: fluentButtonAdapterConfig,
  },
].map((source) => {
  const contractBytes = readFileSync(source.contractPath);
  const instance = adaptReviewedButton(
    JSON.parse(contractBytes.toString("utf8")),
    source.config,
  );
  const envelope = compileButtonRecipe(instance);
  return {
    ...source,
    contractHash: sha256(contractBytes),
    recipeHash: hashRecipeInstance(buttonRecipe, instance),
    envelope,
  };
});

const writer = emitButtonFigmaWriter(
  sources.map((source) => ({
    adapterIdentity: source.adapterIdentity,
    displayName: source.displayName,
    recipeHash: source.recipeHash,
    envelope: source.envelope,
  })),
);
const writerBytes = `${writer.code}\n`;
const writerHash = sha256(writerBytes);
const status = git("status", "--porcelain=v1");
const conformance = await validateFigmaWriterConformance(writer.code);
if (!conformance.ok) {
  throw new Error(
    `refusing to emit a live writer that failed Plugin API conformance:\n${conformance.failures.join("\n")}`,
  );
}
const conformanceBytes = await format(JSON.stringify(conformance), {
  parser: "json",
});
const lzRuntime = readFileSync(
  "node_modules/lz-string/libs/lz-string.min.js",
  "utf8",
)
  .trim()
  .replaceAll('"', "'");
const packedWriter = [...LZString.compressToUTF16(writerBytes)]
  .map((character) => String.fromCharCode(character.charCodeAt(0) + 0x4e00))
  .join("");
const transportBytes = `${lzRuntime}const __packed='${packedWriter}',__compressed=Array.from(__packed,c=>String.fromCharCode(c.charCodeAt(0)-19968)).join(''),__writer=LZString.decompressFromUTF16(__compressed);if(__writer.length!==${writerBytes.length})throw new Error('WRITER-TRANSPORT-LENGTH');return await eval('(async()=>{'+__writer+String.fromCharCode(10)+'})()');`;
const runtimeBase64 = Buffer.from(lzRuntime).toString("base64");
const transportChunks = {
  runtime: runtimeBase64.match(/.{1,500}/g) ?? [],
  packed: packedWriter.match(/.{1,2000}/gu) ?? [],
};

mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(`${EVIDENCE_DIR}/writer.js`, writerBytes);
writeFileSync(`${EVIDENCE_DIR}/writer-transport.txt`, transportBytes);
writeFileSync(
  `${EVIDENCE_DIR}/writer-transport-chunks.json`,
  `${JSON.stringify(transportChunks, null, 2)}\n`,
);
writeFileSync(`${EVIDENCE_DIR}/conformance-report.json`, conformanceBytes);
writeFileSync(
  `${EVIDENCE_DIR}/writer-plan.json`,
  `${JSON.stringify(
    {
      version: 2,
      kind: "button-recipe-live-writer-plan",
      file: {
        key: "byMp6lt0Ij9b2QbkDGFwBh",
        name: "Scratch Project",
      },
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      writer: {
        path: `${EVIDENCE_DIR}/writer.js`,
        bytes: Buffer.byteLength(writerBytes),
        sha256: writerHash,
        transportPath: `${EVIDENCE_DIR}/writer-transport.txt`,
        transportBytes: Buffer.byteLength(transportBytes),
        transportSha256: sha256(transportBytes),
      },
      pluginApi: {
        typingsPackage: "@figma/plugin-typings",
        typingsVersion: (
          readJson("node_modules/@figma/plugin-typings/package.json") as {
            version: string;
          }
        ).version,
        conformanceReport: `${EVIDENCE_DIR}/conformance-report.json`,
        conformanceReportSha256: sha256(conformanceBytes),
        conformanceCounts: conformance.counts,
      },
      provenance: {
        commit: git("rev-parse", "HEAD"),
        branch: git("branch", "--show-current"),
        dirty: status.length > 0,
        dirtyStatusSha256: sha256(status),
      },
      sources: sources.map((source, index) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        contractPath: source.contractPath,
        contractHash: source.contractHash,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelope.integrity.canonicalHash,
        declaredVariantCount: 144,
        plannedVariantCount: writer.sourcePlans[index]!.cells.length,
        comparedIrFacts: writer.sourcePlans[index]!.comparedIrFacts,
      })),
      grading: {
        status: "ungraded",
        buttonSuccess: false,
        recognisabilityVerdictsAuthoredByBuilder: false,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify({
    evidenceDir: EVIDENCE_DIR,
    writerPath: `${EVIDENCE_DIR}/writer.js`,
    writerHash,
    writerBytes: Buffer.byteLength(writerBytes),
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    sourceVariantCounts: writer.sourcePlans.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      variants: source.cells.length,
      comparedIrFacts: source.comparedIrFacts,
    })),
  }),
);
