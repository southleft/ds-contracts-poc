import type { ReactStateApiPlan, ReactStateApiObservation } from './react-state-api.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import type { ReactInitialInspection } from './react-initial-inspection.js';
import type { ReactCallbackInspection } from './react-callback-inspection.js';

export function stateApiEvidence() {
  const source = { module: 'widget.tsx', exportName: 'Widget', sourceSha256: 'a'.repeat(64), span: { start: 0, end: 10 } };
  const props = ['chosen', 'locked', 'seed', 'vanish'];
  const rows = props.flatMap(property => [false, true].flatMap(value => property === 'vanish' && value ? [] :
    (['space', 'associated-label'] as const).map(action => {
      const held = property === 'chosen', checked = property === 'seed' || held ? value : false;
      const disabled = property === 'locked' && value;
      const first = !checked, second = held ? first : !first;
      return { callback: 'notify', property, value, action, initial: { checked: String(checked), disabled },
        live: { checked: held ? String(value) : 'false', disabled }, restored: true,
        steps: [first, second].map((next, index) => ({ control: { checked: String(disabled || held ? checked : next), disabled },
          callback: { calls: disabled ? [] : index ? [[first], [second]] : [[first]], problems: [] } })) };
    })));
  const appearances = [];
  for (const seed of [undefined, false, true]) for (const locked of [undefined, false, true]) {
    const key = String(seed ?? false) + ':' + String(locked ?? false);
    appearances.push({ id: String(appearances.length), changes: { seed: seed === undefined ? { kind: 'omit' } : { kind: 'set', value: seed },
      locked: locked === undefined ? { kind: 'omit' } : { kind: 'set', value: locked } }, status: 'observed', restored: true, image: key, treeSha256: key });
  }
  const initial = { id: 'initial', caseId: 'source', phase: 'complete', sourceUnchanged: true, problems: [],
    observation: { instanceId: 'instance-0', source, rows: appearances },
    draft: { status: 'compiled-draft', compiled: { contract: ContractSchema.parse({
      id: 'fixture.state-api', name: 'StateApi', version: '1.0.0', status: 'draft', description: 'A bounded test appearance.',
      semantics: { element: 'button' }, states: [], anatomy: { root: { text: 'Choose' } },
      props: [
        { name: 'seed', type: 'boolean', bindings: { code: { prop: 'seed' }, figma: { kind: 'VARIANT', property: 'Seed', unsetValue: '(unset)' } } },
        { name: 'gate', type: 'boolean', bindings: { code: { prop: 'locked' }, figma: { kind: 'VARIANT', property: 'Gate', unsetValue: '(unset)' } } },
      ], bindings: { code: { anchors: { importPath: './Widget', export: 'Widget' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
    }), tokens: {}, assets: [] } } } as unknown as ReactInitialInspection;
  const problem = 'react-property-probe-render-unqualified:react-ownership-selected-root-missing';
  const behavior = { id: 'behavior', caseId: 'source', phase: 'failed', sourceUnchanged: true, problems: ['callback-observation-incomplete'],
    observation: { qualification: 'observed-source-checkbox-behavior-only', role: 'switch', target: { instanceId: 'instance-0', source, rootPath: '' }, rows,
      candidates: [{ callback: 'notify', signature: '(value:boolean)=>void', stateProperties: props, values: [false, true], status: 'needs-observation', reason: 'type-compatible' }],
      relationships: props.map(property => ({ property, callback: 'notify', status: property === 'chosen' ? 'controlled-observed' : property === 'seed' ? 'initial-only-observed' : 'unresolved', reason: 'bounded observation' })),
      refusals: [{ callback: 'notify', property: 'vanish', value: true, problem }], problems: [problem] } } as ReactCallbackInspection;
  return { initial, behavior };
}

export function stateApiObservation(plan: ReactStateApiPlan): ReactStateApiObservation {
  const dom = (value: unknown) => (value === 'indeterminate' ? 'mixed' : String(value)) as 'false' | 'true' | 'mixed';
  return { version: plan.version, qualification: plan.qualification, plan, problems: [], rows: plan.cases.flatMap(item => {
    const scalar = (name: string | undefined) => { const change = name ? item.changes[name] : undefined; return change?.kind === 'set' ? change.value : undefined; };
    const held = scalar(plan.controlled), checked = held ?? scalar(plan.initial) ?? plan.defaultValue, disabled = scalar(plan.disabled) === true;
    const first = checked !== true, second = held === undefined ? !first : first;
    return (['space', 'associated-label'] as const).map(action => ({ id: item.id, action, restored: true as const,
      initial: { checked: dom(checked), disabled },
      live: { before: { checked: 'false' as const, disabled: false }, changed: { checked: dom(held ?? false), disabled } },
      steps: [first, second].map((next, index) => ({ control: { checked: dom(disabled || held !== undefined ? checked : next), disabled },
        callback: { calls: disabled ? [] : index ? [[first], [second]] : [[first]], problems: [] } })),
    }));
  }) };
}

/** A third state has its own typed public value. The Boolean-only appearance
 * input is absent from that callback's compatible-property sweep. */
export function mixedStateApiEvidence() {
  const value = stateApiEvidence(), observed = value.behavior.observation!;
  value.behavior.phase = 'complete'; value.behavior.problems = [];
  observed.problems = []; observed.refusals = []; observed.role = 'checkbox';
  observed.candidates[0] = { ...observed.candidates[0], callback: 'onNotify',
    stateProperties: ['chosen', 'seed'], values: [false, true, 'indeterminate'] };
  observed.relationships = observed.relationships.filter(r => ['chosen', 'seed'].includes(r.property))
    .map(r => ({ ...r, callback: 'onNotify' }));
  const checked = (state: boolean | string) => state === 'indeterminate' ? 'mixed' : String(state);
  observed.rows = ['chosen', 'seed'].flatMap(property => [false, true, 'indeterminate'].flatMap(state =>
    (['space', 'associated-label'] as const).map(action => {
      const held = property === 'chosen', first = state !== true, second = held ? first : !first;
      return { callback: 'onNotify', property, value: state, action, restored: true,
        initial: { checked: checked(state), disabled: false }, live: { checked: held ? checked(state) : 'false', disabled: false },
        steps: [first, second].map((next, index) => ({ control: { checked: held ? checked(state) : String(next), disabled: false },
          callback: { calls: index ? [[first], [second]] : [[first]], problems: [] } })) };
    })));
  const prop = value.initial.draft!.compiled!.contract!.props[0];
  prop.type = { enum: ['off', 'on', 'mixed'] };
  prop.bindings.code.values = { off: false, on: true, mixed: 'indeterminate' };
  value.initial.observation!.rows = [];
  for (const seed of [undefined, false, true, 'indeterminate']) for (const locked of [undefined, false, true]) {
    const key = String(seed ?? false) + ':' + String(locked ?? false);
    value.initial.observation!.rows.push({ id: String(value.initial.observation!.rows.length),
      changes: { seed: seed === undefined ? { kind: 'omit' } : { kind: 'set', value: seed },
        locked: locked === undefined ? { kind: 'omit' } : { kind: 'set', value: locked } },
      status: 'observed', restored: true, image: key, treeSha256: key } as NonNullable<ReactInitialInspection['observation']>['rows'][number]);
  }
  return value;
}
