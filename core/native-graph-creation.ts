/** Validate a persisted allocation acknowledgement, never a readback-derived
 * suggestion of which dependency identities should have been created. */
import { nativeGraphVariants } from './native-prepared-library.js';
import { canonicalJson } from './contract-provenance.js';
import type { ComponentData } from './emit-figma-script.js';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function validNativeGraphCreation(components: ComponentData[] | undefined, creation: unknown, version: 1 | 2 = 1): boolean {
  const library = version === 2;
  if (!Array.isArray(components) || components.length < (library ? 1 : 2) || components.length > 30 ||
      !object(creation) || creation.graphVerification !== version || !Array.isArray(creation.nodes) ||
      !Array.isArray(creation.graphTargets) || creation.graphTargets.length !== components.length ||
      !object(creation.target) || !Array.isArray(creation.variants) || !object(creation.propertyDefinitions)) return false;
  const nodes = new Map<string, Record<string, any>>();
  for (const node of creation.nodes) {
    if (!object(node) || !text(node.id) || !text(node.type) || nodes.has(node.id)) return false;
    nodes.set(node.id, node);
  }
  const targets = new Set<string>(), variants = new Set<string>(), contracts = new Set<string>();
  for (const [index, component] of components.entries()) {
    const row = creation.graphTargets[index];
    const expectedVariants = component && nativeGraphVariants(component, library ? 2 : 1);
    if (!component || (!library && component.stateVariants?.length) || !object(row) ||
        Object.keys(row).sort().join(',') !== 'contractId,id,key,propertyDefinitions,type,variants' ||
        row.contractId !== component.contractId || contracts.has(row.contractId) || !text(row.id) || targets.has(row.id) ||
        !text(row.key) || row.type !== (component.isSet ? 'COMPONENT_SET' : 'COMPONENT') ||
        nodes.get(row.id)?.type !== row.type || nodes.get(row.id)?.key !== row.key ||
        !object(row.propertyDefinitions) || !Array.isArray(row.variants) || row.variants.length !== expectedVariants.length ||
        !row.variants.length) return false;
    contracts.add(row.contractId); targets.add(row.id);
    for (const [i, variant] of row.variants.entries()) {
      if (!object(variant) || Object.keys(variant).sort().join(',') !== 'id,key,name' ||
          !text(variant.id) || !text(variant.key) || variants.has(variant.id) ||
          variant.name !== expectedVariants[i].name || nodes.get(variant.id)?.type !== 'COMPONENT' ||
          nodes.get(variant.id)?.key !== variant.key ||
          (!component.isSet && (row.variants.length !== 1 || variant.id !== row.id || variant.key !== row.key))) return false;
      variants.add(variant.id);
    }
  }
  const last = creation.graphTargets.at(-1);
  return canonicalJson(creation.target) === canonicalJson({id:last.id,type:last.type,key:last.key}) &&
    canonicalJson(creation.variants) === canonicalJson(last.variants) &&
    canonicalJson(creation.propertyDefinitions) === canonicalJson(last.propertyDefinitions);
}
