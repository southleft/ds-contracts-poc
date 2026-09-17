import type { DumpSet } from '../extract/figma/types.js';

/** A marker identifies the compiler projection; drawn facts must still agree.
 * Never unwrap an arbitrary designer-authored frame or trust the marker alone. */
export function readRootContent(set: DumpSet): { property: string; display: 'flex' | 'inline-flex' | 'grid' | 'block'; normalized?: DumpSet; fillWidth?: true } | undefined {
  const raw = set.rootSlot;
  if (raw === undefined) return undefined;
  const fail = (why: string): never => { throw new Error(`FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED: ${why}`); };
  const marker = raw as Record<string, unknown> | null;
  const keys = marker && Object.keys(marker).sort().join('|');
  if (!marker || typeof marker !== 'object' || Array.isArray(marker) ||
      !([3,4].includes(marker.version as number)
        ? keys === 'display|property|version|width' && marker.width === 'fill' && typeof marker.display === 'string' &&
          (marker.version === 4 ? marker.display === 'block' : ['flex','inline-flex','grid'].includes(marker.display))
        : ['property|version', 'display|property|version'].includes(keys!) &&
          (marker.version === 1 ? !Object.hasOwn(marker, 'display') || marker.display === 'inline-flex'
            : marker.version === 2 && marker.display === 'grid')) || typeof marker.property !== 'string' || !marker.property)
    return fail('invalid root content declaration');
  const property = (raw as { property: string }).property;
  const definitions = Object.entries(set.propertyDefinitions ?? {}).filter(([key]) => key.split('#')[0] === property);
  if (definitions.length !== 1 || definitions[0][1].type !== 'SLOT') return fail('missing or ambiguous SLOT definition');
  const definition = definitions[0][1];
  if (definition.type === 'SLOT' && (definition.description?.includes('REFUSED BY FIGMA') ||
      Object.keys(definition.slotSettings ?? {}).length)) return fail('slot constraints need explicit contract reconciliation');
  if (!set.variants.length) return fail('no observed component planes');
  const normalized = marker.display === 'grid' ? structuredClone(set) : undefined;
  const sizing = [3,4].includes(marker.version as number) ? { fillWidth: true as const } : {};
  let gridDeclaration: string | undefined;
  for (const root of normalized?.variants ?? set.variants) {
    const slot = root.children?.[0], outer = root.layout, inner = slot?.layout;
    if (root.children?.length !== 1 || slot?.type !== 'SLOT' || slot.name !== property ||
        slot.propRefs?.slotContentId?.split('#')[0] !== property ||
        (slot.slotKey !== undefined && slot.slotKey !== definitions[0][0])) return fail(`${root.name}: content structure disagrees`);
    // Contents of the main are defaults, not a sample to bake into React.
    // Default-content inversion is a separate qualification from empty mains.
    if (sizing.fillWidth && (!outer ||
        (outer.mode === 'HORIZONTAL' ? outer.primarySizing : outer.counterSizing) !== 'FIXED' || root.bound?.width))
      return fail(`${root.name}: full-width root must have an unbound fixed preview width`);
    if (marker.display === 'grid') {
      const carrier = slot.children?.[0], grid = carrier?.layout;
      const slotFields = new Set(['name', 'type', 'layout', 'propRefs', 'slotKey', 'children', 'fillWidth', 'fillHeight']);
      const frameFields = new Set(['name', 'type', 'layout', 'children', 'fillWidth', 'fillHeight', 'bound']);
      if (Object.keys(slot).some(key => !slotFields.has(key)) ||
          Object.keys(slot.propRefs ?? {}).some(key => key !== 'slotContentId') ||
          slot.children?.length !== 1 || carrier?.type !== 'FRAME' || carrier.name !== 'Content layout' ||
          carrier.children?.length || Object.keys(carrier).some(key => !frameFields.has(key)) ||
          Object.keys(carrier.bound ?? {}).some(key => !['gridRowGap', 'gridColumnGap'].includes(key)) ||
          ['itemSpacing', 'gridRowGap', 'gridColumnGap'].some(key => root.bound?.[key] !== undefined))
        return fail(`${root.name}: grid carrier has independent content, styling or behavior`);
      if (!outer || !inner || outer.mode !== 'VERTICAL' || inner.mode !== 'VERTICAL' ||
          outer.primary !== 'MIN' || outer.counter !== 'MIN' || outer.spacing !== 0 || outer.wrap ||
          inner.primary !== 'MIN' || inner.counter !== 'MIN' || inner.spacing !== 0 || inner.wrap ||
          inner.padding.some(value => value !== 0) || !grid || grid.mode !== 'GRID' || !grid.grid ||
          grid.grid.flow !== 'row' || grid.padding.some(value => value !== 0) ||
          Object.keys(inner).some(key => !['mode', 'primary', 'counter', 'spacing', 'padding', 'primarySizing', 'counterSizing'].includes(key)) ||
          Object.keys(grid).some(key => !['mode', 'padding', 'primarySizing', 'counterSizing', 'grid'].includes(key)))
        return fail(`${root.name}: invalid grid carrier flow`);
      for (const [axis, filled, gridAxis, gridFilled] of [
        ['primarySizing', slot.fillHeight, 'counterSizing', carrier.fillHeight],
        ['counterSizing', slot.fillWidth, 'primarySizing', carrier.fillWidth],
      ] as const) {
        // FILL is authoritative on children. Native axis sizing may retain
        // AUTO while FILL supplies the extent from the parent.
        if (!['AUTO', 'FIXED'].includes(outer[axis]) || !['AUTO', 'FIXED'].includes(inner[axis]) ||
            !['AUTO', 'FIXED'].includes(grid[gridAxis]) ||
            Boolean(filled) !== (outer[axis] === 'FIXED') || Boolean(gridFilled) !== Boolean(filled) ||
            (!filled && (inner[axis] !== 'AUTO' || grid[gridAxis] !== 'AUTO')))
          return fail(`${root.name}: grid content sizing disagrees with root`);
      }
      // The existing grid inverse carries one invariant layout. Do not let
      // differing planes collapse to the first plane under this exact marker.
      const declaration = JSON.stringify([grid.grid, carrier.bound ?? {}]);
      if (gridDeclaration !== undefined && gridDeclaration !== declaration)
        return fail(`${root.name}: per-variant grid facts need qualified inversion`);
      gridDeclaration = declaration;
      // Reconstruct one source root from independently drawn grid facts. Keep
      // its original outer box/paint; the two neutral containers are synthetic.
      root.layout = { ...structuredClone(grid), padding: [...outer.padding],
        primarySizing: outer.counterSizing, counterSizing: outer.primarySizing };
      if (carrier.bound) root.bound = { ...root.bound, ...carrier.bound };
      continue;
    }
    if (slot.children?.length) return fail(`${root.name}: nonempty main content needs qualified default-content inversion`);
    if (marker.display === 'block' && (!outer || outer.mode !== 'VERTICAL' || outer.primary !== 'MIN' ||
        outer.counter !== 'MIN' || outer.spacing !== 0 || outer.primarySizing !== 'AUTO' || root.bound?.itemSpacing))
      return fail(`${root.name}: block content requires intrinsic vertical flow without flex distribution`);
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
      // FILL supplies the extent; native children may retain AUTO on that
      // axis. The v3 declaration separately validates the fixed main preview.
      const innerAgrees = inner[axis] === outer[axis] ||
        (sizing.fillWidth && filled && inner[axis] === 'AUTO');
      if (!['AUTO', 'FIXED'].includes(outer[axis]) || !innerAgrees ||
          Boolean(filled) !== (outer[axis] === 'FIXED')) return fail(`${root.name}: content sizing disagrees with root`);
    }
  }
  return normalized ? { property, display: 'grid', normalized, ...sizing }
    : { property, display: marker.display === 'block' ? 'block' : marker.display === 'inline-flex' ? 'inline-flex' : 'flex', ...sizing };
}
