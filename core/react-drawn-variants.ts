import { absentVariantAxes, drawnVariantIssues, type Contract } from '../scripts/contract-schema.js';

/** Resolve against the emitter's canonical, post-default/post-state locals.
 * Inputs are evaluated outside the callback scopes, so an authored binding
 * cannot shadow a generated callback parameter. No inferred combination is
 * permitted and no object/string/boolean coercion is used. */
export function reactDrawnVariantGuard(contract: Contract, codePropOf: (name: string) => string): string[] {
  const domain = contract.bindings.figma.drawnVariants;
  if (domain === undefined) return [];
  const issues = drawnVariantIssues(contract);
  if (issues.length) throw new Error(issues.join('\n'));
  const axes = absentVariantAxes(contract);
  const rows = domain.map(tuple => axes.map(axis => tuple[axis.prop.name]));
  const inputs = axes.map(axis => codePropOf(axis.prop.name)).join(', ');
  // A structured thrown value needs no global constructor and remains safe
  // when an authored code binding shadows a generated callback name or a global.
  const failure = JSON.stringify({ name: 'DrawnVariantDomainError', code: 'DRAWN_VARIANT_UNDECLARED', message: `Undeclared variant combination: ${contract.id}`, contractId: contract.id });
  return [`  if (!((values: readonly unknown[]) => (${JSON.stringify(rows)} as Array<Array<string | boolean | null>>).some(tuple => tuple.every((value, axis) => values[axis] === value)))([${inputs}])) throw ${failure};`];
}
