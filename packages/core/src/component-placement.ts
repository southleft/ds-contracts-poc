import { walkAnatomy, type Contract, type Prop } from '@ds-contracts/schema';

export function componentPlacementDomain(prop: Prop): Array<string | null> {
  const values = prop.type === 'boolean' ? ['false', 'true'] : typeof prop.type === 'object' && 'enum' in prop.type ? prop.type.enum : [];
  return !prop.required && prop.default === undefined ? [null, ...values] : [...values];
}

/** Offsets have one owner and a complete finite domain. The existing placement
 * referee separately verifies the positioned parent and generated child. */
export function componentPlacementTableErrors(contract: Contract): string[] {
  const errors: string[] = [];
  for (const { name, part } of walkAnatomy(contract)) {
    const table = part.absolutePlacementByCombination;
    if (!table) continue;
    const fail = (reason: string) => errors.push(`${contract.id}: part "${name}" component-absolute-placement-table-${reason}`);
    if (part.absolutePlacement) fail('conflicting-base');
    if (Object.keys(contract.anatomy).length !== 1 || !contract.anatomy.root) fail('single-root-required');
    if (new Set(table.props).size !== table.props.length) fail('duplicate-axis');
    const props = table.props.map(name => contract.props.find(prop => prop.name === name));
    if (props.some(prop => !prop || !(prop.type === 'boolean' || typeof prop.type === 'object' && 'enum' in prop.type) ||
      prop.bindings.figma.kind !== 'VARIANT' || !prop.required && prop.default === undefined && prop.bindings.figma.unsetValue === undefined)) {
      fail('finite-variant-axes-required'); continue;
    }
    const domains = props.map(prop => componentPlacementDomain(prop!));
    const size = domains.reduce((size, domain) => size * domain.length, 1);
    if (!size || size > 64) { fail('domain-too-large'); continue; }
    const tuples = new Set<string>();
    for (const row of table.rows) {
      const key = JSON.stringify(row.values);
      if (tuples.has(key)) fail('duplicate-tuple');
      tuples.add(key);
      if (row.values.length !== domains.length || row.values.some((value, i) => !domains[i]?.includes(value))) fail('unknown-tuple');
    }
    if (tuples.size !== size) fail('incomplete-domain');
  }
  return [...new Set(errors)];
}
