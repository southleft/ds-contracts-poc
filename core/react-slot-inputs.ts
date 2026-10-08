import { literalTextJsx } from './root-content.js';
import { slotsOf, type Contract, type Slot } from '../scripts/contract-schema.js';
import { namedSlots } from '../packages/core/src/anatomy.js';

/** Caller inputs are keyed by slot.name. Several physical parts may consume
 * the same input; the anatomy remains complete in namedSlots / slotsOf. */
export function reactSlotInputs(contract: Contract): Array<{ name: string; descriptions: string[] }> {
  const inputs = new Map<string, { name: string; descriptions: string[] }>();
  for (const { slot, part } of namedSlots(contract)) {
    let input = inputs.get(slot.name);
    if (!input) {
      input = { name: slot.name, descriptions: [] };
      inputs.set(slot.name, input);
    }
    if (part.description && !input.descriptions.includes(part.description)) input.descriptions.push(part.description);
  }
  return [...inputs.values()];
}


export function reactDefaultSlotDependencies(contract: Contract, byId: Map<string, Contract>): string[] {
  return [...new Set(slotsOf(contract).flatMap(({slot}) => slot.renderDefault
    ? (slot.defaultContent ?? []).map(item => {
      const dep = byId.get(item.id);
      if (!dep) throw new Error(`SLOT_DEFAULT_DEPENDENCY_MISSING: ${item.id}`);
      return dep.name;
    }) : []))];
}

/** Samples remain samples unless the contract explicitly opts into a default. */
export function reactSlotExpression(slot: Slot, byId: Map<string, Contract>, attributes: (dep: Contract, props: Record<string, string | boolean>) => string): string {
  const input = slot.name;
  if (!slot.renderDefault) return input;
  const fallback = (slot.defaultContent ?? []).map(item => {
    const dep = byId.get(item.id);
    if (!dep) throw new Error(`SLOT_DEFAULT_DEPENDENCY_MISSING: ${item.id}`);
    const attrs = attributes(dep, item.props ?? {});
    return item.text === undefined ? `<${dep.name}${attrs} />` : `<${dep.name}${attrs}>${literalTextJsx(item.text)}</${dep.name}>`;
  }).join('');
  return `${input} === undefined ? <>${fallback}</> : ${input}`;
}

/** Only inspect transparent React containers. Components are opaque and remain
 * present: calling a component here would violate hooks and render semantics. */
export const REACT_SLOT_CONTENT_RUNTIME = `function __dscSlotHasContent(value: React.ReactNode): boolean {
  if (value == null || typeof value === 'boolean' || value === '') return false;
  if (Array.isArray(value)) return value.some(__dscSlotHasContent);
  if (React.isValidElement<{ children?: React.ReactNode }>(value) && value.type === React.Fragment)
    return __dscSlotHasContent(value.props.children);
  return true;
}

`;
