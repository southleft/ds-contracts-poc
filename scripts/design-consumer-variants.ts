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
    if (!from.nodeId || !to.nodeId || from.nodeId === to.nodeId) continue;
    const a = images[from.nodeId],
      b = images[to.nodeId];
    const af = frames[from.nodeId],
      bf = frames[to.nodeId];
    if (!a || !b || !af || !bf || !a.equals(b)) continue;
    const hash = imageSha256(a);
    if (hash !== af.pngSha256 || hash !== bf.pngSha256) continue;
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
    if (!ag || !bg || !isDeepStrictEqual(ag, bg)) continue;
    try {
      PNG.sync.read(a, { checkCRC: true });
    } catch {
      continue;
    }
    out.push({
      from: key,
      to: to.key,
      fromNodeId: from.nodeId,
      toNodeId: to.nodeId,
      pngSha256: hash,
      layoutSize: { width: af.layout.width, height: af.layout.height },
    });
  }
  return out;
}
