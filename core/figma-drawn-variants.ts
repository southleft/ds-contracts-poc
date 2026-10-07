import { absentVariantAxes, drawnVariantIssues, type Contract } from '../scripts/contract-schema.js';
import { canonicalJson } from './contract-provenance.js';
import { validateDeclaredDrawnProjection, type ExactDumpSet, type ExactProjectionRows } from './exact-projection.js';

/** Generated-set domain readback. The caller must provide the independent
 * authored contract; the raw canvas stamp is an observation, never authority.
 * This proves tuple identity and defaults, not geometry, ink or API behavior. */
export function verifyFigmaDrawnDomain(
  contract: Contract,
  set: ExactDumpSet & { contractId?: string; drawnVariants?: unknown },
  returned?: ExactProjectionRows,
) {
  const domain = contract.bindings.figma.drawnVariants;
  const issues = drawnVariantIssues(contract);
  if (domain === undefined || issues.length)
    throw new Error(`FIGMA_DRAWN_DOMAIN_DECLARATION_REQUIRED: ${issues.join('; ')}`);
  if (set.contractId !== contract.id)
    throw new Error('FIGMA_DRAWN_DOMAIN_IDENTITY_MISMATCH');
  if (canonicalJson(set.drawnVariants) !== canonicalJson(domain))
    throw new Error('FIGMA_DRAWN_DOMAIN_STAMP_MISMATCH');
  const axes = absentVariantAxes(contract);
  const label = (prop: (typeof axes)[number]['prop'], value: string | boolean | null) => {
    if (value === null) throw new Error('FIGMA_DRAWN_DOMAIN_UNSET_UNQUALIFIED');
    return prop.bindings.figma.values?.[String(value)] ?? String(value);
  };
  for (const { prop } of axes) {
    const definition = set.propertyDefinitions?.[prop.bindings.figma.property!] as { defaultValue?: unknown } | undefined;
    if (definition?.defaultValue !== label(prop, prop.default as string | boolean))
      throw new Error('FIGMA_DRAWN_DOMAIN_DEFAULT_MISMATCH: ' + prop.name);
  }
  const declaration = domain.map(tuple => Object.fromEntries(axes.map(({ prop }) =>
    [prop.bindings.figma.property!, label(prop, tuple[prop.name]!)])));
  return validateDeclaredDrawnProjection(set, declaration, returned);
}
