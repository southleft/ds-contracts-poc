/** CSS absolute insets use the padding edge. Native coordinates use the
 * outer edge. These conversions neither infer constraints nor round geometry. */
export type BoxInsets = { top: number; right: number; bottom: number; left: number };
export type AbsoluteBox = { x: number; y: number; right: number; bottom: number; width: number; height: number };
export const zeroInsets = (): BoxInsets => ({ top: 0, right: 0, bottom: 0, left: 0 });

export function verifyInsets(insets: BoxInsets): void {
  if (![insets.top, insets.right, insets.bottom, insets.left].every(n => Number.isFinite(n) && n >= 0 && n <= 1e6))
    throw Error('absolute-box-border-unqualified');
}

/** Only real CSS borders move the padding edge. An outline or an inset stroke
 * ring takes no layout space. Bindings are resolved in this compiled plane. */
export function compiledBorderInsets(spec: import('./emit-figma-script.js').NodeSpec,
  number: (name: string) => number | undefined): BoxInsets {
  if (spec.strokeOutside || spec.strokesIncludedInLayout === false) return zeroInsets();
  const value = (field: string, literal: number | undefined, fallback: number) =>
    spec.bindings?.[field] ? number(spec.bindings[field]) : literal ?? fallback;
  const uniform = value('strokeWeight', spec.lits?.strokeWeight, 0);
  const sides = Object.fromEntries((['top', 'right', 'bottom', 'left'] as const).map(side =>
    [side, value('stroke' + side[0].toUpperCase() + side.slice(1) + 'Weight', spec.lits?.strokeSides?.[side], uniform ?? NaN)])) as BoxInsets;
  verifyInsets(sides);
  return sides;
}

/** Native specs always store native coordinates. Synthetic planes already
 * use that basis; callers invoke this only for real CSS-positioned parts. */
export function lowerAbsoluteInsets(spec: import('./emit-figma-script.js').NodeSpec, insets: BoxInsets): void {
  verifyInsets(insets);
  if (Object.values(insets).every(n => n === 0)) return;
  if (spec.insetOverlay) {
    const offsets = spec.insetOffsets ?? zeroInsets();
    spec.insetOffsets = Object.fromEntries((['top', 'right', 'bottom', 'left'] as const)
      .map(side => [side, offsets[side] + insets[side]])) as BoxInsets;
    return;
  }
  const a = spec.absolute;
  if (!a) return;
  if (a.left === undefined && a.right === undefined && insets.left !== insets.right ||
      a.top === undefined && a.bottom === undefined && insets.top !== insets.bottom)
    throw Error('absolute-box-asymmetric-center-unqualified');
  for (const side of ['left', 'right', 'top', 'bottom'] as const)
    if (a[side] !== undefined) a[side] += insets[side];
}

export function cssBoxFromNative<T extends AbsoluteBox>(box: T, insets: BoxInsets): T {
  verifyInsets(insets);
  if (![box.x, box.y, box.right, box.bottom, box.width, box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)
    throw Error('absolute-box-geometry-unqualified');
  return { ...box, x: box.x - insets.left, y: box.y - insets.top,
    right: box.right - insets.right, bottom: box.bottom - insets.bottom };
}

export function nativeBoxFromCss<T extends AbsoluteBox>(box: T, insets: BoxInsets): T {
  verifyInsets(insets);
  if (![box.x, box.y, box.right, box.bottom, box.width, box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)
    throw Error('absolute-box-geometry-unqualified');
  return { ...box, x: box.x + insets.left, y: box.y + insets.top,
    right: box.right + insets.right, bottom: box.bottom + insets.bottom };
}
