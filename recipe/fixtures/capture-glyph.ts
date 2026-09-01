/**
 * Read a glyph the CAPTURE recorded — the library's own SVG as it rendered in
 * Chromium (extract/computed/out/<lib>/<comp>/assets/*.svg) — into the shape
 * an archetype recipe carries. Mechanical: the path `d` and fill-rule come
 * from the file at build time, never transcribed by hand.
 *
 * The asset's `viewBox` attribute is NOT the path's coordinate space: the
 * extractor writes the rendered pixel size there, while the path keeps the
 * package's own units (MUI icons are 24-space, @ant-design/icons-svg is
 * `64 64 896 896`). So the caller names the real viewBox with a citation to
 * the package, and that citation is kept on the glyph.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface CaptureGlyph {
  /** SVG path data exactly as the capture asset carries it. */
  path: string;
  /** The package's coordinate space for that path (cited, not read from the asset). */
  viewBox: { x: number; y: number; width: number; height: number };
  winding: "nonzero" | "evenodd";
  /** Where the path and the viewBox come from. */
  source: { asset: string; viewBoxCitation: string };
}

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export function readCaptureGlyph(
  asset: string,
  viewBox: CaptureGlyph["viewBox"],
  viewBoxCitation: string,
): CaptureGlyph {
  const svg = readFileSync(path.join(REPO, asset), "utf8");
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)];
  if (paths.length !== 1) {
    throw new Error(`${asset}: expected exactly one <path>, found ${paths.length} — a multi-path glyph needs its own carriage`);
  }
  const winding = /fill-rule="evenodd"/.test(paths[0]![0]) ? "evenodd" : "nonzero";
  return { path: paths[0]![1]!, viewBox, winding, source: { asset, viewBoxCitation } };
}
