/** A separate, bounded observation of a checked-state API. A failed broad
 * candidate sweep stays failed; its uniquely observed relationships may only
 * propose the inputs for these new, independently restored experiments. */
import { reactStateApiAppearance } from './react-state-api-appearance.js';
import type { Page } from 'playwright-core';
import type { ReactInitialInspection } from './react-initial-inspection.js';
import type { ReactCallbackInspection } from './react-callback-inspection.js';
import type { ReactSourceProgram } from './react-source-program.js';
import { reactOwnershipRead, type ReactOwnership } from './react-ownership.js';
import { checkedToggleRole, type CheckedToggleRole } from './control-behavior.js';
import { revisionOf } from '../core/contract-provenance.js';
import { probeReactInitialProperties, probeReactProperties, type ReactPropertyChanges, type ReactCallbackObservation } from './react-property-probe.js';

type StateValue = boolean | 'indeterminate';
type Control = { checked: 'false' | 'true' | 'mixed'; disabled: boolean };
const checkedValue = (value: unknown) => value === 'indeterminate' ? 'mixed' : String(value);
const stateDomain = (version: number): StateValue[] => version === 2 ? [false, true, 'indeterminate'] : [false, true];
export interface ReactStateApiPlan {
  version: 1 | 2;
  qualification: 'bounded-checked-state-api-only';
  initialObservation: string;
  callbackObservation: string;
  caseId: string;
  instanceId: string;
  source: ReactOwnership['components'][number]['source'];
  rootPath: string;
  role: CheckedToggleRole;
  callback: string;
  controlled: string;
  initial: string;
  defaultValue: StateValue;
  disabled?: string;
  excludedInputs: string[];
  cases: Array<{ id: string; changes: ReactPropertyChanges }>;
}

/** This plans another observation, never a generated behavior or a successful
 * relabeling of the broad report. The host must authenticate both input records
 * and pin this plan before executing it against the same original source. */
export function planReactStateApi(initial: ReactInitialInspection, behavior: ReactCallbackInspection): ReactStateApiPlan {
  const appearance = reactStateApiAppearance(initial).contract, observed = behavior.observation;
  if (initial.phase !== 'complete' || !initial.sourceUnchanged || initial.problems.length ||
      !initial.observation ||
      !behavior.sourceUnchanged || !['complete', 'failed'].includes(behavior.phase) || !observed ||
      initial.caseId !== behavior.caseId || initial.instanceId !== behavior.instanceId)
    throw Error('state-api-source-evidence-incomplete');
  const target = observed.target, role = checkedToggleRole(observed.role);
  if (!target || !role || target.instanceId !== initial.observation.instanceId ||
      revisionOf(target.source) !== revisionOf(initial.observation.source) ||
      (target.rootPath !== '' && !/^\d+(?:\.\d+)*$/.test(target.rootPath)))
    throw Error('state-api-source-target-unqualified');
  // Broad role, source, instrument and restoration failures cannot propose a
  // narrower run. Only the explicitly restored, identified input refusals may.
  const refusals = observed.refusals ?? [];
  if (behavior.phase === 'failed' && (revisionOf(behavior.problems) !== revisionOf(['callback-observation-incomplete']) ||
      !refusals.length || revisionOf(observed.problems) !== revisionOf(refusals.map(r => r.problem)) ||
      refusals.some(r => ![
        'react-property-probe-render-unqualified:react-ownership-selected-root-missing',
        'react-initial-probe-render-unqualified:react-ownership-selected-root-missing',
        'callback-focus-mismatch',
      ].includes(r.problem)))) throw Error('state-api-broad-observation-not-restored');
  if (behavior.phase === 'complete' && (behavior.problems.length || observed.problems.length || refusals.length))
    throw Error('state-api-broad-observation-inconsistent');
  const controlled = observed.relationships.filter(r => r.status === 'controlled-observed');
  const seeds = observed.relationships.filter(r => r.status === 'initial-only-observed');
  if (controlled.length !== 1 || seeds.length !== 1 || controlled[0].callback !== seeds[0].callback || controlled[0].property === seeds[0].property)
    throw Error('state-api-relationships-ambiguous');
  const control = controlled[0], seed = seeds[0];
  const candidates = observed.candidates.filter(c => c.callback === control.callback && c.status === 'needs-observation');
  const candidate = candidates[0];
  const mixed = role === 'checkbox' && candidate?.values?.length === 3 && candidate.values.includes('indeterminate');
  const values = stateDomain(mixed ? 2 : 1);
  if (candidates.length !== 1 || !candidate.values || candidate.values.length !== values.length ||
      !values.every(value => candidate.values!.includes(value)) ||
      new Set(candidate.stateProperties).size !== candidate.stateProperties.length ||
      ![control.property, seed.property].every(p => candidate.stateProperties.includes(p)))
    throw Error('state-api-boolean-domain-required');
  for (const property of [control.property, seed.property]) {
    const rows = observed.rows.filter(r => r.callback === control.callback && r.property === property);
    if (rows.length !== values.length * 2 || new Set(rows.map(r => r.action + ':' + r.value)).size !== values.length * 2 ||
        rows.some(r => !['space', 'associated-label'].includes(r.action) || !values.includes(r.value as StateValue) ||
          !r.restored || r.initial.disabled || r.live.disabled || r.initial.inert || r.live.inert || r.initial.checked !== checkedValue(r.value) || r.steps.length !== 2 ||
          (property === control.property && r.live.checked !== r.initial.checked) ||
          r.steps.some((step, index) => {
            const prior = property === control.property || index === 0 ? r.initial.checked : r.steps[index - 1].control.checked;
            const next = prior !== 'true';
            return step.control.disabled || step.control.inert || step.control.checked !== (property === control.property ? r.initial.checked : String(next)) ||
              step.callback.problems.length || step.callback.calls.length !== index + 1 ||
              revisionOf(step.callback.calls[index]) !== revisionOf([next]) ||
              (index > 0 && revisionOf(step.callback.calls.slice(0, index)) !== revisionOf(r.steps[index - 1].callback.calls));
          }))) throw Error('state-api-relationship-rows-unverified');
    if (property === seed.property && new Set(rows.map(r => r.live.checked)).size !== 1)
      throw Error('state-api-initial-only-unverified');
  }
  const seedProp = appearance.props.find(p => p.bindings.code.prop === seed.property);
  const appearanceValues = seedProp && typeof seedProp.type === 'object' && 'enum' in seedProp.type
    ? seedProp.type.enum.map(key => seedProp.bindings.code.values?.[key]) : [];
  if (!seedProp || (mixed ? appearanceValues.length !== values.length || !values.every(value => appearanceValues.includes(value))
      : seedProp.type !== 'boolean') || seedProp.required || seedProp.bindings.code.initial ||
      appearance.props.some(p => p.bindings.code.prop === control.property))
    throw Error('state-api-appearance-domain-unavailable');
  const omittedValue = (property: string, domain: StateValue[] = [false, true]): StateValue => {
    const omissions = initial.observation!.rows.filter(r => r.changes[property]?.kind === 'omit');
    const equivalent = domain.filter(value => omissions.length && omissions.every(row => {
      const changes = { ...row.changes, [property]: { kind: 'set', value } };
      const explicit = initial.observation!.rows.find(other => revisionOf(other.changes) === revisionOf(changes));
      return explicit?.status === 'observed' && explicit.restored && row.status === 'observed' && row.restored &&
        explicit.image === row.image && explicit.treeSha256 === row.treeSha256;
    }));
    if (equivalent.length !== 1) throw Error('state-api-omitted-value-unverified');
    return equivalent[0];
  };
  const defaultValue = omittedValue(seed.property, values);
  const others = appearance.props.filter(p => p !== seedProp);
  let disabled: string | undefined;
  if (others.length > 1) throw Error('state-api-additional-appearance-inputs-unobserved');
  if (others.length) {
    const prop = others[0], property = prop.bindings.code.prop;
    const rows = observed.rows.filter(r => r.callback === control.callback && r.property === property);
    // A three-state callback's type does not include a Boolean-only input.
    // The new plan proposes that sole appearance input for independent testing;
    // no disabled behavior is admitted until the full matrix verifies it.
    const unobservedBooleanCandidate = mixed && rows.length === 0 && !candidate.stateProperties.includes(property);
    if (prop.type !== 'boolean' || prop.required || prop.bindings.code.initial || (!unobservedBooleanCandidate && (rows.length !== 4 ||
        new Set(rows.map(r => r.action + ':' + r.value)).size !== 4 ||
        rows.some(r => typeof r.value !== 'boolean' || !r.restored || r.initial.inert || r.live.inert || r.initial.disabled !== r.value ||
          r.live.disabled !== r.value || r.steps.length !== 2 || r.steps.some(step =>
            step.control.inert || step.control.disabled !== r.value || step.callback.problems.length ||
            (r.value && (step.control.checked !== r.initial.checked || step.callback.calls.length)))))))
      throw Error('state-api-disabled-input-unverified');
    if (omittedValue(property)) throw Error('state-api-disabled-default-unsupported');
    disabled = property;
  }
  const selected = [control.property, seed.property, ...(disabled ? [disabled] : [])];
  if (refusals.some(r => r.callback !== control.callback || !candidate.stateProperties.includes(r.property) ||
      !candidate.values!.includes(r.value) || selected.includes(r.property)))
    throw Error('state-api-selected-input-refused');
  const cases: ReactStateApiPlan['cases'] = [];
  for (const held of [undefined, ...values]) for (const start of [undefined, ...values])
    for (const stopped of disabled ? [undefined, false, true] : [undefined]) {
      const values: Record<string, StateValue | undefined> = { [control.property]: held, [seed.property]: start, ...(disabled ? { [disabled]: stopped } : {}) };
      cases.push({ id: String(cases.length), changes: Object.fromEntries([...candidate.stateProperties, ...(disabled && !candidate.stateProperties.includes(disabled) ? [disabled] : [])].map(property =>
        [property, values[property] === undefined ? { kind: 'omit' } : { kind: 'set', value: values[property]! }])) });
    }
  return { version: mixed ? 2 : 1, qualification: 'bounded-checked-state-api-only', initialObservation: initial.id,
    callbackObservation: behavior.id, caseId: initial.caseId, instanceId: target.instanceId, source: structuredClone(target.source),
    rootPath: target.rootPath, role, callback: control.callback, controlled: control.property, initial: seed.property,
    defaultValue, ...(disabled ? { disabled } : {}), excludedInputs: candidate.stateProperties.filter(p => !selected.includes(p)), cases };
}

export interface ReactStateApiObservation {
  version: 1 | 2;
  qualification: 'bounded-checked-state-api-only';
  plan: ReactStateApiPlan;
  rows: Array<{ id: string; action: 'space' | 'associated-label'; initial: Control;
    live: { before: Control; changed: Control }; steps: Array<{ control: Control; callback: ReactCallbackObservation }>; restored: true }>;
  problems: string[];
}

/** Authenticate the complete observation's meaning when reopening it, rather
 * than trusting a success label or a count of rows. */
export function validateReactStateApiObservation(observation: ReactStateApiObservation, plan: ReactStateApiPlan): void {
  if (![1, 2].includes(plan.version) || (plan.version === 2 && plan.role !== 'checkbox') ||
      observation.version !== plan.version || observation.qualification !== 'bounded-checked-state-api-only' ||
      revisionOf(observation.plan) !== revisionOf(plan) || observation.problems.length ||
      observation.rows.length !== plan.cases.length * 2 ||
      new Set(observation.rows.map(row => row.id + ':' + row.action)).size !== observation.rows.length)
    throw Error('state-api-observation-invalid');
  for (const item of plan.cases) {
    const scalar = (name: string | undefined) => { const change = name ? item.changes[name] : undefined; return change?.kind === 'set' ? change.value : undefined; };
    const supplied = scalar(plan.controlled), initialized = scalar(plan.initial), disabled = scalar(plan.disabled) === true;
    const initial = checkedValue(supplied ?? initialized ?? plan.defaultValue);
    const pair = observation.rows.filter(row => row.id === item.id);
    for (const action of ['space', 'associated-label'] as const) {
      const row = pair.find(row => row.action === action);
      if (!row || !row.restored || row.initial.checked !== initial || row.initial.disabled !== disabled || row.steps.length !== 2 ||
          !stateDomain(plan.version).map(checkedValue).includes(row.live.before.checked) ||
          row.live.changed.checked !== (supplied === undefined ? row.live.before.checked : checkedValue(supplied)) ||
          row.live.changed.disabled !== disabled) throw Error('state-api-observation-row-invalid');
      let previous = initial;
      const calls: unknown[][] = [];
      for (const step of row.steps) {
        if (!disabled) calls.push([previous !== 'true']);
        const checked = disabled || supplied !== undefined ? initial : String(previous !== 'true');
        if (step.control.checked !== checked || step.control.disabled !== disabled || step.callback.problems.length ||
            revisionOf(step.callback.calls) !== revisionOf(calls)) throw Error('state-api-observation-transition-invalid');
        previous = checked;
      }
    }
    if (revisionOf(pair[0].live) !== revisionOf(pair[1].live)) throw Error('state-api-observation-live-invalid');
  }
}

export async function observeReactStateApi(input: { page: Page; selector: string; program: ReactSourceProgram;
  ownership: ReactOwnership; plan: ReactStateApiPlan; assertCurrent: () => void; assertRestored: () => Promise<void> }): Promise<ReactStateApiObservation> {
  const { page, selector, program, plan } = input;
  const result: ReactStateApiObservation = { version: plan.version, qualification: plan.qualification, plan: structuredClone(plan), rows: [], problems: [] };
  const target = input.ownership.components.find(c => c.id === plan.instanceId);
  const controlSelector = selector + (plan.rootPath ? plan.rootPath.split('.').map(i => ' > :nth-child(' + (Number(i) + 1) + ')').join('') : '');
  const settle = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const read = async (): Promise<Control> => {
    await settle();
    const ownership = await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
    const current = ownership.components.find(c => c.id === plan.instanceId);
    if (ownership.problems.length || !current || revisionOf(current.source) !== revisionOf(plan.source) ||
        revisionOf(current.roots) !== revisionOf([plan.rootPath])) throw Error('state-api-control-identity-changed');
    if (await page.locator(controlSelector).count() !== 1) throw Error('state-api-control-ambiguous');
    const value = await page.locator(controlSelector).evaluate(element => {
      const native = element instanceof HTMLInputElement && element.type === 'checkbox';
      return { role: native ? element.getAttribute('role') === 'switch' ? 'switch' : 'checkbox' : element.getAttribute('role'),
        checked: native ? element.indeterminate ? 'mixed' : String(element.checked) : element.getAttribute('aria-checked'),
        disabled: element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.disabled : element.getAttribute('aria-disabled') === 'true' };
    });
    if (value.role !== plan.role || !stateDomain(plan.version).map(checkedValue).includes(value.checked ?? '')) throw Error('state-api-control-state-unqualified');
    return { checked: value.checked as Control['checked'], disabled: value.disabled };
  };
  try {
    const selected = [plan.controlled, plan.initial, ...(plan.disabled ? [plan.disabled] : [])];
    const names = [...selected, ...plan.excludedInputs];
    if (![1, 2].includes(plan.version) || (plan.version === 2 && plan.role !== 'checkbox') || plan.qualification !== 'bounded-checked-state-api-only' || !checkedToggleRole(plan.role) ||
        !stateDomain(plan.version).includes(plan.defaultValue) || new Set(names).size !== names.length ||
        plan.cases.length !== (stateDomain(plan.version).length + 1) ** 2 * (plan.disabled ? 3 : 1) || new Set(plan.cases.map(c => revisionOf(c.changes))).size !== plan.cases.length ||
        plan.cases.some((c, index) => c.id !== String(index) || revisionOf(Object.keys(c.changes).sort()) !== revisionOf([...names].sort()) ||
          Object.entries(c.changes).some(([name, v]) => v.kind !== 'omit' && (v.kind !== 'set' ||
            !([plan.controlled, plan.initial].includes(name) ? stateDomain(plan.version) : [false, true]).includes(v.value as StateValue))) ||
          plan.excludedInputs.some(name => c.changes[name].kind !== 'omit')))
      throw Error('state-api-plan-domain-invalid');
    if (!target || revisionOf(target.source) !== revisionOf(plan.source) || revisionOf(target.roots) !== revisionOf([plan.rootPath]) ||
        Object.hasOwn(target.props, plan.controlled)) throw Error('state-api-uncontrolled-baseline-required');
    for (const item of plan.cases) {
      input.assertCurrent();
      const scalar = (name: string | undefined) => { const value = name ? item.changes[name] : undefined; return value?.kind === 'set' ? value.value : undefined; };
      const supplied = scalar(plan.controlled), initialized = scalar(plan.initial), disabled = scalar(plan.disabled) === true;
      const live = await probeReactProperties(page, selector, program, plan.instanceId, item.changes, read);
      if (!live.ownershipRestored || live.changed.checked !== (supplied === undefined ? live.before.checked : checkedValue(supplied)) ||
          live.changed.disabled !== disabled) throw Error('state-api-live-input-response-unverified');
      await input.assertRestored(); input.assertCurrent();
      for (const action of ['space', 'associated-label'] as const) {
        const trial = await probeReactInitialProperties(page, selector, program, plan.instanceId, item.changes, async (phase, callback) => {
          const initial = await read(), steps: ReactStateApiObservation['rows'][number]['steps'] = [];
          if (phase !== 'changed') return { initial, steps };
          if (initial.checked !== checkedValue(supplied ?? initialized ?? plan.defaultValue) || initial.disabled !== disabled)
            throw Error('state-api-initial-precedence-unverified');
          const mounted = await callback();
          if (mounted.calls.length || mounted.problems.length) throw Error('state-api-callback-before-activation');
          for (let index = 0; index < 2; index++) {
            if (action === 'space') {
              await page.locator(controlSelector).focus();
              if (await page.locator(controlSelector).evaluate(element => document.activeElement === element) === disabled)
                throw Error('state-api-focus-mismatch');
              await page.keyboard.press('Space');
            } else {
              const label = await page.locator(controlSelector).evaluateHandle(element => {
                const labels = element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.labels : null;
                if (labels?.length !== 1 || labels[0].control !== element || !labels[0].checkVisibility({ checkVisibilityCSS: true }))
                  throw Error('state-api-label-association-unavailable');
                return labels[0];
              });
              try { await label.asElement()!.click({ force: disabled, timeout: 3000 }); } finally { await label.dispose(); }
            }
            const control = await read(), calls = await callback(), prior = index ? steps[index - 1].control.checked : initial.checked;
            if (control.disabled !== disabled || control.checked !== (disabled || supplied !== undefined ? initial.checked : String(prior !== 'true')) ||
                calls.problems.length || calls.calls.length !== (disabled ? 0 : index + 1) ||
                (!disabled && (revisionOf(calls.calls[index]) !== revisionOf([prior !== 'true']) ||
                  (index > 0 && revisionOf(calls.calls.slice(0, index)) !== revisionOf(steps[index - 1].callback.calls)))))
              throw Error('state-api-transition-unverified');
            steps.push({ control, callback: calls });
          }
          return { initial, steps };
        }, plan.callback);
        if (!trial.ownershipRestored) throw Error('state-api-ownership-not-restored');
        await input.assertRestored(); input.assertCurrent();
        result.rows.push({ id: item.id, action, ...trial.changed, live: { before: live.before, changed: live.changed }, restored: true });
      }
    }
    validateReactStateApiObservation(result, plan);
  } catch (error) { result.problems.push(error instanceof Error ? error.message : String(error)); }
  return result;
}
