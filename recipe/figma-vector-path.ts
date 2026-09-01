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
 *   - A is REFUSED by name. An elliptical arc has no exact cubic form, and
 *     silently approximating one would put geometry on the canvas that no
 *     source declares. Nothing in the current corpus uses it.
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
export function toFigmaVectorPath(d: string): string {
  const tokens = tokenize(d);
  const out: string[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  // Last control point, for S/T reflection.
  let lastC: Point | null = null;
  let lastQ: Point | null = null;

  const emit = (cmd: string, ...pts: number[]): void => {
    out.push(cmd, ...pts.map(fmt));
  };

  for (const { cmd, args } of tokens) {
    const rel = cmd === cmd.toLowerCase() && cmd !== "Z" && cmd !== "z";
    const up = cmd.toUpperCase();
    const ax = (i: number): number => (rel ? cur.x + args[i]! : args[i]!);
    const ay = (i: number): number => (rel ? cur.y + args[i]! : args[i]!);

    if (up === "A") {
      throw new FigmaVectorPathError(
        "elliptical arc (A) has no exact cubic form; refusing to approximate geometry no source declares",
      );
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
          const c = lastQ ? { x: 2 * cur.x - lastQ.x, y: 2 * cur.y - lastQ.y } : { ...cur };
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
        cur = { ...start };
        lastC = lastQ = null;
        break;
      }
      default:
        throw new FigmaVectorPathError(`unsupported path command "${cmd}"`);
    }
  }

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
