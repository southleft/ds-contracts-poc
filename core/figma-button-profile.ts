/** Author-supplied behavior, bound to one captured root; never a synthetic native stamp. */
import { canonicalJson } from './contract-provenance.js';
import { assertCapturedClosure } from './captured-closure.js';
import { readButtonStamp, type ButtonStamp } from './figma-button-behavior.js';
import type { DumpSet } from '../extract/figma/types.js';
import { allocateFigmaPropertyNames, canonicalPropName, figmaPropertyDisplayName } from './figma-names.js';
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const refuse = (why: string): never => { throw Error('FIGMA_BUTTON_PROFILE_INVALID:' + why); };
export type ButtonProfile = { fileKey: string; nodeId: string; prop: ButtonStamp['buttonAxis']['prop']; states: ButtonStamp['button']['states'] };
export function readButtonProfile(raw: unknown): ButtonProfile {
  if (!plain(raw) || Object.keys(raw).sort().join('|') !== 'fileKey|nodeId|prop|states' ||
      typeof raw.fileKey !== 'string' || !raw.fileKey.trim() || typeof raw.nodeId !== 'string' || !raw.nodeId.trim() ||
      !plain(raw.prop) || !plain(raw.states)) return refuse('expected fileKey, nodeId, prop and states');
  return raw as ButtonProfile;
}
export function resolveButtonProfile(dump: Record<string, unknown>, raw: unknown) {
  const profile = readButtonProfile(raw);
  assertCapturedClosure(dump);
  const provenance = plain(dump._provenance) ? dump._provenance : {};
  const closure = plain(provenance.closure) ? provenance.closure : {};
  if (provenance.fileKey !== profile.fileKey || !Array.isArray(closure.requested) || closure.requested.length !== 1 ||
      !plain(closure.requested[0]) || closure.requested[0].nodeId !== profile.nodeId) return refuse('exact requested root required');
  if ((closure.unresolved as unknown[]).length || (closure.cycles as unknown[]).length) return refuse('complete captured dependency closure required');
  const matches = Object.entries(dump).filter(([key, value]) => key !== '_provenance' && plain(value) && value.nodeId === profile.nodeId);
  if (matches.length !== 1) return refuse('ambiguous root');
  const set = matches[0][1] as DumpSet;
  if (set.type !== 'COMPONENT_SET') return refuse('component set required');
  const native = readButtonStamp(set);
  if (set.semantics !== undefined && (!plain(set.semantics) || set.semantics.element !== 'button' ||
      Object.keys(set.semantics).some(key => !['element', 'button', 'buttonAxis'].includes(key)))) return refuse('conflicting native semantics');
  if (set.propNames !== undefined && !plain(set.propNames)) return refuse('malformed native property identities');
  if (set.contractId !== undefined && (typeof set.contractId !== 'string' || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(set.contractId.trim()))) return refuse('malformed native contract identity');
  const prop = profile.prop, property = prop.bindings?.figma?.property;
  if (!property) return refuse('variant property required');
  if (!plain(prop.bindings.figma.values) || !plain(prop.type) || !('enum' in prop.type) || !Array.isArray(prop.type.enum) ||
      Object.keys(prop.bindings.figma.values).length !== prop.type.enum.length ||
      prop.type.enum.some(value => !Object.hasOwn(prop.bindings.figma.values!, value))) return refuse('complete native label mapping required');
  if (set.propNames?.[property] !== undefined && set.propNames[property] !== prop.name) return refuse('conflicting native property identity');
  const properties = Object.keys(set.propertyDefinitions ?? {}).map(figmaPropertyDisplayName);
  const allocated = set.propNames || set.semantics || set.statePreviewAxis || set.contractId ? {} : allocateFigmaPropertyNames(properties);
  const referenced = (node: import('../extract/figma/types.js').DumpNode): string[] =>
    [...Object.values(node.propRefs ?? {}), ...(node.children ?? []).flatMap(referenced)];
  const inputs = new Set([...properties, ...Object.keys(set.boolDefaults ?? {}), ...set.variants.flatMap(referenced)]);
  for (const other of [...inputs].filter(name => name !== property)) {
    const name = set.propNames?.[other] ?? allocated[other] ?? canonicalPropName(other);
    if (name === prop.name || name === prop.bindings.code?.prop) return refuse('input identity collides with ' + other);
  }
  // This validation view never enters projection; supplied identity is not a native stamp.
  let retained: ReturnType<typeof readButtonStamp>;
  try { retained = readButtonStamp({ ...set, propNames: { ...set.propNames, [property]: prop.name },
    semantics: { element: 'button', button: { prop: prop.name, states: profile.states }, buttonAxis: { version: 1, prop } } } as DumpSet); }
  catch (error) { return refuse(String(error)); }
  if (!retained) return refuse('missing declaration');
  if (native && canonicalJson(native.stamp) !== canonicalJson(retained.stamp)) return refuse('conflicting retained declaration');
  return { nodeId: profile.nodeId, retained };
}
