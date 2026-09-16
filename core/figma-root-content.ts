import type { DumpSet } from '../extract/figma/types.js';

/** A marker identifies the compiler projection; drawn facts must still agree.
 * Never unwrap an arbitrary designer-authored frame or trust the marker alone. */
export function readRootContent(set: DumpSet): { property: string } | undefined {
  const raw = set.rootSlot;
  if (raw === undefined) return undefined;
  const fail = (why: string): never => { throw new Error(`FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED: ${why}`); };
  const marker = raw as Record<string, unknown> | null;
  if (!marker || typeof marker !== 'object' || Array.isArray(marker) ||
      Object.keys(marker).sort().join('|') !== 'property|version' ||
      marker.version !== 1 || typeof marker.property !== 'string' || !marker.property)
    return fail('invalid version 1 root content declaration');
  const property = (raw as { property: string }).property;
  const definitions = Object.entries(set.propertyDefinitions ?? {}).filter(([key]) => key.split('#')[0] === property);
  if (definitions.length !== 1 || definitions[0][1].type !== 'SLOT') return fail('missing or ambiguous SLOT definition');
  const definition = definitions[0][1];
  if (definition.type === 'SLOT' && (definition.description?.includes('REFUSED BY FIGMA') ||
      Object.keys(definition.slotSettings ?? {}).length)) return fail('slot constraints need explicit contract reconciliation');
  if (!set.variants.length) return fail('no observed component planes');
  for (const root of set.variants) {
    const slot = root.children?.[0], outer = root.layout, inner = slot?.layout;
    if (root.children?.length !== 1 || slot?.type !== 'SLOT' || slot.name !== property ||
        slot.propRefs?.slotContentId?.split('#')[0] !== property ||
        (slot.slotKey !== undefined && slot.slotKey !== definitions[0][0])) return fail(`${root.name}: content structure disagrees`);
    // Contents of the main are defaults, not a sample to bake into React.
    // Default-content inversion is a separate qualification from empty mains.
    if (slot.children?.length) return fail(`${root.name}: nonempty main content needs qualified default-content inversion`);
    const allowed = new Set(['name', 'type', 'layout', 'bound', 'propRefs', 'slotKey', 'children', 'fillWidth', 'fillHeight']);
    if (Object.keys(slot).some(key => !allowed.has(key)) ||
        Object.keys(slot.propRefs ?? {}).some(key => key !== 'slotContentId') ||
        Object.keys(slot.bound ?? {}).some(key => key !== 'itemSpacing')) return fail(`${root.name}: content container has independent styling or behavior`);
    if (!outer || !inner || !['HORIZONTAL', 'VERTICAL'].includes(outer.mode) ||
        outer.wrap || inner.wrap || outer.primary === 'SPACE_BETWEEN' ||
        inner.padding.some(value => value !== 0) ||
        ['mode', 'primary', 'counter', 'spacing'].some(key => outer[key as keyof typeof outer] !== inner[key as keyof typeof inner]) ||
        root.bound?.itemSpacing !== slot.bound?.itemSpacing) return fail(`${root.name}: root and content flow disagree`);
    const layoutFields = new Set(['mode', 'primary', 'counter', 'spacing', 'padding', 'primarySizing', 'counterSizing']);
    if (Object.keys(inner).some(key => !layoutFields.has(key))) return fail(`${root.name}: unsupported content layout facts`);
    const horizontal = outer.mode === 'HORIZONTAL';
    for (const [axis, filled] of [['primarySizing', horizontal ? slot.fillWidth : slot.fillHeight], ['counterSizing', horizontal ? slot.fillHeight : slot.fillWidth]] as const) {
      if (!['AUTO', 'FIXED'].includes(outer[axis]) || inner[axis] !== outer[axis] ||
          Boolean(filled) !== (outer[axis] === 'FIXED')) return fail(`${root.name}: content sizing disagrees with root`);
    }
  }
  return { property };
}
