/** An unchanged consumer can only be excused when its two source variants are
 * exactly indistinguishable in the recorded paint and layout evidence. This
 * does not prove prop consumption, semantics or interaction behavior. */
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";
import { imageSha256, type FigmaFrame } from "./design-consumer-framing.js";

interface VariantCase {
  key: string;
  nodeId: string;
  interaction: string;
  props: Record<string, unknown>;
  state?: string;
}
export interface SourceEquivalentTransition {
  from: string;
  to: string;
  fromNodeId: string;
  toNodeId: string;
  pngSha256: string;
  layoutSize: { width: number; height: number };
}

export function sourceEquivalentTransitions(
  cases: readonly VariantCase[],
  prop: string,
  target: unknown,
  unchangedKeys: readonly string[],
  images: Readonly<Record<string, Buffer>>,
  frames: Readonly<Record<string, FigmaFrame>>,
): SourceEquivalentTransition[] {
  const out: SourceEquivalentTransition[] = [];
  for (const key of unchangedKeys) {
    const froms = cases.filter((c) => c.key === key);
    if (froms.length !== 1) continue;
    const from = froms[0];
    const targets = cases.filter(
      (c) =>
        c.key !== key &&
        c.interaction === from.interaction &&
        isDeepStrictEqual(c.props, { ...from.props, [prop]: target }),
    );
    if (targets.length !== 1) continue;
    const to = targets[0];
    const pair = equivalentSourcePair(from, to, images, frames);
    if (pair) out.push(pair);
  }
  return out;
}

/** A pointer/keyboard state need not change paint when the designer explicitly
 *  drew the same paint at rest. Reachability and contract-state checks are
 *  separate and remain mandatory. Never infer equality from contract tokens. */
export function sourceEquivalentStateTransitions(
  cases: readonly VariantCase[],
  unchangedKeys: readonly string[],
  images: Readonly<Record<string, Buffer>>,
  frames: Readonly<Record<string, FigmaFrame>>,
): SourceEquivalentTransition[] {
  const out: SourceEquivalentTransition[] = [];
  for (const key of unchangedKeys) {
    const sources = cases.filter(c => c.key === key);
    if (sources.length !== 1) continue;
    const from = sources[0];
    if (!['hover', 'active', 'focus-visible'].includes(from.interaction) || from.state !== from.interaction) continue;
    const targets = cases.filter(c => c.key !== key && c.state === undefined && c.interaction === 'none' && isDeepStrictEqual(c.props, from.props));
    if (targets.length !== 1) continue;
    const to = targets[0];
    // This new adjudication requires explicitly collected full-bounds images;
    // old receipts do not acquire stronger evidence by being reinterpreted.
    if ([from, to].some(c => frames[c.nodeId]?.raster?.kind !== 'figma-rest-full-bounds-v1' || frames[c.nodeId]?.raster?.scale !== 1)) continue;
    const pair = equivalentSourcePair(from, to, images, frames);
    if (pair) out.push(pair);
  }
  return out;
}

function equivalentSourcePair(
  from: VariantCase,
  to: VariantCase,
  images: Readonly<Record<string, Buffer>>,
  frames: Readonly<Record<string, FigmaFrame>>,
): SourceEquivalentTransition | null {
    if (!from.nodeId || !to.nodeId || from.nodeId === to.nodeId) return null;
    const a = images[from.nodeId],
      b = images[to.nodeId];
    const af = frames[from.nodeId],
      bf = frames[to.nodeId];
    if (!a || !b || !af || !bf || !a.equals(b)) return null;
    if (!isDeepStrictEqual(af.raster, bf.raster)) return null;
    const hash = imageSha256(a);
    if (hash !== af.pngSha256 || hash !== bf.pngSha256) return null;
    const geometry = (f: FigmaFrame) => {
      if (
        ![f.layout, f.render].every(
          (box) =>
            box &&
            [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
            box.width > 0 &&
            box.height > 0,
        )
      )
        return null;
      return [
        f.layout.width,
        f.layout.height,
        f.render.x - f.layout.x,
        f.render.y - f.layout.y,
        f.render.width,
        f.render.height,
      ];
    };
    const ag = geometry(af),
      bg = geometry(bf);
    if (!ag || !bg || !isDeepStrictEqual(ag, bg)) return null;
    try {
      PNG.sync.read(a, { checkCRC: true });
    } catch {
      return null;
    }
    return {
      from: from.key,
      to: to.key,
      fromNodeId: from.nodeId,
      toNodeId: to.nodeId,
      pngSha256: hash,
      layoutSize: { width: af.layout.width, height: af.layout.height },
    };
}
