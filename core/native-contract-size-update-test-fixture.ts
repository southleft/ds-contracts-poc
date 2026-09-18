import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import { prepareNativeContractUpdate } from './native-contract-update.js';

export async function nativeRootSizeUpdateFixture() {
  const f = await nativeComparisonFixture();
  const root = await f.figma.getNodeByIdAsync(f.comparison.parent.creation.variants[0].id);
  const slot = root.children[0];
  // The shared mock measures flex sizes but does not position flex children.
  // Supply the documented centered empty-slot geometry for this test only.
  root.counterAxisAlignItems = 'CENTER';
  f.comparison.parent.component.variants[0].spec.layout!.counter = 'CENTER';
  Object.defineProperty(slot, 'y', { configurable: true, get: () => (root.height - slot.height) / 2 });
  Object.defineProperty(slot, 'relativeTransform', { configurable: true, get: () => [[1,0,slot.x],[0,1,slot.y]] });
  const before = f.comparison.parent, baseline = await f.run(emitNativeContractReadbackScript(before));
  const desired = structuredClone(before.component); desired.variants[0].spec.lits = { height: 36 };
  const input = { before, baseline, desired: { component: desired, revision: revisionOf(desired), tokenInput: before.tokenInput } };
  const { plan } = prepareNativeContractUpdate(input);
  return { ...f, root, slot, input, plan, nodes: [root] };
}
