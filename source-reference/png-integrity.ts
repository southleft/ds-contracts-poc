/** Cache only successful format validation for exact image bytes. Callers must
 * still read current files and compare their hashes with their own receipts. */
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
const validated = new Set<string>();
const MAX_ENTRIES = 128;

export function validPngDigest(bytes: Buffer): string {
  if (
    bytes.length < 33 ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR" ||
    !bytes.readUInt32BE(16) ||
    !bytes.readUInt32BE(20) ||
    bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 16_777_216
  )
    throw Error("image-invalid");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!validated.has(digest)) {
    PNG.sync.read(bytes, { checkCRC: true });
    if (validated.size >= MAX_ENTRIES)
      validated.delete(validated.values().next().value!);
    validated.add(digest);
  }
  return digest;
}
