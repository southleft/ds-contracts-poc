/** Whole-document refusal check for versioned variable-value update plans.
 * Sync Runner uses static document access: after loading every page and the
 * final asynchronous variable read, synchronous registries and node getters
 * leave no await between discovery of consumers and the guarded assignments.
 * Other plugin modes or incomplete/oversized scopes refuse before any write. */
export function emitNativeTokenBindingScope(): string {
  return `  await figma.variables.getLocalVariablesAsync();
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  if (figma.skipInvisibleInstanceChildren !== false || typeof figma.variables.getLocalVariables !== 'function')
    throw Error('native-update-document-scope-unavailable');
  const locals = figma.variables.getLocalVariables();
  if (!Array.isArray(locals)) throw Error('native-update-token-api-unavailable');
  const styleBindings = [];
  for (const method of ['getLocalPaintStyles', 'getLocalTextStyles', 'getLocalEffectStyles', 'getLocalGridStyles']) {
    if (typeof figma[method] !== 'function') throw Error('native-update-document-scope-unavailable');
    const styles = figma[method]();
    if (!Array.isArray(styles)) throw Error('native-update-document-scope-unavailable');
    for (const style of styles) styleBindings.push(['boundVariables', 'paints', 'effects', 'layoutGrids'].filter(field => field in style).map(field => style[field]));
  }
  if (!figma.root.children.some(node => node.type === 'PAGE' && node.id === plan.before.creation.pageId)) throw Error('native-update-page-missing');
  const liveNodes = [], bindingValues = [], stack = [...figma.root.children];
  while (stack.length) {
    if (liveNodes.length >= 10000) throw Error('native-update-scope-too-large');
    const node = stack.pop();
    liveNodes.push(node);
    if ('children' in node) stack.push(...node.children);
    const fields = ['boundVariables', 'fills', 'strokes', 'effects', 'layoutGrids', 'backgrounds',
      ...(node.type === 'VECTOR' ? ['vectorNetwork'] : []),
      ...(node.type === 'INSTANCE' ? ['componentProperties'] : []),
      ...(node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET') ? ['componentPropertyDefinitions'] : [])];
    bindingValues.push(fields.filter(field => field in node).map(field => node[field]));
    if (node.type === 'TEXT') {
      if (typeof node.getStyledTextSegments !== 'function') throw Error('native-update-document-scope-unavailable');
      bindingValues.push(node.getStyledTextSegments(['boundVariables', 'fills']));
    }
  }
  out.bindingScope = { version: 'document-v1', pages: figma.root.children.length, nodes: liveNodes.length };`;
}
