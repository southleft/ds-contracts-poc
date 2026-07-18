/**
 * The schema-coverage drift guard — the site's standing receipt.
 *
 * enumerateBranches() walks the LIVE Zod schema and yields every branch key
 * (131 at schema v13). This registry maps every key to the reference page +
 * anchor that documents it. The build FAILS when:
 *   - the schema grows a branch with no registry entry (undocumented spec), or
 *   - the registry names a branch the schema no longer has (stale docs).
 *
 * The receipt (counts + any misses) prints at build time and is written to
 * site/dist/spec-coverage.json.
 */
import { enumerateBranches } from './introspect.js';

export type PageId =
  | 'contract'
  | 'semantics'
  | 'props'
  | 'anatomy'
  | 'layout'
  | 'tokens'
  | 'states'
  | 'conditionals'
  | 'shape'
  | 'composition'
  | 'events';

export interface PageMeta {
  id: PageId;
  route: string;
  title: string;
  nav: string;
}

export const SPEC_PAGES: PageMeta[] = [
  { id: 'contract', route: '/spec/contract/', title: 'The contract document', nav: 'The contract document' },
  { id: 'semantics', route: '/spec/semantics/', title: 'Semantics & accessibility', nav: 'Semantics' },
  { id: 'props', route: '/spec/props/', title: 'Props & bindings', nav: 'Props & bindings' },
  { id: 'anatomy', route: '/spec/anatomy/', title: 'Anatomy & parts', nav: 'Anatomy & parts' },
  { id: 'layout', route: '/spec/layout/', title: 'Layout', nav: 'Layout' },
  { id: 'tokens', route: '/spec/tokens/', title: 'Token bindings', nav: 'Token bindings' },
  { id: 'states', route: '/spec/states/', title: 'States & state previews', nav: 'States' },
  { id: 'conditionals', route: '/spec/conditionals/', title: 'Conditionals, overlays & motion', nav: 'Conditionals & overlays' },
  { id: 'shape', route: '/spec/shape/', title: 'Shape parts', nav: 'Shape parts' },
  { id: 'composition', route: '/spec/composition/', title: 'Composition — slots, refs, repeat', nav: 'Composition' },
  { id: 'events', route: '/spec/events/', title: 'Events & toggles', nav: 'Events & toggles' },
];

export const pageMeta = (id: PageId): PageMeta => {
  const m = SPEC_PAGES.find((p) => p.id === id);
  if (!m) throw new Error(`unknown spec page "${id}"`);
  return m;
};

interface Entry {
  page: PageId;
  anchor: string;
}

const REGISTRY = new Map<string, Entry>();

function reg(page: PageId, anchor: string, keys: string[]): void {
  for (const k of keys) {
    if (REGISTRY.has(k)) throw new Error(`coverage registry: duplicate key "${k}"`);
    REGISTRY.set(k, { page, anchor });
  }
}

// --- The contract document (identity, lifecycle, anchors, a11y) ------------
reg('contract', 'fields', [
  'contract.$schema',
  'contract.id',
  'contract.name',
  'contract.version',
  'contract.status',
  'contract.description',
  'contract.figmaRepresentation',
  'contract.modes',
]);
reg('contract', 'anchors', [
  'contract.anchors',
  'contract.anchors.figma',
  'contract.anchors.figma.fileKey',
  'contract.anchors.figma.componentSetKey',
  'contract.anchors.figma.nodeId',
  'contract.anchors.code',
  'contract.anchors.code.importPath',
  'contract.anchors.code.export',
]);
reg('contract', 'a11y', [
  'contract.a11y',
  'contract.a11y.focusVisible',
  'contract.a11y.minHitArea',
  'contract.a11y.contrast',
]);
// Pointers: sections that live on their own pages.
reg('props', 'props', ['contract.props']);
reg('anatomy', 'anatomy', ['contract.anatomy']);
reg('states', 'declared-states', ['contract.states']);
reg('states', 'state-previews', ['contract.figmaStatePreviews']);
reg('events', 'events', ['contract.events']);

// --- Semantics -------------------------------------------------------------
reg('semantics', 'semantics', [
  'contract.semantics',
  'contract.semantics.element',
  'contract.semantics.role',
]);
reg('semantics', 'role-by-prop', [
  'contract.semantics.roleByProp',
  'contract.semantics.roleByProp.prop',
  'contract.semantics.roleByProp.map',
]);
reg('semantics', 'element-by-prop', [
  'contract.semantics.elementByProp',
  'contract.semantics.elementByProp.prop',
  'contract.semantics.elementByProp.map',
]);
reg('semantics', 'role-exception', ['contract.semantics.roleException', 'part.roleException']);

// --- Props & bindings ------------------------------------------------------
reg('props', 'prop-fields', [
  'prop.name',
  'prop.description',
  'prop.default',
  'prop.required',
]);
reg('props', 'prop-types', [
  'prop.type',
  'prop.type.boolean',
  'prop.type.text',
  'prop.type.number',
  'prop.type.enum',
  'prop.type.arrayOf',
]);
reg('props', 'bindings', [
  'prop.bindings',
  'prop.bindings.figma',
  'prop.bindings.figma.kind',
  'prop.bindings.figma.property',
  'prop.bindings.figma.values',
  'prop.bindings.code',
  'prop.bindings.code.prop',
]);

// --- Anatomy & parts -------------------------------------------------------
reg('anatomy', 'part-fields', [
  'part.description',
  'part.element',
  'part.parts',
  'part.optional',
]);
reg('anatomy', 'content', [
  'part.content',
  'part.content.prop',
  'part.text',
]);
reg('anatomy', 'icon', ['part.icon', 'part.icon.asset', 'part.icon.size']);
reg('anatomy', 'attrs', ['part.attrs']);
reg('anatomy', 'meter', ['part.meter', 'part.meter.valueProp', 'part.meter.maxProp']);

// --- Layout ----------------------------------------------------------------
reg('layout', 'layout', [
  'part.layout',
  'layout.display',
  'layout.direction',
  'layout.align',
  'layout.justify',
  'layout.grow',
  'layout.overlap',
]);
reg('layout', 'layout-by-prop', [
  'part.layoutByProp',
  'layoutByProp.prop',
  'layoutByProp.map',
  'variantLayout.display',
  'variantLayout.direction',
  'variantLayout.align',
  'variantLayout.justify',
]);

// --- Token bindings --------------------------------------------------------
reg('tokens', 'tokens', ['part.tokens']);
reg('tokens', 'tokens-by-prop', [
  'part.tokensByProp',
  'tokensByProp.prop',
  'tokensByProp.map',
]);

// --- States ----------------------------------------------------------------
reg('states', 'root-states', ['part.states']);

// --- Conditionals, overlays & motion --------------------------------------
reg('conditionals', 'visible-when', [
  'part.visibleWhen',
  'visibleWhen.prop',
  'visibleWhen.equals',
]);
reg('conditionals', 'styles-when', [
  'part.stylesWhen',
  'stylesWhen.prop',
  'stylesWhen.equals',
  'stylesWhen.styles',
]);
reg('conditionals', 'overlay', ['part.overlay', 'overlay.placement']);
reg('conditionals', 'animation', ['part.animation']);

// --- Shape parts -----------------------------------------------------------
reg('shape', 'shape', [
  'part.shape',
  'shape.kind',
  'shape.sides',
  'shape.width',
  'shape.height',
  'shape.rotation',
]);

// --- Composition -----------------------------------------------------------
reg('composition', 'slots', [
  'part.slot',
  'slot.name',
  'slot.accepts',
  'slot.acceptsMode',
  'slot.min',
  'slot.max',
  'slot.required',
  'slot.figmaProperty',
]);
reg('composition', 'default-content', [
  'slot.defaultContent',
  'slotContent.id',
  'slotContent.props',
  'slotContent.text',
]);
reg('composition', 'component-refs', [
  'part.component',
  'componentRef.id',
  'componentRef.props',
  'componentRef.text',
]);
reg('composition', 'repeat', [
  'part.repeat',
  'repeat.itemsProp',
  'repeat.sample',
]);

// --- Events ----------------------------------------------------------------
reg('events', 'event-fields', [
  'event.name',
  'event.description',
  'event.trigger',
  'event.bindings',
  'event.bindings.code',
  'event.bindings.code.prop',
]);
reg('events', 'toggles', [
  'event.toggles',
  'event.toggles.prop',
  'event.toggles.between',
  'event.toggles.aria',
]);

export interface CoverageReceipt {
  schemaBranches: number;
  documented: number;
  missing: string[];
  stale: string[];
  byPage: Record<string, number>;
}

export function checkCoverage(): CoverageReceipt {
  const branches = enumerateBranches();
  const branchSet = new Set(branches);
  const missing = branches.filter((b) => !REGISTRY.has(b));
  const stale = [...REGISTRY.keys()].filter((k) => !branchSet.has(k));
  const byPage: Record<string, number> = {};
  for (const [k, e] of REGISTRY) {
    if (branchSet.has(k)) byPage[e.page] = (byPage[e.page] ?? 0) + 1;
  }
  return {
    schemaBranches: branches.length,
    documented: branches.length - missing.length,
    missing,
    stale,
    byPage,
  };
}

/** Where a branch key is documented — used to cross-link generated tables. */
export const branchLink = (key: string): string | undefined => {
  const e = REGISTRY.get(key);
  return e ? `${pageMeta(e.page).route}#${e.anchor}` : undefined;
};
