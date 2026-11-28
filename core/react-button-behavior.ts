import { ContractSchema, type Contract } from '../scripts/contract-schema.js';

/** Owned attributes follow caller spreads. Native onClick retains its MouseEvent. */
export function reactButtonBehavior(contract: Contract, codePropOf: (name: string) => string): string[] {
  if (contract.semantics.button === undefined) return [];
  ContractSchema.parse(contract);
  const { prop, states } = contract.semantics.button;
  return [`{...((value: string) => {
        const states: Record<string, {disabled: boolean; busy: boolean}> = JSON.parse(${JSON.stringify(JSON.stringify(states))});
        if (typeof value !== 'string' || !Object.hasOwn(states, value)) throw Error('button-behavior-state-invalid');
        const state = states[value];
        return {type: 'button' as const, disabled: state.disabled, role: undefined,
          'aria-disabled': state.disabled || undefined, 'aria-busy': state.busy || undefined};
      })(${codePropOf(prop)})}`];
}
