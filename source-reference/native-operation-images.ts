/** Private diagnostic exports. Image presence never qualifies visual fidelity. */
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { nativeInspectionExports, type NativeInspectionInput } from "../core/native-source-observation.js";

export interface NativeImageSummary {
  caseId: string;
  sha256: string;
  width: number;
  height: number;
  layoutSize?: { width: number; height: number };
}
export interface NativeImageObservation {
  status: "collected" | "unavailable";
  qualification: "unqualified";
  images: NativeImageSummary[];
  problems: string[];
}
export function collectNativeImages(
  input: NativeInspectionInput,
  raw: unknown,
): { observation: NativeImageObservation; bytes: Map<string, Buffer> } {
  return collectExpectedNativeImages(input, nativeInspectionExports(input), raw);
}
export function collectExpectedNativeImages(input: { operation: { id: string; fileKey: string }; planRevision: string },
  expected: Array<{ id: string; instanceId: string }>, raw: unknown): { observation: NativeImageObservation; bytes: Map<string, Buffer> } {
  const unavailable = (problem: string) => ({
    observation: {
      status: "unavailable" as const,
      qualification: "unqualified" as const,
      images: [],
      problems: [problem],
    },
    bytes: new Map<string, Buffer>(),
  });
  try {
    const r = raw as any;
    if (
      !r ||
      r.version !== 1 ||
      r.status !== "native-readback-collected" ||
      r.receiptKind !== "independent-native-component-readback" ||
      r.operationId !== input.operation.id ||
      r.fileKey !== input.operation.fileKey ||
      r.planRevision !== input.planRevision ||
      r.acceptedContract !== null ||
      r.nativeQualification !== "unqualified" ||
      !Array.isArray(r.problems) ||
      r.problems.length
    )
      return unavailable("native-images-readback-unavailable");
    if (!Array.isArray(r.images) || !r.images.length)
      return unavailable("native-images-not-collected");
    if (r.images.length !== expected.length)
      return unavailable("native-images-denominator-mismatch");
    const images: NativeImageSummary[] = [],
      bytes = new Map<string, Buffer>(),
      seen = new Set<string>();
    let total = 0,
      totalPixels = 0;
    for (const image of r.images) {
      const c = expected.find((c: any) => c.id === image?.caseId);
      if (!c || image.nodeId !== c.instanceId || seen.has(c.id))
        return unavailable("native-images-instance-mismatch");
      seen.add(c.id);
      if (
        typeof image.pngBase64 !== "string" ||
        image.pngBase64.length > 1_398_104 ||
        /[^A-Za-z0-9+/=]/.test(image.pngBase64)
      )
        return unavailable("native-images-encoding-invalid");
      const png = Buffer.from(image.pngBase64, "base64");
      total += png.length;
      if (total > 1024 * 1024) return unavailable("native-images-byte-limit");
      if (
        png.toString("base64") !== image.pngBase64 ||
        png.length < 33 ||
        !png
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        png.readUInt32BE(8) !== 13 ||
        png.toString("ascii", 12, 16) !== "IHDR"
      )
        return unavailable("native-images-png-invalid");
      const width = png.readUInt32BE(16),
        height = png.readUInt32BE(20);
      totalPixels += width * height;
      if (!width || !height || totalPixels > 16_777_216)
        return unavailable("native-images-pixel-limit");
      PNG.sync.read(png, { checkCRC: true });
      const sha256 = createHash("sha256").update(png).digest("hex");
      const node = r.nodes?.find((n: any) => n.id === c.instanceId);
      const layoutSize = node && [node.values?.width, node.values?.height].every(v => Number.isFinite(v) && v > 0)
        ? { width: node.values.width, height: node.values.height } : undefined;
      images.push({ caseId: c.id, sha256, width, height, ...(layoutSize ? { layoutSize } : {}) });
      bytes.set(sha256, png);
    }
    return {
      observation: {
        status: "collected",
        qualification: "unqualified",
        images,
        problems: [],
      },
      bytes,
    };
  } catch {
    return unavailable("native-images-png-invalid");
  }
}
