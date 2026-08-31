import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "./normalize.js";

export const INPUT_LIVE_V3_SCREENSHOT_ROOT =
  "recipe/evidence/input-field-live-pivot-v3/screenshots/live-cells";
export const INPUT_LIVE_V3_SCREENSHOT_MANIFEST =
  "recipe/evidence/input-field-live-pivot-v3/screenshots/manifest.json";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const pngDimensions = (bytes: Buffer): { width: number; height: number } => {
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.subarray(12, 16).toString("ascii") !== "IHDR"
  )
    throw new TypeError("capture is not a complete PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

export function buildInputLiveV3ScreenshotManifest(): Record<string, unknown> {
  const names = readdirSync(INPUT_LIVE_V3_SCREENSHOT_ROOT)
    .filter((name) => name.endsWith(".png"))
    .sort();
  if (names.length !== 128 || new Set(names).size !== 128)
    throw new TypeError(`attempt 3 capture denominator ${names.length}/128`);
  const bundle = createHash("sha256");
  let totalBytes = 0;
  const captures = names.map((name) => {
    if (!/^[a-f0-9]{20}\.png$/.test(name))
      throw new TypeError(`non-canonical capture name ${name}`);
    const artifactPath = `${INPUT_LIVE_V3_SCREENSHOT_ROOT}/${name}`;
    const bytes = readFileSync(artifactPath);
    if (bytes.byteLength === 0)
      throw new TypeError(`zero-byte capture ${artifactPath}`);
    const dimensions = pngDimensions(bytes);
    totalBytes += bytes.byteLength;
    bundle.update(name);
    bundle.update("\0");
    bundle.update(bytes);
    return {
      path: artifactPath,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      ...dimensions,
      disposition: "unscored-hard-failure-evidence",
    };
  });
  return {
    artifactVersion: "input-live-v3-screenshot-manifest-v1",
    attempt: 3,
    count: captures.length,
    totalBytes,
    orderedBundleSha256: bundle.digest("hex"),
    scored: false,
    humanGraded: false,
    reason:
      "host normalization failed before accounting and objective phases; captures are retained without inferred metrics",
    captures,
  };
}

export function validateInputLiveV3ScreenshotManifest(
  manifest: Record<string, any>,
): string[] {
  const failures: string[] = [];
  if (
    manifest.artifactVersion !== "input-live-v3-screenshot-manifest-v1" ||
    manifest.attempt !== 3 ||
    manifest.count !== 128 ||
    manifest.totalBytes <= 0 ||
    manifest.scored !== false ||
    manifest.humanGraded !== false ||
    !/^[a-f0-9]{64}$/.test(manifest.orderedBundleSha256)
  )
    failures.push("attempt 3 screenshot manifest identity/count/disposition");
  const captures = manifest.captures;
  if (
    !Array.isArray(captures) ||
    captures.length !== 128 ||
    new Set(captures.map((capture) => capture.path)).size !== 128 ||
    captures.some(
      (capture) =>
        capture.bytes <= 0 ||
        capture.width <= 0 ||
        capture.height <= 0 ||
        !/^[a-f0-9]{64}$/.test(capture.sha256) ||
        capture.disposition !== "unscored-hard-failure-evidence",
    )
  )
    failures.push("attempt 3 screenshot entries");
  return failures;
}

export function writeInputLiveV3ScreenshotManifest(): void {
  const manifest = buildInputLiveV3ScreenshotManifest();
  writeFileSync(
    INPUT_LIVE_V3_SCREENSHOT_MANIFEST,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const failures = validateInputLiveV3ScreenshotManifest(manifest);
  if (failures.length > 0) throw new TypeError(failures.join("\n"));
  process.stdout.write(
    `${canonicalJson({
      path: INPUT_LIVE_V3_SCREENSHOT_MANIFEST,
      count: manifest.count,
      totalBytes: manifest.totalBytes,
      orderedBundleSha256: manifest.orderedBundleSha256,
    })}\n`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (!process.argv.includes("--write"))
    throw new Error("pass --write to create the v3 screenshot manifest");
  writeInputLiveV3ScreenshotManifest();
}
