import type { Contract } from '../scripts/contract-schema.js';
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
