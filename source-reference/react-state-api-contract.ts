import { ContractSchema, type Contract, type Part } from '../scripts/contract-schema.js';
import { revisionOf } from '../core/contract-provenance.js';
import { emitReactInline } from '../core/emit-react-inline.js';
import type { ReactInitialInspection } from './react-initial-inspection.js';
import type { ReactStateApiInspection } from './react-state-api-inspection.js';
import { validateReactStateApiObservation } from './react-state-api.js';
import type { ReactBehaviorContract } from './react-behavior-contract.js';

/** An authenticated simultaneous-input experiment may add bounded state
 * semantics to its own authenticated appearance draft. It never changes or
 * upgrades the broader callback sweep. The generated consumer is a separate
 * qualification, as are every excluded input and native interaction metadata. */
export function projectReactStateApiContract(initial: ReactInitialInspection, inspection: ReactStateApiInspection): ReactBehaviorContract {
  const result: ReactBehaviorContract = { status: 'refused', problems: [], limitations: [
    'bounded-state-inputs-only', 'excluded-inputs-not-qualified', 'controlled-source-appearance-not-compared',
    'associated-label-composition-not-generated', 'generated-consumer-not-qualified', 'native-behavior-metadata-not-qualified',
  ] };
  try {
    const plan = inspection.plan;
    if (initial.id !== plan.initialObservation || initial.caseId !== plan.caseId || initial.phase !== 'complete' ||
        !initial.sourceUnchanged || initial.problems.length || initial.draft?.status !== 'compiled-draft' || !initial.draft.compiled?.contract || !initial.draft.compiled.tokens ||
        !initial.observation || initial.observation.instanceId !== plan.instanceId ||
        revisionOf(initial.observation.source) !== revisionOf(plan.source) || inspection.phase !== 'complete' ||
        !inspection.sourceUnchanged || inspection.problems.length || !inspection.observation ||
        inspection.restorationChecks !== plan.cases.length * 3) throw Error('state-api-contract-evidence-incomplete');
    validateReactStateApiObservation(inspection.observation, plan);
    const compiled = initial.draft.compiled, contract = structuredClone(initial.draft.compiled.contract);
    const prop = contract.props.find(p => p.bindings.code.prop === plan.initial);
    const mixed = plan.version === 2;
    const values = prop?.bindings.code.values;
    const keys = prop && typeof prop.type === 'object' && 'enum' in prop.type ? prop.type.enum : [];
    const mapped = keys.map(key => values?.[key]);
    if (!prop || (mixed ? plan.role !== 'checkbox' || keys.length !== 3 || !values ||
        [false, true, 'indeterminate'].some(value => mapped.filter(other => other === value).length !== 1) ||
        Object.keys(values).some(key => !keys.includes(key)) : prop.type !== 'boolean' || !!values) ||
        prop.default !== undefined || prop.required || prop.bindings.code.initial || contract.events?.length || contract.bindings.code.runtime ||
        contract.props.some(p => p.bindings.code.prop === plan.controlled) || contract.props.length !== (plan.disabled ? 2 : 1))
      throw Error('state-api-contract-appearance-domain-unavailable');
    if (contract.semantics.element !== 'button' || contract.semantics.role || contract.semantics.roleByProp ||
        contract.semantics.elementByProp || ['aria-checked','role','disabled'].some(key=>Object.hasOwn(contract.anatomy.root.attrs ?? {},key)) ||
        Object.keys(contract.anatomy).length !== 1 || contract.bindings.figma.absentVariants?.length)
      throw Error('state-api-contract-root-semantic-conflict');
    const disabled = plan.disabled && contract.props.find(p => p.bindings.code.prop === plan.disabled);
    if (plan.disabled && (!disabled || disabled.type !== 'boolean' || disabled.default !== undefined || disabled.required ||
        disabled.bindings.code.initial || contract.props.some(p => p !== disabled && p.name === 'disabled')))
      throw Error('state-api-contract-disabled-axis-conflict');
    const oldDisabled = disabled ? disabled.name : undefined;
    // Use the model's native-disabled semantic, preserving the public source
    // spelling. No component, export or source-property name chooses this rule.
    if (disabled) disabled.name = 'disabled';
    const rename = (name: string) => oldDisabled && name === oldDisabled ? 'disabled' : name;
    const visit = (part: Part) => {
      // Child forwarding and dynamic content have their own ownership proof.
      if (part.component || part.slot || part.repeat || part.meter || part.content || part.optional)
        throw Error('state-api-contract-composition-unobserved');
      const references = [part.layoutByProp, part.textByProp, part.textOutOfBox, part.shape?.pathsByProp,
        ...(Array.isArray(part.tokensByProp) ? part.tokensByProp : part.tokensByProp ? [part.tokensByProp] : []),
        ...(part.literalsByProp ?? []), ...(part.statesByProp ?? []), ...(part.stylesWhen ?? []), part.visibleWhen];
      for (const reference of references) if (reference?.prop) reference.prop = rename(reference.prop);
      // Boolean truthiness must become explicit enum membership. Otherwise
      // the canonical string "false" would incorrectly display a truthy part.
      for (const condition of [...(part.stylesWhen ?? []), part.visibleWhen])
        if (!mixed && condition?.prop === prop.name && condition.equals === undefined) condition.equals = 'true';
      if (oldDisabled && oldDisabled !== 'disabled') {
        const tokens = [part.tokens, ...Object.values(part.states ?? {}),
          ...(Array.isArray(part.tokensByProp) ? part.tokensByProp : part.tokensByProp ? [part.tokensByProp] : []).flatMap(e => Object.values(e.map)),
          ...(part.statesByProp ?? []).flatMap(e => Object.values(e.map))];
        for (const map of tokens) if (map) for (const key of Object.keys(map))
          map[key] = map[key].replaceAll('{' + oldDisabled + '}', '{disabled}');
      }
      for (const child of Object.values(part.parts ?? {})) visit(child);
    };
    for (const root of Object.values(contract.anatomy)) visit(root);
    const stateValues = mixed ? values! : { false: false, true: true };
    const keyFor = (value: boolean | 'indeterminate') => {
      const found = Object.keys(stateValues).filter(key => stateValues[key] === value);
      if (found.length !== 1) throw Error('state-api-contract-state-mapping-unavailable');
      return found[0];
    };
    prop.type = { enum: mixed ? keys : ['false', 'true'] };
    prop.bindings.code = { ...prop.bindings.code, prop: plan.controlled, values: stateValues,
      initial: { prop: plan.initial, default: keyFor(plan.defaultValue) } };
    contract.semantics = { ...contract.semantics, role: plan.role,
      roleException: `Independent simultaneous-input observations identify a button-backed ${plan.role}.` };
    contract.events = [{ name: 'stateChange', trigger: 'root', toggles: { prop: prop.name, between: [keyFor(false), keyFor(true)], aria: 'checked' },
      bindings: { code: { prop: plan.callback, argument: 'next-value' } } }];
    contract.id += '-state-api'; contract.name += 'StateApi'; contract.bindings.code.anchors.export = contract.name;
    contract.description = 'Bounded observed checked-state inputs applied to an initial appearance draft. Generated consumer, excluded inputs and native round-trip qualification remain pending.';
    result.contract = ContractSchema.parse(contract);
    result.tsx = emitReactInline(result.contract, { contracts: new Map([[contract.id, result.contract]]), icons: new Map(compiled.assets),
      tokens: { primitives: initial.draft.compiled.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } } }).tsx;
    result.status = 'generated-draft';
  } catch (error) { result.problems.push(error instanceof Error ? error.message : String(error)); }
  return result;
}
