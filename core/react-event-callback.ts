import type { Contract, ContractEvent } from '../scripts/contract-schema.js';
import { codeValueLiteral, codeValueUnion } from './code-values.js';

function payloadProp(contract: Contract, event: ContractEvent) {
  if (event.bindings.code.argument !== 'next-value') return undefined;
  const prop = contract.props.find(p => p.name === event.toggles?.prop);
  const values = prop && typeof prop.type === 'object' && 'enum' in prop.type ? prop.type.enum : undefined;
  if (!event.toggles || !prop || !values ||
      event.toggles.between[0] === event.toggles.between[1] ||
      event.toggles.between.some(value => !values.includes(value)))
    throw Error(`REACT_EVENT_NEXT_VALUE_INVALID:${event.name}`);
  return prop;
}

/** The contract's internal axis keys never leak into a typed public callback. */
export function reactEventCallbackType(contract: Contract, event: ContractEvent): string {
  const prop = payloadProp(contract, event);
  return prop ? `(value: ${codeValueUnion(prop)}) => void` : '() => void';
}

export function reactEventCallbackCall(contract: Contract, event: ContractEvent): string {
  const prop = payloadProp(contract, event);
  if (!prop) return `${event.bindings.code.prop}?.();`;
  const [off, on] = event.toggles!.between;
  return `${event.bindings.code.prop}?.(${prop.bindings.code.prop} === ${JSON.stringify(on)} ? ${codeValueLiteral(prop, off)} : ${codeValueLiteral(prop, on)});`;
}
