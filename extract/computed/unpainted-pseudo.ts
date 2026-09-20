import type { Part } from '../../scripts/contract-schema.js';

export type ObservedPseudoBox = {
  width: number; height: number;
  /** Independently observed used position relative to the host padding edge. */
  left: number; top: number;
};

/** Preserve observed, empty absolute boxes without inventing paint or behavior.
 * Missing paint/geometry witnesses refuse. This does not infer that a box is a
 * hit target, reproduce event retargeting, or qualify native interaction. */
export function unpaintedPseudoBox(host: Record<string, string>, style: Record<string, string> | undefined,
  observed?: ObservedPseudoBox): Part | undefined {
  if (!style || !['relative', 'absolute'].includes(host.position) ||
      style.content !== '""' || style.position !== 'absolute' || style.display !== 'block' ||
      style.visibility !== 'visible' || style.opacity !== '1' || style['box-sizing'] !== 'border-box' ||
      !['auto', 'none'].includes(style['pointer-events']) ||
      !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(style['background-color'])) return;
  const absent = ['background-image', 'border-image-source', 'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
    'mask-image', 'transform', 'translate', 'rotate', 'scale', 'animation-name'];
  if (absent.some(key => style[key] !== 'none') || style['outline-style'] !== 'none' ||
      style['clip-path'] !== 'none' || style.clip !== 'auto' || style['mix-blend-mode'] !== 'normal') return;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    if (style[`border-${side}-width`] !== '0px' || style[`padding-${side}`] !== '0px' || style[`margin-${side}`] !== '0px') return;
  }
  const px = (key: string) => /^-?\d+(?:\.\d+)?px$/.test(style[key]) ? Number.parseFloat(style[key]) : NaN;
  const width = observed?.width ?? px('width'), height = observed?.height ?? px('height'),
    left = observed?.left ?? px('left'), top = observed?.top ?? px('top');
  if (![width, height, left, top].every(Number.isFinite) || width <= 0 || height <= 0) return;
  return {
    shape: { kind: 'rect', width, height },
    declared: { position: 'absolute', 'pointer-events': style['pointer-events'], 'box-sizing': 'border-box' },
    literals: { 'background-color': 'transparent', left: `${left}px`, top: `${top}px` },
    description: observed
      ? 'Independently observed unpainted pseudo-element box. Fixed used geometry is relative to the host padding edge; responsive inset ownership, native hit testing and DOM event retargeting are not qualified.'
      : 'Observed unpainted pseudo-element box. CSS offsets and pointer-events are retained; native hit testing and DOM event retargeting are not qualified.',
  };
}
