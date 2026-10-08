/** Shared native paint writer, emitted only when a compiled draft carries paint.
 * Literal colour/alpha/blend were validated by solidFillCompositionPaint.
 * Node opacity and blend mode belong to the enclosing node, not this fill. */
export const SOLID_FILL_COMPOSITION_NATIVE_RUNTIME = `function applySolidFillComposition(node, spec) {
  if (!spec.solidFillComposition) return;
  if (!('fills' in node)) throw new Error('solid-fill-composition-native-host-unqualified');
  const paint = spec.solidFillComposition;
  node.fills = [{type:'SOLID',color:{r:paint.color.r,g:paint.color.g,b:paint.color.b},opacity:paint.opacity,blendMode:paint.blendMode}];
}`;

/** Internal qualification runtime. A variable-bound native fill normalizes
 * paint blending to NORMAL, so blending belongs on a separate paint-only
 * rectangle. Call after content construction; never blend the content host.
 * Public compilation remains fenced until the generated layer has readback. */
export const BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME = `const boundSolidFillLayers = [];
function settleBoundSolidFillLayers(root) {
  for (const entry of boundSolidFillLayers) {
    const host = entry.host, layer = entry.layer;
    if (host.removed || layer.removed) continue;
    let owner = host;
    while (owner && owner !== root) owner = owner.parent;
    if (!owner) continue;
    if (layer.parent !== host || !(host.width > 0 && host.height > 0))
      throw new Error('bound-solid-fill-layer-final-owner');
    // Native auto-layout can allocate fractional host widths after insertion.
    // STRETCH constraints alone round the absolute rectangle to whole pixels.
    layer.resizeWithoutConstraints(host.width, host.height);
    layer.x = 0; layer.y = 0;
    if (layer.width !== host.width || layer.height !== host.height)
      throw new Error('bound-solid-fill-layer-final-size');
  }
}
function applyBoundSolidFillLayer(node, spec, variable, own) {
  const paint = spec.solidFillComposition, tokenPath = spec.solidFillCompositionToken;
  if (!paint || !['NORMAL','MULTIPLY'].includes(paint.blendMode) ||
      typeof tokenPath !== 'string' || !/^[a-z0-9-]+(?:\\.[a-z0-9-]+)*$/i.test(tokenPath))
    throw new Error('bound-solid-fill-layer-spec-unqualified');
  if (!['FRAME','COMPONENT'].includes(node.type) || !('insertChild' in node) ||
      !(node.width > 0 && node.height > 0) || node.layoutMode === 'GRID')
    throw new Error('bound-solid-fill-layer-host-unqualified');
  if (!variable || variable.resolvedType !== 'COLOR')
    throw new Error('bound-solid-fill-layer-variable-unqualified');
  const selected = variable.resolveForConsumer(node);
  const value = selected && selected.value;
  if (!value || selected.resolvedType !== 'COLOR' ||
      ['r','g','b'].some(k => Math.fround(value[k]) !== paint.color[k]) ||
      Math.fround(value.a === undefined ? 1 : value.a) !== paint.opacity)
    throw new Error('bound-solid-fill-layer-selected-value-disagreement');
  const name = '[ds-contracts bound paint]';
  if (node.children.some(child => child.name === name))
    throw new Error('bound-solid-fill-layer-already-present');
  const width = node.width, height = node.height;
  const layer = figma.createRectangle();
  if (own) own(layer);
  layer.name = name;
  layer.resize(width, height);
  // A native fill paints below every content child, including reversed stacks.
  const reverse = node.layoutMode !== 'NONE' && node.itemReverseZIndex === true;
  node.insertChild(reverse ? node.children.length : 0, layer);
  if (node.layoutMode !== 'NONE') layer.layoutPositioning = 'ABSOLUTE';
  layer.x = 0; layer.y = 0;
  layer.constraints = {horizontal:'STRETCH',vertical:'STRETCH'};
  for (const corner of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])
    if (typeof node[corner] === 'number') layer[corner] = node[corner];
  if (typeof node.cornerSmoothing === 'number') layer.cornerSmoothing = node.cornerSmoothing;
  layer.fills = [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0},opacity:1},'color',variable)];
  layer.blendMode = paint.blendMode;
  // Variable alpha is already in the resolved paint. Never multiply it again.
  layer.opacity = 1;
  node.fills = [];
  boundSolidFillLayers.push({host:node,layer});
  return layer;
}`;
