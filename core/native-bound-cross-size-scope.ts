import { emitNativeTokenBindingScope } from './native-token-binding-scope.js';

export interface NativeBoundCrossSizeScope {
  variableId: string;
  collectionId: string;
  modeId: string;
  channel: 'width' | 'height';
  nodeIds: string[];
}

/** Add an exact, bounded exception to the whole-document consumer scan.
 * The enclosing program provides plan.before and out, loads all pages before
 * this scan, and must recheck all baseline facts before writing without await.
 * No name search, instance consumer, text/style binding or variable alias is
 * permitted by the exception. This function itself grants no write authority. */
export function emitNativeBoundCrossSizeScope(scope: NativeBoundCrossSizeScope): string {
  if (!scope.variableId || !scope.collectionId || !scope.modeId ||
      !['width', 'height'].includes(scope.channel) || !scope.nodeIds.length ||
      new Set(scope.nodeIds).size !== scope.nodeIds.length || scope.nodeIds.some(id => !id))
    throw Error('native-bound-cross-size-scope-invalid');
  return `${emitNativeTokenBindingScope()}
  const crossScope = ${JSON.stringify(scope)};
  const crossRef = value => Array.isArray(value) ? value.some(crossRef)
    : !!value && typeof value === 'object' &&
      (value.type === 'VARIABLE_ALIAS' && value.id === crossScope.variableId || Object.values(value).some(crossRef));
  const crossSeen = new Set();
  const crossVariables = locals.filter(variable => variable.id === crossScope.variableId);
  if(crossVariables.length !== 1 || crossVariables[0].variableCollectionId !== crossScope.collectionId ||
      crossVariables[0].resolvedType !== 'FLOAT' ||
      typeof crossVariables[0].valuesByMode[crossScope.modeId] !== 'number' ||
      !Number.isFinite(crossVariables[0].valuesByMode[crossScope.modeId]))
    throw Error('native-bound-cross-size-variable-unavailable');
  if(locals.some(variable => crossRef(variable.valuesByMode)) || styleBindings.some(crossRef))
    throw Error('native-bound-cross-size-foreign-binding');
  for(const node of liveNodes) {
    // An instance may inherit absolute-child geometry even when it overrides
    // the main component's size binding. Direct variable references alone do
    // not establish the complete set of affected consumers.
    if(node.type === 'INSTANCE') {
      let main;
      try { main = node.mainComponent; }
      catch { throw Error('native-bound-cross-size-instance-scope-unavailable'); }
      if(!main || main.type !== 'COMPONENT' || typeof main.id !== 'string' || !main.id)
        throw Error('native-bound-cross-size-instance-scope-unavailable');
      if(crossScope.nodeIds.includes(main.id))
        throw Error('native-bound-cross-size-instance-consumer');
    }
    const owned = crossScope.nodeIds.includes(node.id);
    let bindings = 'boundVariables' in node ? node.boundVariables : {};
    if(owned) {
      const binding = bindings?.[crossScope.channel];
      if(node.type !== 'COMPONENT' || !binding || Object.keys(binding).length !== 2 ||
          binding.type !== 'VARIABLE_ALIAS' || binding.id !== crossScope.variableId ||
          node.resolvedVariableModes?.[crossScope.collectionId] !== crossScope.modeId)
        throw Error('native-bound-cross-size-consumer-conflict');
      bindings = {...bindings}; delete bindings[crossScope.channel]; crossSeen.add(node.id);
    }
    const fields = ['fills','strokes','effects','layoutGrids','backgrounds',
      ...(node.type === 'VECTOR' ? ['vectorNetwork'] : []),
      ...(node.type === 'INSTANCE' ? ['componentProperties'] : []),
      ...(node.type === 'COMPONENT_SET' || node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET' ? ['componentPropertyDefinitions'] : [])];
    if(crossRef(bindings) || fields.some(field => field in node && crossRef(node[field])) ||
        node.type === 'TEXT' && crossRef(node.getStyledTextSegments(['boundVariables','fills'])))
      throw Error('native-bound-cross-size-foreign-binding');
  }
  if(crossSeen.size !== crossScope.nodeIds.length) throw Error('native-bound-cross-size-consumer-missing');
  out.boundCrossSizeScope = {version:1,variableId:crossScope.variableId,channel:crossScope.channel,
    consumers:[...crossSeen].sort()};`;
}
