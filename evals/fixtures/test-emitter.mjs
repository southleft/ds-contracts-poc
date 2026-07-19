/**
 * Test emitter plugin — the emitter-plugin-loads eval's fixture.
 *
 * The Emitter interface (core/emitter.ts) as a foreign module: pure
 * contract+ctx in, file texts out. Registered via `ds-contracts generate
 * --emitter <this file>` (dynamic import + registerEmitter) and directly by
 * the in-process probe. Deterministic on purpose — the eval hashes output.
 */
export default {
  name: 'test-emitter',
  label: 'Contract inventory (eval fixture plugin)',
  emit(contract, ctx) {
    const lines = [
      `${contract.id}@${contract.version} (${contract.name})`,
      `props: ${contract.props.map((p) => p.name).join(', ') || '(none)'}`,
      `contracts in scope: ${ctx.contracts.size}`,
    ];
    return [
      {
        path: `${contract.name.toLowerCase()}.inventory.txt`,
        contents: lines.join('\n') + '\n',
      },
    ];
  },
};
