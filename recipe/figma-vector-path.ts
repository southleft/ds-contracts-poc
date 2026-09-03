/**
 * SVG path → Figma `vectorPaths` grammar.
 *
 * Figma's `vectorPaths` parser accepts a SUBSET of SVG path syntax, and it
 * fails closed with an opaque message when handed anything outside it. Probed
 * directly against the plugin API on 2026-08-31:
 *
 *   accepted   M  L  C  Q  Z      (absolute, uppercase)
 *   rejected   H  V  A            "Failed to convert path. Invalid command at H"
 *   rejected   every relative (lowercase) command
 *
 * That matters because real libraries ship the compact spelling. MUI's checkbox
 * icon is `M19 3H5c-1.11 0-2 .9-2 2v14…` — H, V and relative curves — so the
 * checkbox archetype could not mint at all, and had not been reminted since the
 * compact path landed, so nothing caught it. Its live page still carries an
 * older hand-flattened square that is not the library's geometry.
 *
 * This converts, rather than flattening or hand-editing:
 *   - relative commands to absolute
 *   - H/V to L
 *   - S/T to their explicit C/Q equivalents (reflected control point)
 *   - A is REFUSED by default. An elliptical arc has no exact cubic form.
 *     With `{ arcs: "lower" }` it is lowered to cubic segments of at most 90°
 *     each (the standard endpoint → centre parameterisation, control distance
 *     4/3·tan(θ/4)); the maximum radial error of that form is 2.7e-4 of the
 *     radius per segment, and the lowering is REPORTED, never silent — every
 *     library alert glyph in the corpus is drawn with arcs, and a filled disc
 *     in their place is invented geometry, which is worse than a bounded one.
 *
 * Numbers are emitted with trailing zeros trimmed so the output stays
 * byte-stable across runs.
 */

export class FigmaVectorPathError extends Error {}

type Point = { x: number; y: number };

const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/** Split a path into [command, ...numbers] runs, tolerating compact spelling. */
const tokenize = (d: string): Array<{ cmd: string; args: number[] }> => {
  const out: Array<{ cmd: string; args: number[] }> = [];
  const parts = d.match(/[a-zA-Z][^a-zA-Z]*/g);
  if (!parts) throw new FigmaVectorPathError(`not a path: ${d.slice(0, 40)}`);
  for (const part of parts) {
    const cmd = part[0]!;
    const args = (part.slice(1).match(NUM) ?? []).map(Number);
    out.push({ cmd, args });
  }
  return out;
};

const fmt = (n: number): string => {
  const r = Math.round(n * 1e4) / 1e4;
  return Object.is(r, -0) ? "0" : String(r);
};

/**
 * Convert any SVG path data into the M/L/C/Q/Z absolute subset Figma accepts.
 * Throws `FigmaVectorPathError` rather than emitting geometry it cannot express.
 */
export interface VectorPathLowering {
  command: "A";
  /** Cubic segments emitted for this arc. */
  segments: number;
  /** Upper bound of the radial error, as a fraction of the larger radius. */
  maxRadialErrorFraction: number;
}

export interface ToFigmaVectorPathOptions {
  /** "refuse" (default) throws on elliptical arcs; "lower" converts them. */
  arcs?: "refuse" | "lower";
  /**
   * Close every open subpath with Z. SVG fills an open subpath as if it were
   * closed; Figma's vectorPaths does NOT — an open subpath paints no fill
   * region, so a filled ring drawn as an unclosed contour (MUI's
   * CheckCircleOutline outer ring) vanished from the canvas while the closed
   * check beside it rendered. Exact for filled glyphs; wrong for stroked
   * open paths, so it is opt-in and the checkbox stroke glyph leaves it off.
   */
  closeSubpaths?: boolean;
}

/** Same as `toFigmaVectorPath` but also returns what was lowered. */
export function lowerVectorPath(
  d: string,
  opts: ToFigmaVectorPathOptions = {},
): { d: string; lowerings: VectorPathLowering[] } {
  const lowerings: VectorPathLowering[] = [];
  const out = convert(d, opts, lowerings);
  return { d: out, lowerings };
}

export function toFigmaVectorPath(d: string, opts: ToFigmaVectorPathOptions = {}): string {
  return convert(d, opts, []);
}

/**
 * SVG arc (endpoint parameterisation) → cubic Bézier segments.
 * Implements SVG 1.1 §F.6.5 / F.6.6 exactly, then splits the sweep into
 * segments of at most 90° and emits the standard cubic approximation.
 */
const arcToCubics = (
  from: Point,
  rxIn: number,
  ryIn: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point,
): Array<[Point, Point, Point]> => {
  if (from.x === to.x && from.y === to.y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[from, to, to]]; // degenerate: a line
  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (from.x - to.x) / 2;
  const dy2 = (from.y - to.y) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  // Scale radii up if the arc cannot be drawn with the given ones (F.6.6.2).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2) - 1e-9));
  const delta = dTheta / segments;
  const alpha = (4 / 3) * Math.tan(delta / 4);
  const pointAt = (t: number): Point => ({
    x: cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi,
    y: cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi,
  });
  const derivAt = (t: number): Point => ({
    x: -rx * Math.sin(t) * cosPhi - ry * Math.cos(t) * sinPhi,
    y: -rx * Math.sin(t) * sinPhi + ry * Math.cos(t) * cosPhi,
  });
  const out: Array<[Point, Point, Point]> = [];
  let t = theta1;
  let p0 = from;
  for (let i = 0; i < segments; i++) {
    const t1 = t + delta;
    const p3 = i === segments - 1 ? to : pointAt(t1);
    const d0 = derivAt(t);
    const d1 = derivAt(t1);
    const c1 = { x: p0.x + alpha * d0.x, y: p0.y + alpha * d0.y };
    const c2 = { x: p3.x - alpha * d1.x, y: p3.y - alpha * d1.y };
    out.push([c1, c2, p3]);
    p0 = p3;
    t = t1;
  }
  return out;
};

function convert(d: string, opts: ToFigmaVectorPathOptions, lowerings: VectorPathLowering[]): string {
  const tokens = tokenize(d);
  const out: string[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  // Last control point, for S/T reflection.
  let lastC: Point | null = null;
  let lastQ: Point | null = null;

  let open = false; // a subpath with at least one drawing command since its M
  const emit = (cmd: string, ...pts: number[]): void => {
    if (cmd === "M") {
      if (open && opts.closeSubpaths) out.push("Z");
      open = false;
    } else if (cmd !== "Z") open = true;
    out.push(cmd, ...pts.map(fmt));
  };

  for (const { cmd, args } of tokens) {
    const rel = cmd === cmd.toLowerCase() && cmd !== "Z" && cmd !== "z";
    const up = cmd.toUpperCase();
    const ax = (i: number): number => (rel ? cur.x + args[i]! : args[i]!);
    const ay = (i: number): number => (rel ? cur.y + args[i]! : args[i]!);

    if (up === "A") {
      if (opts.arcs !== "lower") {
        throw new FigmaVectorPathError(
          "elliptical arc (A) has no exact cubic form; refusing to approximate geometry no source declares (pass { arcs: \"lower\" } to lower it with a reported bound)",
        );
      }
      for (let i = 0; i + 6 < args.length; i += 7) {
        const to = { x: ax(i + 5), y: ay(i + 6) };
        const cubics = arcToCubics(
          cur,
          args[i]!,
          args[i + 1]!,
          args[i + 2]!,
          args[i + 3] !== 0,
          args[i + 4] !== 0,
          to,
        );
        for (const [c1, c2, p3] of cubics) emit("C", c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
        lowerings.push({
          command: "A",
          segments: cubics.length,
          // Standard bound for the 4/3·tan(θ/4) cubic on a ≤90° sweep.
          maxRadialErrorFraction: 0.00027,
        });
        cur = to;
      }
      lastC = lastQ = null;
      continue;
    }

    switch (up) {
      case "M": {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const x = rel ? cur.x + args[i]! : args[i]!;
          const y = rel ? cur.y + args[i + 1]! : args[i + 1]!;
          // Only the first pair is a moveto; the rest are implicit linetos.
          emit(i === 0 ? "M" : "L", x, y);
          cur = { x, y };
          if (i === 0) start = { x, y };
        }
        lastC = lastQ = null;
        break;
      }
      case "L": {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const x = rel ? cur.x + args[i]! : args[i]!;
          const y = rel ? cur.y + args[i + 1]! : args[i + 1]!;
          emit("L", x, y);
          cur = { x, y };
        }
        lastC = lastQ = null;
        break;
      }
      case "H": {
        for (const a of args) {
          const x = rel ? cur.x + a : a;
          emit("L", x, cur.y);
          cur = { x, y: cur.y };
        }
        lastC = lastQ = null;
        break;
      }
      case "V": {
        for (const a of args) {
          const y = rel ? cur.y + a : a;
          emit("L", cur.x, y);
          cur = { x: cur.x, y };
        }
        lastC = lastQ = null;
        break;
      }
      case "C": {
        for (let i = 0; i + 5 < args.length; i += 6) {
          const p = [0, 1, 2, 3, 4, 5].map((k) =>
            k % 2 === 0 ? (rel ? cur.x + args[i + k]! : args[i + k]!) : (rel ? cur.y + args[i + k]! : args[i + k]!),
          );
          emit("C", ...p);
          lastC = { x: p[2]!, y: p[3]! };
          cur = { x: p[4]!, y: p[5]! };
          lastQ = null;
        }
        break;
      }
      case "S": {
        for (let i = 0; i + 3 < args.length; i += 4) {
          const c1 = lastC ? { x: 2 * cur.x - lastC.x, y: 2 * cur.y - lastC.y } : { ...cur };
          const c2x = rel ? cur.x + args[i]! : args[i]!;
          const c2y = rel ? cur.y + args[i + 1]! : args[i + 1]!;
          const ex = rel ? cur.x + args[i + 2]! : args[i + 2]!;
          const ey = rel ? cur.y + args[i + 3]! : args[i + 3]!;
          emit("C", c1.x, c1.y, c2x, c2y, ex, ey);
          lastC = { x: c2x, y: c2y };
          cur = { x: ex, y: ey };
          lastQ = null;
        }
        break;
      }
      case "Q": {
        for (let i = 0; i + 3 < args.length; i += 4) {
          const cx = rel ? cur.x + args[i]! : args[i]!;
          const cy = rel ? cur.y + args[i + 1]! : args[i + 1]!;
          const ex = rel ? cur.x + args[i + 2]! : args[i + 2]!;
          const ey = rel ? cur.y + args[i + 3]! : args[i + 3]!;
          emit("Q", cx, cy, ex, ey);
          lastQ = { x: cx, y: cy };
          cur = { x: ex, y: ey };
          lastC = null;
        }
        break;
      }
      case "T": {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const c: { x: number; y: number } = lastQ ? { x: 2 * cur.x - lastQ.x, y: 2 * cur.y - lastQ.y } : { ...cur };
          const ex = rel ? cur.x + args[i]! : args[i]!;
          const ey = rel ? cur.y + args[i + 1]! : args[i + 1]!;
          emit("Q", c.x, c.y, ex, ey);
          lastQ = c;
          cur = { x: ex, y: ey };
          lastC = null;
        }
        break;
      }
      case "Z": {
        out.push("Z");
        open = false;
        cur = { ...start };
        lastC = lastQ = null;
        break;
      }
      default:
        throw new FigmaVectorPathError(`unsupported path command "${cmd}"`);
    }
  }

  if (open && opts.closeSubpaths) out.push("Z");
  const result = out.join(" ").replace(/\s+/g, " ").trim();
  if (!result) throw new FigmaVectorPathError("path converted to nothing");
  if (/[HVAhvasqtmlcz]/.test(result.replace(/[MLCQZ]/g, ""))) {
    throw new FigmaVectorPathError(`converted path still carries an unsupported command: ${result.slice(0, 60)}`);
  }
  return result;
}

/** True when `d` is already inside the accepted subset. */
export const isFigmaVectorPath = (d: string): boolean => {
  const letters = d.match(/[a-zA-Z]/g) ?? [];
  return letters.every((l) => "MLCQZ".includes(l));
};

/** Exact bounding box of an accepted (M/L/C/Q/Z absolute) path by sampling
 *  every curve densely. Deterministic; error ≤ 1e-4 for glyph-sized paths. */
export function vectorPathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const see = (x: number, y: number): void => {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  const STEPS = 64;
  for (const { cmd, args } of tokenize(d)) {
    switch (cmd) {
      case "M": cur = { x: args[0]!, y: args[1]! }; start = cur; see(cur.x, cur.y); break;
      case "L": cur = { x: args[0]!, y: args[1]! }; see(cur.x, cur.y); break;
      case "C": {
        const [x1, y1, x2, y2, x3, y3] = args as [number, number, number, number, number, number];
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS, u = 1 - t;
          see(u*u*u*cur.x + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, u*u*u*cur.y + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3);
        }
        cur = { x: x3, y: y3 }; break;
      }
      case "Q": {
        const [x1, y1, x2, y2] = args as [number, number, number, number];
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS, u = 1 - t;
          see(u*u*cur.x + 2*u*t*x1 + t*t*x2, u*u*cur.y + 2*u*t*y1 + t*t*y2);
        }
        cur = { x: x2, y: y2 }; break;
      }
      case "Z": cur = start; break;
      default: throw new FigmaVectorPathError(`vectorPathBounds wants an accepted path, got "${cmd}"`);
    }
  }
  if (!Number.isFinite(minX)) throw new FigmaVectorPathError("empty path has no bounds");
  return { minX, minY, maxX, maxY };
}

/** Uniformly scale then translate every coordinate of an accepted path:
 *  x' = x·scale + tx. Emits with the same 1e-4 rounding as the converter. */
export function transformVectorPath(d: string, t: { scale?: number; tx?: number; ty?: number }): string {
  const scale = t.scale ?? 1, tx = t.tx ?? 0, ty = t.ty ?? 0;
  const out: string[] = [];
  for (const { cmd, args } of tokenize(d)) {
    if (!"MLCQZ".includes(cmd)) throw new FigmaVectorPathError(`transformVectorPath wants an accepted path, got "${cmd}"`);
    out.push(cmd);
    for (let i = 0; i < args.length; i += 2) out.push(fmt(args[i]! * scale + tx), fmt(args[i + 1]! * scale + ty));
  }
  return out.join(" ");
}

/**
 * Bounding box of the CONTROL-POINT HULL of an accepted path — every M/L/C/Q
 * coordinate, curves included. It contains the true ink box and, for curves
 * whose control points lie on the box (axis-aligned arc quadrants, straight
 * runs), equals it. Its edges are exact coordinates from the path, so
 * translating by them lands on the emitter's 1e-4 grid with no drift, which
 * is what makes a compile → collapse → compile cycle byte-stable.
 */
export function vectorPathHullBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { cmd, args } of tokenize(d)) {
    if (!"MLCQZ".includes(cmd)) throw new FigmaVectorPathError(`vectorPathHullBounds wants an accepted path, got "${cmd}"`);
    for (let i = 0; i + 1 < args.length; i += 2) {
      const x = args[i]!, y = args[i + 1]!;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) throw new FigmaVectorPathError("empty path has no bounds");
  return { minX, minY, maxX, maxY };
}
