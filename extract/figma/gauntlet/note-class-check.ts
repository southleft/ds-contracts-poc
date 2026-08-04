/**
 * FALSIFICATION for the carriage-gap stem (gauntlet/note-class.ts).
 *
 * Two failures are possible and only one of them is loud. UNDER-merging mints
 * a class per note and the convergence metric silently starts measuring kit
 * size. OVER-merging is worse: two different defects filed under one name is a
 * false receipt, and the second defect disappears from the count that is
 * supposed to drive the next round.
 *
 * So this pins BOTH directions on hand-built pairs, plus the corpus shapes
 * that actually broke: the `bound at:` path list (which used to become the
 * class name), the `UNBOUND <path> <field> = <value>` head that carries no
 * `': '`, a part name containing a comma, and a set name containing an
 * em-dash. Every case is a verbatim note shape from the committed dumps.
 *
 * `npx tsx extract/figma/gauntlet/note-class-check.ts` — pure, reads nothing.
 */
import { noteClassOf } from './note-class.js';

const failures: string[] = [];
const check = (label: string, cond: boolean): void => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

/** SAME rule, different instance → ONE class. */
const same = (label: string, a: [string, string], b: [string, string]): void => {
  const ca = noteClassOf(a[0], a[1]);
  const cb = noteClassOf(b[0], b[1]);
  check(`${label} — collapse (${JSON.stringify(ca)})`, ca === cb && ca.length > 0);
};

/** DIFFERENT rule → different classes, however similar the prose. */
const apart = (label: string, a: [string, string], b: [string, string]): void => {
  const ca = noteClassOf(a[0], a[1]);
  const cb = noteClassOf(b[0], b[1]);
  check(`${label} — stay apart (${JSON.stringify(ca)} vs ${JSON.stringify(cb)})`, ca !== cb);
};

console.log('carriage-gap stem — SAME failure mode, different path/value/count:');

same(
  'minted token, different ref/value/bound-at list',
  [
    'MINTED {imported.shared.size-24} = 24px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: _variable-list-item:root gap, _variable-list-item:root padding-inline',
    '_variable-list-item',
  ],
  [
    'MINTED {imported.typography-list-item.root.padding-block} = 16px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: _typography-list-item:root padding-block',
    '_typography-list-item',
  ],
);

same(
  'unbound literal, different part path / channel / value',
  [
    'UNBOUND Accordion:root minHeight = 32 — no token invented; nearest tokens by value: {size.avatar.md}, {size.switch.width}',
    'Accordion',
  ],
  [
    'UNBOUND Badge Notification:root/Label fontSize = 14 — no token invented; nearest tokens by value: (none found)',
    'Badge Notification',
  ],
);

same(
  'duplicate part name, different parts and different sets',
  [
    'Menu:root/List item 2: part name "Text" already names another part of this contract (part names are contract-wide: CSS classes, swap layers, and note paths key on them) — renamed to "text2"',
    'Menu',
  ],
  [
    'Table / Data grid:root/Header/Cell: part name "Label" already names another part of this contract (part names are contract-wide: CSS classes, swap layers, and note paths key on them) — renamed to "label3"',
    'Table / Data grid',
  ],
);

same(
  'axis-value vocabulary miss, different count of offending variant names',
  ['variant axis "state": named like an interaction-state axis but value(s) filled are outside the interaction-state vocabulary (default|hover|focus) — kept as an enum prop', 'Chip'],
  [
    'variant axis "state": named like an interaction-state axis but value(s) selected, truncation, open are outside the interaction-state vocabulary (default|hover|focus) — kept as an enum prop',
    'List item',
  ],
);

same(
  'a part name containing a comma does not leak into the class',
  [
    'Dialog:root/Container/Lorem ipsum dolor sit amet, consectetur adipiscing elit.: typography varies across variants (fontSize 16/14, weight Regular) — no single text-style identity adopted',
    'Dialog',
  ],
  ['Tooltip:root/Body: typography varies across variants (fontSize 12/11, weight Semi Bold) — no single text-style identity adopted', 'Tooltip'],
);

same(
  'a set name containing an em-dash does not truncate the rule',
  [
    'Badge (ds.badge) — token-bound:root/label: sole root text node named "label" is the generator\'s auto-injected children label — hoisted to root tokens',
    'Badge (ds.badge) — token-bound',
  ],
  ['Alert:root/label: sole root text node named "label" is the generator\'s auto-injected children label — hoisted to root tokens', 'Alert'],
);

console.log('\ncarriage-gap stem — DIFFERENT failure modes that share a stem:');

apart(
  'illegal identifier on a PROP vs on a SLOT (same rule text, different channel)',
  ['prop `2nd paragraph`: Figma property "2nd paragraph" contains characters outside a legal identifier — name sanitized at proposal', 'Note'],
  ['slot `swapAction`: Figma property "↪️swap action" contains characters outside a legal identifier — name sanitized at proposal', 'Menu'],
);

apart(
  'a state-axis vocabulary miss vs a token-mode vocabulary miss',
  ['variant axis "state": named like an interaction-state axis but value(s) filled are outside the interaction-state vocabulary (default|hover|focus) — kept as an enum prop', 'Chip'],
  ['variant axis "Theme": named like a token-mode axis but value(s) Brand are outside the mode vocabulary (light|dark|high-contrast) — kept as an enum prop', 'Card'],
);

apart(
  'a channel NOT REPRESENTABLE vs a channel simply NOT UNIFORM',
  ['Accordion:root: padding bindings differ — padding is not representable; carried as separate padding-block/padding-inline channels', 'Accordion'],
  ['Accordion:root: corner radii bindings are not uniform — border-radius not representable, review', 'Accordion'],
);

apart(
  'geometry captured-but-not-carried vs captured-and-carried',
  ['Progress circle:root/Ring: shape geometry captured in 8/16 variants (the rest are arbitrary-path nodes) — the CAPTURED variants\' shape is carried', 'Progress circle'],
  ['Progress circle:root/Ring: shape kind differs across variants (ELLIPSE, POLYGON) — shape not carried; review', 'Progress circle'],
);

apart(
  'a bound-at path list must never BE the class',
  [
    'MINTED {imported.shared.size-24} = 24px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: A:root gap',
    'A',
  ],
  ['A:root: corner radii bindings are not uniform — border-radius not representable, review', 'A'],
);

console.log('\ncarriage-gap stem — the class never carries an instance:');
const leaky = [
  ['MINTED {imported.shared.size-24} = 24px — machine-named — rename (provisional); bound at: A:root gap, A:root padding-inline', 'A'],
  ['UNBOUND Accordion:root/Header minHeight = 32 — no token invented; nearest tokens by value: {size.avatar.md}', 'Accordion'],
  ['Dialog:root/Container/Lorem ipsum, consectetur.: typography varies across variants (fontSize 16/14) — none adopted', 'Dialog'],
] as const;
for (const [note, set] of leaky) {
  const cls = noteClassOf(note, set);
  check(`no ":root" path survives into ${JSON.stringify(cls)}`, !cls.includes(':root'));
  check(`no set name "${set}" survives into ${JSON.stringify(cls)}`, !cls.includes(set));
}

/** DETERMINISM — same input, same class, no clock and no iteration order. */
const twice = noteClassOf(leaky[0][0], leaky[0][1]) === noteClassOf(leaky[0][0], leaky[0][1]);
check('deterministic across calls', twice);

console.log(failures.length === 0 ? '\n✔ note-class: all pins hold' : `\n✘ note-class: ${failures.length} FAILED`);
if (failures.length > 0) process.exit(1);
