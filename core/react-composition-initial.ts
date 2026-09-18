import type { Contract, Part } from '../scripts/contract-schema.js';
import { codeValueLiteral } from './code-values.js';

/** Mount-only forwarding is distinct from controlled component.props. The
 * validator checks domains; public scalar spellings belong to each side. */
export function reactInitialAttributes(parent: Contract, child: Contract, ref: NonNullable<Part['component']>): string {
  return Object.entries(ref.initialProps ?? {}).map(([name, value]) => {
    const target = child.props.find(prop => prop.name === name)!;
    const match = value.match(/^\{([a-z][\w-]*)\}$/);
    const source = match && parent.props.find(prop => prop.name === match[1]);
    const expression = source && typeof source.type === 'object' && 'enum' in source.type
      ? source.type.enum.map(key => `${source.bindings.code.prop} === ${JSON.stringify(key)} ? ${codeValueLiteral(target, key)} : `).join('') + 'undefined'
      : codeValueLiteral(target, value);
    return ` ${target.bindings.code.initial!.prop}={${expression}}`;
  }).join('');
}
