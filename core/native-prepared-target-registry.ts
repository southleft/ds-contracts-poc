/** Fresh operation-only registry. Generic anchor and legacy resolution remains
 * outside this capability; a completed global audit is required for success. */
export function nativePreparedTargetRegistryRuntime(contractIds: readonly string[]): string {
  if (!contractIds.length || contractIds.length > 64 || new Set(contractIds).size !== contractIds.length ||
      contractIds.some(id => typeof id !== 'string' || !id)) throw Error('NATIVE_PREPARED_REGISTRY_IDS_INVALID');
  return `
const nativePreparedExpectedIds = new Set(${JSON.stringify(contractIds)});
const nativePreparedTargets = new Map();
function nativePreparedCheckTarget(entry) {
  const node = entry && entry.node;
  if (!node || node.removed || node.id !== entry.id || node.type !== entry.type ||
      node.parent !== NATIVE_PAGE || node.key !== entry.key ||
      nativeOwnedNodes.get(entry.id) !== node ||
      node.getSharedPluginData('ds_contracts','contractId') !== entry.contractId ||
      node.getSharedPluginData('ds_contracts','nativeSourceOperation') !== nativeOwner ||
      node.getSharedPluginData('ds_contracts','nativeSourceAllocation') !== entry.id)
    nativeRefuse('prepared-target-changed');
  return node;
}
function nativePreparedResolve(ref) {
  const entry = nativePreparedTargets.get(ref.contractId);
  if (!entry) nativeRefuse('prepared-target-unregistered');
  return nativePreparedCheckTarget(entry);
}
function nativePreparedRegister(contract, node) {
  if (!nativePreparedExpectedIds.has(contract.contractId) || nativePreparedTargets.has(contract.contractId)) nativeRefuse('prepared-target-registration');
  const entry = {node, id:node.id, key:node.key, type:contract.isSet ? 'COMPONENT_SET' : 'COMPONENT', contractId:contract.contractId};
  nativePreparedCheckTarget(entry);
  nativePreparedTargets.set(contract.contractId,entry);
}
function nativePreparedAudit(final) {
  nativeFileGuard();
  if ([...nativePreparedExpectedIds].some(id => !id.startsWith('source-native:' + NATIVE.operation.id + ':') || id.length <= ('source-native:' + NATIVE.operation.id + ':').length)) nativeRefuse('prepared-target-scope');
  if (final && nativePreparedTargets.size !== nativePreparedExpectedIds.size) nativeRefuse('prepared-target-incomplete');
  const seen = new Set();
  for (const page of figma.root.children) {
    for (const node of page.findAllWithCriteria({types:['COMPONENT_SET','COMPONENT']})) {
      if (!(node.type === 'COMPONENT_SET' || node.type === 'COMPONENT' && (!node.parent || node.parent.type !== 'COMPONENT_SET'))) continue;
      const contractId = node.getSharedPluginData('ds_contracts','contractId');
      if (!nativePreparedExpectedIds.has(contractId)) continue;
      if (!final || seen.has(contractId)) nativeRefuse('prepared-target-collision');
      const entry = nativePreparedTargets.get(contractId);
      if (!entry || nativePreparedCheckTarget(entry) !== node) nativeRefuse('prepared-target-collision');
      seen.add(contractId);
    }
  }
  if (final && seen.size !== nativePreparedExpectedIds.size) nativeRefuse('prepared-target-incomplete');
}
`;
}
