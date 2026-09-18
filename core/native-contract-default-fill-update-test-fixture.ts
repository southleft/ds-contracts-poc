import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { NATIVE_DEFAULT_FILL } from './native-contract-default-fill-update.js';
import { prepareNativeContractUpdate, type NativeContractUpdateInput } from './native-contract-update.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
export async function nativeDefaultFillUpdateFixture() {
  const f = await nativeUpdateFixture();
  for (const node of f.nodes) node.fills = structuredClone(NATIVE_DEFAULT_FILL);
  const input: NativeContractUpdateInput = structuredClone(f.input);
  input.baseline = await f.run(emitNativeContractReadbackScript(input.before));
  input.desired.component = structuredClone(input.before.component);
  input.desired.tokenInput = structuredClone(input.before.tokenInput);
  return { ...f, input, plan: prepareNativeContractUpdate(input).plan };
}
