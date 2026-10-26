export const STROKE_RING_RUNTIME = `/** strokesIncludedInLayout: false — this part's stroke takes no layout space, so it
 *  is painted as an inset ring (over the padding, following the radius) instead
 *  of a border; a real box-shadow is kept after it. A caller's borderColor /
 *  borderWidth restyle the ring and a caller's boxShadow follows it. */
const strokeRing = ({
  border, borderStyle: _style, borderTopStyle: _top, borderRightStyle: _right, borderBottomStyle: _bottom, borderLeftStyle: _left,
  borderWidth: w = 0, borderColor: c = 'currentColor',
  borderTopWidth: t = w, borderRightWidth: r = w, borderBottomWidth: b = w, borderLeftWidth: l = w,
  boxShadow, ...rest
}: CSSProperties, foreground = false, isolate = true, patterned = false): CSSProperties => {
  const px = (v: string | number) => (typeof v === 'number' || /^[-+]?0*\\.?0+$/.test(v) ? \`\${Number(v)}px\` : v);
  if(patterned)return {...rest,position:rest.position??'relative',isolation:'isolate',border:border??0,boxShadow, '--_stroke-width':px(w), '--_stroke-color':c} as CSSProperties;
  const ring = t === r && r === b && b === l
    ? [\`inset 0 0 0 \${px(t)} \${c}\`]
    : [\`inset 0 \${px(t)} 0 0 \${c}\`, \`inset 0 calc(-1 * \${px(b)}) 0 0 \${c}\`, \`inset \${px(l)} 0 0 0 \${c}\`, \`inset calc(-1 * \${px(r)}) 0 0 0 \${c}\`];
  return { ...rest, ...(foreground ? {position: rest.position ?? 'relative',...(isolate?{isolation:'isolate' as const}:{})} : {}), border: border ?? 0, boxShadow: foreground ? boxShadow : [...ring, ...(boxShadow && boxShadow !== 'none' ? [boxShadow] : [])].join(', ') };
};
const strokeRingOverlay = (source: CSSProperties, layer: number): CSSProperties => ({
  display:'block', position:'absolute', inset:0, pointerEvents:'none',
  borderRadius:'inherit', background:'transparent', zIndex:layer,
  boxShadow:strokeRing({...source, boxShadow:undefined}).boxShadow,
});

`;
