/** Finite caller-supplied inputs observed on fresh mounts. Initial render
 * coverage is deliberately distinct from live updates and interaction behavior. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyReactProperty } from './react-program-proposal.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import { observeReactPropertyPlan, type ReactPropertyObservationArgs } from './react-property-effects.js';
import type { ReactPropertyChanges, ReactPropertyValue } from './react-property-probe.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnership } from './react-ownership.js';
import type { CapturedNode } from '../extract/computed/lib.js';

export function planReactInitialStates(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode, instanceId: string) {
  const anatomy = linkReactSourceAnatomy(program, ownership, tree);
  const instance = ownership.components.find(c => c.id === instanceId);
  if (anatomy.status !== 'linked' || !instance || !anatomy.instances.some(i => i.instanceId === instanceId && i.roots.length === 1))
    throw Error('react-initial-states-source-unqualified');
  const source = program.components.find(c => c.module === instance.source.module && c.exportName === instance.source.exportName &&
    c.sourceSha256 === instance.source.sourceSha256 && c.span.start === instance.source.span.start && c.span.end === instance.source.span.end)!;
  const axes: Array<{ property: string; values: ReactPropertyValue[] }> = [], skipped: Array<{ property: string; reason: string }> = [];
  const reserved = new Set(['children', 'className', 'style', 'ref', 'key', 'id', '__proto__', 'constructor', 'prototype']);
  for (const prop of source.props) {
    if (reserved.has(prop.name) || !Object.hasOwn(instance.props, prop.name)) continue;
    const classified = classifyReactProperty(prop.type);
    const domain = classified?.kind === 'boolean' ? [false, true] : classified?.kind === 'enum'
      ? classified.values!.map(value => classified.codeValues && Object.hasOwn(classified.codeValues, value) ? classified.codeValues[value] : value) : undefined;
    if (!domain?.length) { skipped.push({ property: prop.name, reason: 'caller-input-not-finite' }); continue; }
    const values: ReactPropertyValue[] = domain.map(value => ({ kind: 'set', value }));
    if (prop.optional) values.push({ kind: 'omit' });
    axes.push({ property: prop.name, values });
  }
  const total = axes.length ? axes.reduce((n, a) => n * a.values.length, 1) : 0;
  if (total > 64) throw Error('react-initial-states-combination-limit');
  const plan: Array<{ changes: ReactPropertyChanges }> = [];
  const visit = (index: number, changes: ReactPropertyChanges) => {
    if (index === axes.length) { plan.push({ changes }); return; }
    for (const value of axes[index].values) visit(index + 1, { ...changes, [axes[index].property]: value });
  };
  if (total) visit(0, {});
  return { source: instance.source, heldProps: instance.props, axes, plan, skipped,
    limitations: ['caller-supplied-finite-inputs-only', 'fresh-mount-resets-runtime-state', 'live-update-behavior-unverified',
      'interaction-behavior-unverified', 'native-state-mapping-unqualified'] };
}
export async function observeReactInitialStates(args: ReactPropertyObservationArgs) {
  const { plan, ...facts } = planReactInitialStates(args.program, args.ownership, args.tree, args.instanceId);
  const observation = await observeReactPropertyPlan({ ...args, observationMode: 'initial-mount' }, plan);
  const result = { version: 1 as const, qualification: 'finite-initial-mounts-only' as const, acceptedContract: null,
    instanceId: args.instanceId, ...facts, planned: plan.length, ...observation };
  mkdirSync(args.dir, { recursive: true });
  writeFileSync(path.join(args.dir, 'report.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
