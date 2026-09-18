import type { Contract } from '../scripts/contract-schema.js';

/** Root and nested triggers share the same declared finite-state projection. */
export function reactToggleAria(contract: Contract, event: NonNullable<Contract['events']>[number]): string {
  if (!event.toggles?.aria) return '';
  const prop = contract.props.find(p => p.name === event.toggles!.prop)!;
  const code = prop.bindings.code.prop;
  const [off, on] = event.toggles.between;
  const others = (prop.type as { enum: string[] }).enum.filter(value => value !== off && value !== on);
  const state = others.length
    ? `${code} === '${on}' ? true : ${code} === '${off}' ? false : 'mixed'`
    : `${code} === '${on}'`;
  // Omission without a declared default is not an observed mixed/off state.
  return ` aria-${event.toggles.aria}={${prop.default === undefined ? `${code} === undefined ? undefined : ` : ''}${state}}`;
}
