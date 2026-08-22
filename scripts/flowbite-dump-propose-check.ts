/**
 * Hop 4 pin — a set this pipeline drew must propose. Recovered props /
 * host element are the bar. Events stay canvas-absent (dump cannot
 * invent onClick / onDismiss / onToggle).
 *
 *   npx tsx scripts/flowbite-dump-propose-check.ts
 *
 * Fixture: extract/figma/fixtures/flowbite-eight.dump.json
 * (demo file 59mLQlOMiD5w5za6SUcoO5, all eight Flowbite stems, with
 * bound + fill + stroke + type-stamp names, including nested Card
 * label binds, dump v1.26 contractId stamps, dump v1.27
 * CHANGE_TO reaction receipts, dump v1.28 specHash stamps, dump v1.29
 * version stamps, dump v1.30 omitting Figma-default min/max 0, and
 * FC-HOP4-SIZING-HUG-INVENTED: layout.primarySizing/counterSizing are
 * AUTO|FIXED — dump.plugin writes primaryAxisSizingMode, never HUG).
 * FC-HOP4-SIZING-AXES-SWAPPED: those fields are the layout AXES
 * (primaryAxisSizingMode / counterAxisSizingMode), not
 * layoutSizingHorizontal / Vertical. A VERTICAL hug-height +
 * fixed-width stack is AUTO×FIXED. Mapping primary=horizontal left
 * Kbd/Label/HelperText as FIXED×AUTO and hop-4 minted height
 * dump-slugs the canvas does not draw as FIXED. Button HORIZONTAL
 * AUTO×FIXED (fixed height) is live and stays a geometry remint.
 * Root-only bound maps were
 * FC-DUMP-PROPOSE-NESTED-BOUND-UNPINNED.
 *
 * FC-DUMP-PROPOSE-DISABLED-INVENTED: State=Disabled preview cells
 * recover the disabled STATE block, not a Disabled BOOLEAN the
 * canvas never drew.
 *
 * FC-DUMP-PROPOSE-NAME-PARENTHETICAL: emit may draw `Name (id)` when
 * a foreign same-name set exists; propose recovers Name, not
 * NameFlowbiteId.
 *
 * FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED: emit writes Disabled
 * node.opacity as an unbound 0–1 literal (unbind then write) so
 * re-apply does not wash to 0.5%. Propose recovers the stamped
 * authored token when it resolves to that literal, not a dump-slug.
 *
 * FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED: Alert icon/dismiss padding
 * is unbound on the canvas (no padding bind). Propose minted dump-slugs
 * (`imported.alert-flowbite-alert.part-0-*`). When the stamped contract
 * already spells those px as literals, recover the literals.
 *
 * FC-DUMP-PROPOSE-SHADOW-MINTED: Figma cannot bind effect stacks; emit
 * writes DROP_SHADOW literals. Propose minted dump-slugs for Card's
 * default stack and Button Active / Focus Visible. When the stamped
 * authored token resolves to those layers (rgba vs dump hex), recover
 * the authored ref.
 *
 * FC-DUMP-PROPOSE-STAMP-GATE: every dump-stamped slash name (bound /
 * fill.var / stroke.var / fontSizeVar / fontWeightVar / lineHeightVar)
 * must survive propose, not only the hand-picked `stamped` samples.
 *
 * FC-HOP4-LIVE-EXTRAS-SAME-AS-ABSENT: a live dump.plugin pass writes
 * fields this compact fixture omits (PIXELS lineHeight beside
 * lineHeightVar, strokeWeight 0 beside bound sides, strokeAlign INSIDE,
 * minWidth beside bound.minWidth, cornerRadius beside bound radii).
 * Propose must not grow the mint set. Do not inject VECTOR abs / icon
 * fixedSize — those are FC-GEOMETRY-EXCLUDED.
 *
 * FC-HOP4-LAYOUT-TUPLE: live default-variant auto-layout must survive
 * propose. Button row/center/center is the emit default and elides.
 * Badge/ToggleSwitch are row + MIN + CENTER (align:center stays).
 * Column stems omit MIN/MIN (emit default for a declared column).
 *
 * FC-HOP4-GEOMETRY-REMINTS-ONLY: after the remint climb the only MINTED
 * dump-slugs left are Button `root.height.{xs,sm,md,lg,xl}` — live
 * HORIZONTAL AUTO×FIXED, `FC-GEOMETRY-EXCLUDED`. A new dump-slug is a
 * reopen (shadow / padding / opacity / hug-height class), not geometry.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { proposeBatchFromDump } from '../core/propose-figma.js';
import { loadContracts } from '../extract/figma/propose.js';
import { loadTokenCorpus } from '../extract/figma/tokens.js';

const ROOT = process.cwd();
const FIXTURE = path.join(ROOT, 'extract', 'figma', 'fixtures', 'flowbite-eight.dump.json');
const CENSUS = path.join(ROOT, 'extract', 'figma', 'fixtures', 'flowbite-eight.stamps.json');
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

type StemExpect = {
  /** dump v1.26 `ds_contracts/contractId` — not a name-derived ds.* slug. */
  id: string;
  /** Authored contract name. Emit may draw `Name (id)` on collision;
   *  propose must recover Name, not NameFlowbiteId
   *  (FC-DUMP-PROPOSE-NAME-PARENTHETICAL). */
  name: string;
  element: string;
  role?: string;
  props: readonly string[];
  figma: readonly string[];
  forbiddenEvents: readonly string[];
  /** Canvas-stamped token refs that must survive propose (slash names → dots). */
  stamped: readonly string[];
};

const EXPECT: Record<string, StemExpect> = {
  'Alert (flowbite.alert)': {
    id: 'flowbite.alert',
    name: 'Alert',
    element: 'div',
    props: ['color', 'icon', 'dismissable', 'children'],
    figma: ['Color', 'Icon', 'Dismissable', 'Content'],
    forbiddenEvents: ['onDismiss', 'onClick'],
    stamped: [
      '{imported.shared.size-8}',
      '{imported.shared.size-16}',
      '{imported.alert.root.background-color.{color}}',
      '{imported.shared.size-14}',
      '{imported.alert.label.font-weight}',
    ],
  },
  'Badge (flowbite.badge)': {
    id: 'flowbite.badge',
    name: 'Badge',
    element: 'span',
    props: ['color', 'size', 'children'],
    figma: ['Color', 'Size', 'Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.badge.root.padding-left}',
      '{imported.shared.size-4}',
      '{imported.badge.root.background-color.{color}}',
      '{imported.badge.root.background-color-state-hover.{color}}',
      '{imported.badge.label.font-size.{size}}',
    ],
  },
  'Button (flowbite.button)': {
    id: 'flowbite.button',
    name: 'Button',
    element: 'button',
    props: ['color', 'size', 'children'],
    figma: ['Color', 'Size', 'Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.button.root.padding-left.{size}}',
      '{imported.shared.size-8}',
      '{imported.button.root.background-color.{color}}',
      '{imported.button.root.border-top-color.{color}}',
      '{imported.button.root.border-top-width.{color}}',
      '{imported.button.root.background-color-state-hover.{color}}',
      '{imported.button.root.outline-color-state-focus-visible}',
      '{imported.button.root.outline-width-state-focus-visible}',
      '{imported.button.root.font-size.{size}}',
      '{imported.button.root.color-state-hover.{color}}',
    ],
  },
  'Card (flowbite.card)': {
    id: 'flowbite.card',
    name: 'Card',
    element: 'div',
    props: ['children'],
    figma: ['Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.shared.size-8}',
      '{imported.shared.size-1}',
      '{imported.card.root.background-color}',
      '{imported.shared.color-e5e7eb}',
      '{imported.card.label.font-weight}',
      '{imported.shared.size-24}',
    ],
  },
  HelperText: {
    id: 'flowbite.helpertext',
    name: 'HelperText',
    element: 'div',
    props: ['color', 'children'],
    figma: ['Color', 'Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.helper-text.root.width}',
      '{imported.helper-text.root.color.{color}}',
      '{imported.helper-text.root.font-size}',
    ],
  },
  Kbd: {
    id: 'flowbite.kbd',
    name: 'Kbd',
    element: 'span',
    props: ['children'],
    figma: ['Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.kbd.root.width}',
      '{imported.shared.size-8}',
      '{imported.kbd.root.background-color}',
      '{imported.shared.color-e5e7eb}',
      '{imported.kbd.root.font-size}',
    ],
  },
  Label: {
    id: 'flowbite.label',
    name: 'Label',
    element: 'label',
    props: ['color', 'children'],
    figma: ['Color', 'Content'],
    forbiddenEvents: ['onClick'],
    stamped: [
      '{imported.label.root.width}',
      '{imported.label.root.color.{color}}',
      '{imported.label.root.font-size}',
    ],
  },
  ToggleSwitch: {
    id: 'flowbite.toggleswitch',
    name: 'ToggleSwitch',
    element: 'button',
    role: 'switch',
    props: ['sizing', 'checked', 'label'],
    figma: ['Sizing', 'Checked', 'Label'],
    forbiddenEvents: ['onToggle', 'onClick'],
    stamped: [
      '{imported.toggle-switch.root.width.{sizing}}',
      '{imported.toggle-switch.label.margin-left}',
      '{imported.toggle-switch.part-0.background-color.{checked}}',
      '{imported.toggle-switch.part-0.width.{sizing}}',
      '{imported.shared.size-9999}',
      '{imported.toggle-switch.label.font-size}',
    ],
  },
};

type DumpLike = {
  bound?: Record<string, string>;
  fill?: { var?: string };
  stroke?: { var?: string };
  strokeWeight?: number;
  strokeAlign?: string;
  minWidth?: number;
  cornerRadius?: number;
  text?: {
    fontSize?: number | null;
    fontSizeVar?: string;
    fontWeightVar?: string;
    lineHeight?: number;
    lineHeightVar?: string;
    fillVar?: string;
  };
  children?: DumpLike[];
  variantProperties?: Record<string, string>;
  variants?: DumpLike[];
};

/** Live dump.plugin extras the compact hop-4 fixture omits. Geometry
 *  (abs / fixedSize) is not injected — FC-GEOMETRY-EXCLUDED. */
const injectLiveDumpExtras = (node: DumpLike): void => {
  const bound = node.bound ?? {};
  if (
    node.text?.lineHeightVar &&
    node.text.lineHeight === undefined &&
    typeof node.text.fontSize === 'number'
  ) {
    node.text.lineHeight = node.text.fontSize;
  }
  if (
    node.stroke &&
    node.strokeWeight === undefined &&
    (bound.strokeTopWeight ||
      bound.strokeBottomWeight ||
      bound.strokeLeftWeight ||
      bound.strokeRightWeight)
  ) {
    node.strokeWeight = 0;
  }
  if (node.stroke && node.strokeAlign === undefined) {
    node.strokeAlign = 'INSIDE';
  }
  if (bound.minWidth && node.minWidth === undefined) {
    node.minWidth = 44;
  }
  if (
    (bound.topLeftRadius ||
      bound.topRightRadius ||
      bound.bottomLeftRadius ||
      bound.bottomRightRadius) &&
    node.cornerRadius === undefined
  ) {
    node.cornerRadius = 8;
  }
  for (const child of node.children ?? []) injectLiveDumpExtras(child);
  for (const variant of node.variants ?? []) injectLiveDumpExtras(variant);
};

const mintedNames = (notes: string[]): string[] => {
  const names: string[] = [];
  for (const note of notes) {
    for (const match of note.matchAll(/MINTED \{([^}]+)\}/g)) {
      names.push(match[1]);
    }
  }
  return names.sort();
};

const collectStamps = (node: DumpLike, acc: Set<string>): void => {
  if (node.bound) {
    for (const name of Object.values(node.bound)) {
      if (typeof name === 'string') acc.add(name);
    }
  }
  if (typeof node.fill?.var === 'string') acc.add(node.fill.var);
  if (typeof node.stroke?.var === 'string') acc.add(node.stroke.var);
  if (node.text) {
    for (const key of ['fontSizeVar', 'fontWeightVar', 'lineHeightVar', 'fillVar'] as const) {
      const value = node.text[key];
      if (typeof value === 'string') acc.add(value);
    }
  }
  for (const child of node.children ?? []) collectStamps(child, acc);
};

const axisValuesOf = (set: DumpLike): Set<string> => {
  const values = new Set<string>();
  for (const variant of set.variants ?? []) {
    for (const value of Object.values(variant.variantProperties ?? {})) {
      values.add(value.toLowerCase());
    }
  }
  return values;
};

const stampRecovered = (contractJson: string, stamp: string, axisValues: Set<string>): boolean => {
  const dotted = stamp.replaceAll('/', '.');
  if (contractJson.includes(`{${dotted}}`)) return true;
  const parts = dotted.split('.');
  const last = parts[parts.length - 1];
  if (last && axisValues.has(last.toLowerCase())) {
    const base = parts.slice(0, -1).join('.');
    if (contractJson.includes(`{${base}.{`)) return true;
  }
  return false;
};

const dump = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>;
const hugSizing: string[] = [];
const walkSizing = (node: DumpLike, path: string): void => {
  const layout = (node as { layout?: { primarySizing?: string; counterSizing?: string } }).layout;
  if (layout?.primarySizing === 'HUG') hugSizing.push(`${path}.primarySizing`);
  if (layout?.counterSizing === 'HUG') hugSizing.push(`${path}.counterSizing`);
  for (const child of node.children ?? []) walkSizing(child, `${path}/${(child as { name?: string }).name ?? '?'}`);
  for (const variant of node.variants ?? []) walkSizing(variant, `${path}/${(variant as { name?: string }).name ?? '?'}`);
};
for (const [setName, setDump] of Object.entries(dump)) {
  if (setName.startsWith('_')) continue;
  walkSizing(setDump as DumpLike, setName);
}
check(
  'fixture layout sizing is AUTO|FIXED, never HUG (FC-HOP4-SIZING-HUG-INVENTED)',
  hugSizing.length === 0,
);
const verticalHugHeight = (setName: string): boolean => {
  const setDump = dump[setName] as DumpLike | undefined;
  const root = setDump?.variants?.[0];
  const layout = (root as { layout?: { mode?: string; primarySizing?: string; counterSizing?: string } } | undefined)
    ?.layout;
  return layout?.mode === 'VERTICAL' && layout.primarySizing === 'AUTO' && layout.counterSizing === 'FIXED';
};
for (const name of ['Kbd', 'Label', 'HelperText'] as const) {
  check(
    `${name}: VERTICAL root is live AUTO×FIXED, not swapped FIXED×AUTO (FC-HOP4-SIZING-AXES-SWAPPED)`,
    verticalHugHeight(name),
  );
}
const provenance = dump._provenance as { dumpVersion?: string } | undefined;
check(
  'fixture dumpVersion is 1.30 (FC-DUMP-MINMAX-ZERO-INVENTED)',
  provenance?.dumpVersion === '1.30',
);
const dumpPlugin = readFileSync(path.join(ROOT, 'extract', 'figma', 'dump.plugin.js'), 'utf8');
check(
  'dump.plugin.js still declares dumpVersion 1.30',
  /dumpVersion: '1\.30'/.test(dumpPlugin),
);
const flowbiteSetName = 'Alert (flowbite.alert)';
const scopedDump = dumpPlugin.replace(
  /^const TARGET_SETS = \[[^\n]*\];$/m,
  `const TARGET_SETS = ${JSON.stringify([flowbiteSetName])};`,
);
check(
  'dump TARGET_SETS seam scopes a Flowbite parenthetical set name',
  scopedDump !== dumpPlugin &&
    scopedDump.includes(`const TARGET_SETS = ${JSON.stringify([flowbiteSetName])};`),
);

const loaded = loadContracts(path.join(ROOT, 'examples', 'tailwind', 'contracts'));
const corpus = loadTokenCorpus(ROOT, {
  files: [
    'examples/tailwind/tokens/tailwind.dtcg.json',
    'examples/tailwind/tokens/tailwind-minted.dtcg.json',
  ],
});

const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  contractIdByKey: loaded.byKey,
  fileKey: (dump._provenance as { fileKey?: string } | undefined)?.fileKey ?? null,
  projectionMode: 'exact',
  mintUnbound: true,
});

check(
  'all eight pipeline-drawn Flowbite stems propose (no skip)',
  batch.skipped.length === 0 && batch.proposals.length === 8,
);
if (batch.skipped.length > 0) {
  for (const skip of batch.skipped) {
    console.log(`    skip: ${skip.setName}: ${skip.reason}${skip.detail ? ` — ${skip.detail}` : ''}`);
  }
}

const byName = new Map(batch.proposals.map((p) => [p.setName, p]));
for (const [setName, expect] of Object.entries(EXPECT)) {
  const proposal = byName.get(setName);
  const contract = (proposal?.contract ?? {}) as {
    id?: string;
    props?: Array<{
      name?: string;
      bindings?: { figma?: { property?: string }; code?: { prop?: string } };
    }>;
    events?: Array<{ name?: string; bindings?: { code?: { prop?: string } } }>;
    semantics?: { element?: string; role?: string };
  };
  const propNames = new Set(
    (contract.props ?? []).map((p) => p.name).filter((n): n is string => typeof n === 'string'),
  );
  const figmaProps = new Set(
    (contract.props ?? [])
      .map((p) => p.bindings?.figma?.property)
      .filter((n): n is string => typeof n === 'string'),
  );
  const eventNames = [
    ...(contract.events ?? []).map((e) => e.name),
    ...(contract.events ?? []).map((e) => e.bindings?.code?.prop),
    ...propNames,
  ].filter((n): n is string => typeof n === 'string');

  check(
    `${setName}: recovers stamped contract id ${expect.id}`,
    contract.id === expect.id,
  );
  check(
    `${setName}: recovers authored name ${expect.name} (not a parenthetical remint)`,
    (proposal?.contract as { name?: string }).name === expect.name,
  );
  const dumpSet = dump[setName] as { specHash?: string; version?: string };
  check(
    `${setName}: recovers stamped specHash (not a silent drop)`,
    typeof dumpSet.specHash === 'string' &&
      /^\d+$/.test(dumpSet.specHash) &&
      (proposal?.notes ?? []).some(
        (n) => n.includes('ds_contracts/specHash') && n.includes(dumpSet.specHash!),
      ),
  );
  check(
    `${setName}: recovers stamped version 0.2.0 (not invented 0.1.0)`,
    dumpSet.version === '0.2.0' &&
      (proposal?.contract as { version?: string }).version === '0.2.0' &&
      (proposal?.notes ?? []).some((n) => n.includes('ds_contracts/version') && n.includes('0.2.0')),
  );
  check(
    `${setName}: recovers ${expect.props.join(' / ')}`,
    expect.props.every((name) => propNames.has(name)),
  );
  check(
    `${setName}: recovers Figma ${expect.figma.join(' / ')}`,
    expect.figma.every((name) => figmaProps.has(name)),
  );
  check(
    `${setName}: host ${expect.element}${expect.role ? ` role=${expect.role}` : ''}`,
    contract.semantics?.element === expect.element &&
      (expect.role === undefined || contract.semantics?.role === expect.role),
  );
  check(
    `${setName}: does not invent ${expect.forbiddenEvents.join(' / ')}`,
    expect.forbiddenEvents.every((name) => !eventNames.includes(name)),
  );
  check(
    `${setName}: does not invent State as an API prop`,
    !propNames.has('state') && !figmaProps.has('State'),
  );
  check(
    `${setName}: does not invent disabled as an API prop (FC-DUMP-PROPOSE-DISABLED-INVENTED)`,
    !propNames.has('disabled') && !figmaProps.has('Disabled'),
  );
  check(
    `${setName}: exact projection verifies`,
    proposal?.projection.status === 'verified-exact',
  );
  const contractJson = JSON.stringify(contract);
  check(
    `${setName}: recovers stamped tokens ${expect.stamped.join(' / ')}`,
    expect.stamped.every((ref) => contractJson.includes(ref)),
  );
  const setDump = dump[setName] as DumpLike | undefined;
  const stamps = new Set<string>();
  for (const variant of setDump?.variants ?? []) collectStamps(variant, stamps);
  const missed = [...stamps]
    .sort()
    .filter((stamp) => !stampRecovered(contractJson, stamp, axisValuesOf(setDump ?? {})));
  check(
    `${setName}: recovers every dump-stamped name (${stamps.size} stamps)`,
    missed.length === 0,
  );
  if (missed.length > 0) {
    for (const stamp of missed.slice(0, 12)) console.log(`    miss: ${stamp}`);
  }
}

type RootLayout = {
  direction?: string;
  justify?: string;
  align?: string;
};
const rootLayoutOf = (setName: string): RootLayout | null =>
  (
    (byName.get(setName)?.contract ?? {}) as {
      anatomy?: { root?: { layout?: RootLayout } };
    }
  ).anatomy?.root?.layout ?? null;
check(
  'Button: row/center/center elides to emit default (FC-HOP4-LAYOUT-TUPLE)',
  rootLayoutOf('Button (flowbite.button)') === null,
);
const badgeLayout = rootLayoutOf('Badge (flowbite.badge)');
check(
  'Badge: keeps row + align center (live MIN×CENTER, not elided)',
  badgeLayout?.direction === 'row' &&
    badgeLayout.align === 'center' &&
    badgeLayout.justify === undefined,
);
const toggleLayout = rootLayoutOf('ToggleSwitch');
check(
  'ToggleSwitch: keeps row + align center (live MIN×CENTER)',
  toggleLayout?.direction === 'row' &&
    toggleLayout.align === 'center' &&
    toggleLayout.justify === undefined,
);
for (const name of [
  'Alert (flowbite.alert)',
  'Card (flowbite.card)',
  'HelperText',
  'Kbd',
  'Label',
]) {
  const layout = rootLayoutOf(name);
  check(
    `${name}: column root (live MIN×MIN; justify/align omitted)`,
    layout?.direction === 'column' &&
      layout.justify === undefined &&
      layout.align === undefined,
  );
}

const census = JSON.parse(readFileSync(CENSUS, 'utf8')) as {
  count?: number;
  stamps?: Record<string, string[]>;
};
const censusStamps = census.stamps ?? {};
for (const [setName, liveList] of Object.entries(censusStamps)) {
  const setDump = dump[setName] as DumpLike | undefined;
  const fixture = new Set<string>();
  for (const variant of setDump?.variants ?? []) collectStamps(variant, fixture);
  const liveOnly = liveList.filter((stamp) => !fixture.has(stamp));
  const fixtureOnly = [...fixture].filter((stamp) => !liveList.includes(stamp));
  check(
    `${setName}: fixture stamps match the live census (${liveList.length})`,
    liveOnly.length === 0 && fixtureOnly.length === 0,
  );
  if (liveOnly.length > 0) {
    for (const stamp of liveOnly.slice(0, 8)) console.log(`    live-only: ${stamp}`);
  }
  if (fixtureOnly.length > 0) {
    for (const stamp of fixtureOnly.slice(0, 8)) console.log(`    fixture-only: ${stamp}`);
  }
}

const alertPart0 = (
  (byName.get("Alert (flowbite.alert)")?.contract ?? {}) as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "alert-icon"?: {
                visibleWhen?: { prop?: string };
                parts?: Record<
                  string,
                  {
                    parts?: Record<string, { tokens?: Record<string, string> }>;
                  }
                >;
              };
              dismiss?: {
                tokens?: Record<string, string>;
                visibleWhen?: { prop?: string };
                parts?: Record<
                  string,
                  {
                    parts?: Record<string, { tokens?: Record<string, string> }>;
                  }
                >;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts;
const alertVectorColors = Object.values(alertPart0?.["alert-icon"]?.parts ?? {})
  .flatMap((icon) => Object.values(icon.parts ?? {}))
  .map((vec) => vec.tokens?.["background-color"])
  .filter((ref): ref is string => typeof ref === "string");
const dismissVectorColor = Object.values(alertPart0?.dismiss?.parts ?? {})
  .flatMap((icon) => Object.values(icon.parts ?? {}))
  .map((vec) => vec.tokens?.["background-color"])
  .find((ref): ref is string => typeof ref === "string");
check(
  "Alert: dump vector-geometry receipts reach proposal notes, not a silent drop",
  (byName.get("Alert (flowbite.alert)")?.notes ?? []).filter((n) =>
    n.includes("dump vector-geometry-unsupported:"),
  ).length === 8,
);
check(
  "Button: dump names CHANGE_TO reactions, does not invent onClick",
  (byName.get("Button (flowbite.button)")?.notes ?? []).filter((n) =>
    n.includes("dump prototype-reactions-unsupported:"),
  ).length === 5 &&
    !(byName.get("Button (flowbite.button)")?.contract as { events?: unknown }).events,
);
check(
  "Badge: dump names CHANGE_TO reactions, does not invent onClick",
  (byName.get("Badge (flowbite.badge)")?.notes ?? []).filter((n) =>
    n.includes("dump prototype-reactions-unsupported:"),
  ).length === 6 &&
    !(byName.get("Badge (flowbite.badge)")?.contract as { events?: unknown }).events,
);
check(
  "Alert: recovers nested Vector fill + dismiss bind, not a paint drop",
  alertPart0?.["alert-icon"]?.visibleWhen?.prop === "icon" &&
    alertPart0?.dismiss?.visibleWhen?.prop === "dismissable" &&
    alertPart0?.dismiss?.tokens?.["background-color"] ===
      "{imported.alert.root.background-color.{color}}" &&
    alertPart0?.dismiss?.tokens?.["border-radius"] === "{imported.shared.size-8}" &&
    alertVectorColors.some((ref) => ref.includes("imported.alert.label.color")) &&
    dismissVectorColor === "{imported.alert.label.color.{color}}",
);

const toggleAfter = (
  (byName.get("ToggleSwitch")?.contract ?? {}) as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "part-0-after"?: {
                shape?: { kind?: string };
                stylesWhen?: Array<{
                  prop?: string;
                  equals?: string;
                  styles?: Record<string, string>;
                }>;
                literalsByProp?: Array<{
                  prop?: string;
                  map?: Record<string, Record<string, string>>;
                }>;
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts?.["part-0-after"];
const toggleWhen = toggleAfter?.stylesWhen ?? [];
check(
  "ToggleSwitch: recovers dump v1.3 thumb ellipse (not empty part-0-after)",
  toggleAfter?.shape?.kind === "ellipse" &&
    toggleWhen.some(
      (row) =>
        row.prop === "checked" &&
        row.equals === "unchecked" &&
        row.styles?.left === "2px",
    ) &&
    toggleWhen.some(
      (row) =>
        row.prop === "checked" &&
        row.equals === "checked" &&
        row.styles?.right === "2px",
    ),
);
const toggleSizeMap = toggleAfter?.literalsByProp?.find((e) => e.prop === "sizing")?.map;
check(
  "ToggleSwitch: recovers per-size thumb (16/20/24) as literalsByProp, not first-variant freeze",
  toggleSizeMap?.sm?.width === "16px" &&
    toggleSizeMap?.md?.width === "20px" &&
    toggleSizeMap?.lg?.width === "24px",
);
const toggleCheckedPaint = toggleAfter?.literalsByProp?.find((e) => e.prop === "checked")?.map;
check(
  "ToggleSwitch: recovers unbound thumb paint as shape literals, not a dump-slug mint",
  toggleAfter?.literals?.["background-color"] === "#ffffff" &&
    toggleAfter?.literals?.["border-width"] === "1px" &&
    toggleAfter?.tokens?.["background-color"] === undefined &&
    toggleCheckedPaint?.unchecked?.["border-color"] === "#d1d5db" &&
    toggleCheckedPaint?.checked?.["border-color"] === "#00000000",
);

const buttonStates = (
  (byName.get("Button (flowbite.button)")?.contract ?? {}) as {
    anatomy?: { root?: { states?: Record<string, Record<string, string>> } };
  }
).anatomy?.root?.states;
check(
  "Button: recovers state-only DROP_SHADOW as states.active / focus-visible box-shadow",
  typeof buttonStates?.active?.["box-shadow"] === "string" &&
    typeof buttonStates?.["focus-visible"]?.["box-shadow"] === "string",
);
check(
  "Button: unbound state DROP_SHADOW recovers authored tokens, not dump-slug mints (FC-DUMP-PROPOSE-SHADOW-MINTED)",
  buttonStates?.active?.["box-shadow"] ===
    "{imported.button.root.box-shadow-state-active.{color}}" &&
    buttonStates?.["focus-visible"]?.["box-shadow"] ===
      "{imported.button.root.box-shadow-state-focus-visible.{color}}" &&
    !JSON.stringify(byName.get("Button (flowbite.button)")?.contract).includes(
      "imported.button-flowbite-button.state-active.box-shadow",
    ) &&
    !JSON.stringify(byName.get("Button (flowbite.button)")?.contract).includes(
      "imported.button-flowbite-button.state-focus-visible.box-shadow",
    ),
);
check(
  "Button: unbound Disabled opacity recovers the authored token, not a dump-slug mint (FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED)",
  buttonStates?.disabled?.opacity ===
    "{imported.button.root.opacity-state-disabled}" &&
    !JSON.stringify(byName.get("Button (flowbite.button)")?.contract).includes(
      "imported.button-flowbite-button.state-disabled.opacity",
    ),
);
const alertNested = (
  (byName.get("Alert (flowbite.alert)")?.contract ?? {}) as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "alert-icon"?: {
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
              dismiss?: {
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts;
const alertJson = JSON.stringify(byName.get("Alert (flowbite.alert)")?.contract ?? {});
check(
  "Alert: unbound icon/dismiss padding recovers authored literals, not dump-slug mints (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED)",
  alertNested?.["alert-icon"]?.literals?.["padding-right"] === "12px" &&
    alertNested?.dismiss?.literals?.["padding-left"] === "6px" &&
    alertNested?.dismiss?.literals?.["padding-right"] === "6px" &&
    alertNested?.dismiss?.literals?.["padding-top"] === "6px" &&
    alertNested?.dismiss?.literals?.["padding-bottom"] === "6px" &&
    !alertJson.includes("imported.alert-flowbite-alert.part-0-alert-icon.padding-right") &&
    !alertJson.includes("imported.alert-flowbite-alert.part-0-dismiss.padding"),
);
const cardRootTokens = (
  (byName.get("Card (flowbite.card)")?.contract ?? {}) as {
    anatomy?: { root?: { tokens?: Record<string, string> } };
  }
).anatomy?.root?.tokens;
check(
  "Card: recovers all-variant DROP_SHADOW stack as tokens.box-shadow, not a named drop",
  typeof cardRootTokens?.["box-shadow"] === "string" &&
    cardRootTokens["box-shadow"].includes("box-shadow"),
);
check(
  "Card: unbound DROP_SHADOW recovers the authored token, not a dump-slug mint (FC-DUMP-PROPOSE-SHADOW-MINTED)",
  cardRootTokens?.["box-shadow"] === "{imported.card.root.box-shadow}" &&
    !JSON.stringify(byName.get("Card (flowbite.card)")?.contract).includes(
      "imported.card-flowbite-card.root.box-shadow",
    ),
);
const cardLabelText = (
  (byName.get("Card (flowbite.card)")?.contract ?? {}) as {
    anatomy?: {
      root?: {
        parts?: {
          label?: {
            parts?: {
              "label-text"?: {
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.label?.parts?.["label-text"];
check(
  "Card: recovers unbound label-text fill as literal #000000, not a dump-slug mint",
  cardLabelText?.literals?.color === "#000000" &&
    cardLabelText?.tokens?.color === undefined &&
    !JSON.stringify(byName.get("Card (flowbite.card)")?.contract).includes(
      "imported.card-flowbite-card.label",
    ),
);

for (const name of ['Kbd', 'Label', 'HelperText'] as const) {
  const minted = mintedNames(byName.get(name)?.notes ?? []);
  check(
    `${name}: hug-height VERTICAL root does not mint a height dump-slug (FC-HOP4-SIZING-AXES-SWAPPED)`,
    minted.every((token) => !token.endsWith('.root.height')),
  );
}

const liveDump = JSON.parse(JSON.stringify(dump)) as Record<string, unknown>;
for (const [setName, setDump] of Object.entries(liveDump)) {
  if (setName.startsWith('_')) continue;
  injectLiveDumpExtras(setDump as DumpLike);
}
const liveBatch = proposeBatchFromDump(liveDump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  contractIdByKey: loaded.byKey,
  fileKey: (dump._provenance as { fileKey?: string } | undefined)?.fileKey ?? null,
  projectionMode: 'exact',
  mintUnbound: true,
});
check(
  'live dump extras still propose all eight stems (no skip)',
  liveBatch.skipped.length === 0 && liveBatch.proposals.length === 8,
);
const baselineMints = mintedNames(batch.proposals.flatMap((p) => p.notes ?? []));
const liveMints = mintedNames(liveBatch.proposals.flatMap((p) => p.notes ?? []));
const extraMints = liveMints.filter((name) => !baselineMints.includes(name));
const geometryRemint =
  /^imported\.button-flowbite-button\.root\.height\.(xs|sm|md|lg|xl)$/;
check(
  'no dump-slug remints except Button root.height (FC-HOP4-GEOMETRY-REMINTS-ONLY)',
  baselineMints.every((name) => geometryRemint.test(name)),
);
if (baselineMints.some((name) => !geometryRemint.test(name))) {
  for (const name of baselineMints.filter((n) => !geometryRemint.test(n)).slice(0, 8)) {
    console.log(`    non-geometry mint: {${name}}`);
  }
}
check(
  'live dump extras do not add MINTED dump-slugs (FC-HOP4-LIVE-EXTRAS-SAME-AS-ABSENT)',
  extraMints.length === 0,
);
if (extraMints.length > 0) {
  for (const name of extraMints.slice(0, 8)) console.log(`    extra mint: {${name}}`);
}
for (const proposal of liveBatch.proposals) {
  check(
    `${proposal.setName}: live extras still verify-exact`,
    proposal.projection.status === 'verified-exact',
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} flowbite dump→propose check(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\nflowbite dump→propose check passed (eight stems).');
