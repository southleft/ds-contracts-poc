/**
 * REQUIRED FACTS PER ARCHETYPE — the refuse-to-mint referee.
 *
 * The owner's rule (2026-08-24): it must be impossible to mint a set that is
 * missing a load-bearing fact — the tool refuses and NAMES what is missing. An
 * ugly mint is worse than an honest refusal.
 *
 * WHY THIS EXISTS. A set can carry ninety facts and still fail the census bar
 * ("I can tell what this is") because ONE load-bearing fact is absent, and
 * nothing in the pipeline noticed:
 *
 *   · `examples/astryx/contracts/card.contract.json` — no part carries
 *     `layout.direction: "column"`, so header/body/footer minted as ONE ROW:
 *     the card that looks like a pill.
 *   · `examples/fluent/contracts/dialog.contract.json` — same absence, same
 *     one-row mint, on a dialog.
 *   · `examples/carbon/contracts/checkbox.contract.json` — control-box
 *     geometry present, no glyph anywhere: "checked" minted as a filled
 *     rectangle.
 *
 * Every one of those was a SILENT composition: the bundle built, the plugin
 * pasted, the set appeared, and the defect was found by a human looking at the
 * canvas. This module turns each of them into a named refusal at build time.
 *
 * THE PREDICATES ARE STRUCTURAL, NEVER NAME-BASED. Captured part names
 * (`part-0`, `label-2`, `Frame 12`) are not stable across captures, so every
 * predicate is EXISTENTIAL over the anatomy tree: "some part carries a column
 * axis", not "the part named `body` carries one". A fact is PRESENT when its
 * channel appears in ANY of a part's styling channels — `tokens`, `literals`,
 * `declared`, `tokensByProp`, `literalsByProp`, `states`, `statesByProp`,
 * `declaredStates` — because all eight are channels the surfaces draw from.
 *
 * PURE: contract in, findings out. No fs, no process, no token resolution. The
 * design's one GLOBAL fact (`type-scale/rem-base`) is deliberately ABSENT —
 * see the section at the bottom of this file for the measurement that killed
 * its premise.
 *
 * WHO CALLS IT:
 *   · `ds-contracts figma bundle` — WARNS by default, REFUSES under
 *     `--strict` / `DS_REQUIRED_FACTS=refuse`. A bundle is the artifact a
 *     designer pastes; nothing missing a required fact may enter one.
 *   · `emitFigmaScript` / `createFigmaEngine` — the same call, so a bundle
 *     built by an older CLI inherits the refusal when the plugin engine
 *     compiles it.
 *   · `generate` (both shells) — WARNS, never refuses: code renders through
 *     CSS inheritance and survives absences the canvas cannot.
 *   · `npm run required-facts:check` — the gate, over every census contract,
 *     against a committed baseline: today's reds are frozen by name, a NEW red
 *     fails CI.
 */
import {
  resolveArchetype,
  type Archetype,
  type Contract,
  type Part,
} from '@ds-contracts/schema';

// ---------------------------------------------------------------------------
// The fact table
// ---------------------------------------------------------------------------

/** ANY-OF over channels, on the root or on any part. */
export interface ChannelPredicate {
  kind: 'channel';
  channels: string[];
  scope: 'root' | 'any';
}

/** ONE part carries at least one channel from EVERY group — the conjunction a
 *  flat any-of cannot express (a control box needs width AND height on the
 *  SAME part; a label's width must not satisfy the box's height). */
export interface ChannelAllPredicate {
  kind: 'channelAll';
  groups: string[][];
  scope: 'root' | 'any';
}

/** A layout axis. `"any"` matches a layout that declares `display` without a
 *  direction (CSS flex defaults to row, and the canvas draws it as a row). */
export interface LayoutPredicate {
  kind: 'layout';
  directions: Array<'row' | 'column' | 'any'>;
  scope: 'root' | 'any';
}

/** The component has a second plane: declared `states`, per-part state
 *  channels, or an enum/boolean prop axis. */
export interface StatesOrAxisPredicate {
  kind: 'statesOrAxis';
}

/** A glyph exists: an `icon` part, a `shape` part, an SVG asset part, or a
 *  component ref to a contract whose id/name reads as an icon. */
export interface IconPredicate {
  kind: 'icon';
}

/** A width behaviour, or text content to hug (the honest alternative to a
 *  declared width — a hug WITH content is a box; a hug with nothing is the
 *  30px sliver). */
export interface WidthOrContentPredicate {
  kind: 'widthOrContent';
}

/** The anatomy carries at least `n` parts (root included). */
export interface MinPartsPredicate {
  kind: 'minParts';
  n: number;
}

/** ONE fact, two honest ways to carry it — an icon button has no inline
 *  padding because it is sized by a fixed W×H, and demanding both would red a
 *  contract that is right. Never a way to smuggle a weaker fact in beside a
 *  strong one: each branch has to be sufficient ON ITS OWN. */
export interface AnyOfPredicate {
  kind: 'anyOf';
  of: FactPredicate[];
}

export type FactPredicate =
  | ChannelPredicate
  | ChannelAllPredicate
  | LayoutPredicate
  | StatesOrAxisPredicate
  | IconPredicate
  | WidthOrContentPredicate
  | MinPartsPredicate
  | AnyOfPredicate;

export interface RequiredFact {
  /** `<archetype-slug>/<fact>` — the stable name a refusal cites. */
  id: string;
  /** The fact-noun the refusal names ("interior layout", "a glyph"). */
  noun: string;
  /** The predicate stated in plain words, for the refusal line. */
  stated: string;
  /** One line: why a set without it fails "I can tell what this is". */
  why: string;
  predicate: FactPredicate;
}

export interface ArchetypeFacts {
  /** Missing ⇒ REFUSE to mint (warn until the posture flips). */
  required: RequiredFact[];
  /** Missing ⇒ WARN, always. Named, never enforced. */
  expected: RequiredFact[];
}

const ink = (channels: string[], scope: 'root' | 'any'): ChannelPredicate => ({
  kind: 'channel',
  channels,
  scope,
});

/** A FILL, in both spellings the corpus uses. The CSS-module captures carry
 *  the shorthand (`"background": "{p.color-avatar-one-bg-fill}"` on polaris's
 *  avatar), and a fact that is present is present — a predicate that reads only
 *  the longhand reds a contract for its spelling, which is a defect in the
 *  referee, not in the contract. */
const FILL = ['background-color', 'background'];
const SURFACE_INK = [...FILL, 'border-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'box-shadow'];
const BOX_GRAMMAR = ['border-color', 'border-width', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width', ...FILL, 'box-shadow'];
const PADDING_INLINE = ['padding-left', 'padding-right', 'padding-inline', 'padding-inline-start', 'padding-inline-end', 'padding'];
const PADDING_ANY = [...PADDING_INLINE, 'padding-top', 'padding-bottom', 'padding-block', 'padding-block-start', 'padding-block-end'];
const TYPE_FACT = ['font-size', 'line-height'];
const WIDTH_GROUP = ['width', 'min-width'];
const HEIGHT_GROUP = ['height', 'min-height'];

/**
 * THE TABLE. Twenty archetypes. The twelve PROVEN classes (docs/23 §C.1.1)
 * plus `select / combobox` and `modal / dialog` — bounded classes the owner
 * named in his rejects, so they carry required facts too. The remaining
 * bounded and never-attempted classes carry required facts of the same shape;
 * they are enforced by the same code path and flip with the same posture.
 */
export const ARCHETYPE_REQUIRED_FACTS: Record<Exclude<Archetype, 'unmapped'>, ArchetypeFacts> = {
  button: {
    required: [
      {
        id: 'button/row-layout',
        noun: 'a row axis',
        stated: 'the root carries no layout with direction "row"',
        why: 'a button is a centered row; with no layout the label sits at the frame\'s top-left corner.',
        predicate: { kind: 'layout', directions: ['row', 'any'], scope: 'root' },
      },
      {
        id: 'button/padding-inline',
        noun: 'inline padding',
        stated:
          'no part carries padding-left / padding-right / padding-inline, and the root declares no fixed box either',
        why:
          'without inline padding the label touches the edge — the rejected sliver look. An ICON button is the ' +
          'exception and carries the box instead: ds.icon-button is a fixed W=H square with justify center, and ' +
          'demanding padding of it would red a contract that is right.',
        predicate: {
          kind: 'anyOf',
          of: [
            ink(PADDING_INLINE, 'any'),
            { kind: 'channelAll', groups: [WIDTH_GROUP, HEIGHT_GROUP], scope: 'root' },
          ],
        },
      },
      {
        id: 'button/surface-ink',
        noun: 'surface ink',
        stated: 'the root carries no background-color, border colour or box-shadow',
        why: 'with no surface ink a button is indistinguishable from a run of text.',
        predicate: ink(SURFACE_INK, 'root'),
      },
    ],
    expected: [
      {
        id: 'button/radius',
        noun: 'a corner radius',
        stated: 'no part carries border-radius',
        why: 'square corners read as a text field more often than a button.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
      {
        id: 'button/type-fact',
        noun: 'a type fact',
        stated: 'no part carries font-size or line-height',
        why: 'label text at the canvas default size breaks the type scale.',
        predicate: ink(TYPE_FACT, 'any'),
      },
    ],
  },

  'badge / tag / chip': {
    required: [
      {
        id: 'badge/surface-ink',
        noun: 'surface ink',
        stated: 'no part carries background-color or a border colour',
        why: 'the coloured surface IS the badge.',
        predicate: ink([...FILL, 'border-color', 'border-top-color'], 'any'),
      },
      {
        id: 'badge/text-fact',
        noun: 'a type fact',
        stated: 'no part carries font-size or line-height',
        why: 'badge text at the host default size reads as a label, not a badge.',
        predicate: ink(TYPE_FACT, 'any'),
      },
      {
        id: 'badge/padding',
        noun: 'padding',
        stated: 'no part carries any padding channel',
        why: 'zero padding collapses the chip onto its glyphs.',
        predicate: ink(PADDING_ANY, 'any'),
      },
    ],
    expected: [
      {
        id: 'badge/pill-radius',
        noun: 'a pill radius',
        stated: 'no part carries border-radius',
        why: 'the pill silhouette is most of what makes a badge legible at size.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  'checkbox / radio': {
    required: [
      {
        id: 'checkbox/control-box',
        noun: 'control-box geometry',
        stated: 'no single part carries both a width and a height',
        why: 'the square/circle needs real geometry — without it the control mints as a blob.',
        predicate: { kind: 'channelAll', groups: [WIDTH_GROUP, HEIGHT_GROUP], scope: 'any' },
      },
      {
        id: 'checkbox/base-border-or-fill',
        noun: 'a resting outline or fill',
        stated: 'no part carries a border colour, border width or background-color',
        why: 'an unchecked control is drawn by its border; absent, it is invisible at rest.',
        predicate: ink(['border-color', 'border-top-color', 'border-width', 'border-top-width', ...FILL], 'any'),
      },
      {
        id: 'checkbox/glyph',
        noun: 'a check glyph',
        stated: 'no part carries an icon, a shape or an icon component ref',
        why: 'a filled square is not a checked checkbox.',
        predicate: { kind: 'icon' },
      },
      {
        id: 'checkbox/label-gap',
        noun: 'a control/label gap',
        stated: 'no part carries gap, column-gap or a horizontal margin',
        why: 'control and label fused together fails "I can tell what this is".',
        predicate: ink(['gap', 'column-gap', 'margin-right', 'margin-left', 'padding-left'], 'any'),
      },
    ],
    expected: [
      {
        id: 'checkbox/checked-axis',
        noun: 'a checked axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'checked/unchecked is the component; one static frame shows half of it.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
  },

  'toggle / switch': {
    required: [
      {
        id: 'switch/track-geometry',
        noun: 'track geometry',
        stated: 'no single part carries both a width and a height',
        why: "the track's fixed W×H is the whole silhouette.",
        predicate: { kind: 'channelAll', groups: [WIDTH_GROUP, HEIGHT_GROUP], scope: 'any' },
      },
      {
        id: 'switch/thumb',
        noun: 'a thumb part',
        stated: 'the anatomy carries fewer than 2 parts',
        why: 'a switch without a thumb is a pill.',
        predicate: { kind: 'minParts', n: 2 },
      },
      {
        id: 'switch/checked-axis',
        noun: 'an on/off axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'on/off IS the component; one static frame is not a switch.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
    expected: [
      {
        id: 'switch/radius',
        noun: 'track and thumb radii',
        stated: 'no part carries border-radius',
        why: 'a square-cornered track mints as a progress bar.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  'banner / alert / toast': {
    required: [
      {
        id: 'alert/padding',
        noun: 'padding',
        stated: 'no part carries any padding channel',
        why: 'message text flush to the surface edge reads as a paragraph, not an alert.',
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'alert/surface-ink',
        noun: 'surface ink',
        stated: 'no part carries background-color, a border colour or a left accent',
        why: 'the tinted surface / accent bar is what carries the status.',
        predicate: ink([...FILL, 'border-left-color', 'border-color', 'border-left-width', 'border-top-color'], 'any'),
      },
      {
        id: 'alert/interior-layout',
        noun: 'an interior axis',
        stated: 'no part carries a layout direction',
        why: 'icon and content need an axis; without one they overlap or stack arbitrarily.',
        predicate: { kind: 'layout', directions: ['row', 'column', 'any'], scope: 'any' },
      },
    ],
    expected: [
      {
        id: 'alert/icon',
        noun: 'a status icon',
        stated: 'no part carries an icon, a shape or an icon component ref',
        why: 'the icon is the fastest read of severity.',
        predicate: { kind: 'icon' },
      },
    ],
  },

  'input / field': {
    required: [
      {
        id: 'input/box-grammar',
        noun: 'field-box grammar',
        stated: 'no part carries a border, a fill or an underline',
        why: 'outline, filled, or underline — one of the three, else the field mints as bare text.',
        predicate: ink(BOX_GRAMMAR, 'any'),
      },
      {
        id: 'input/padding-inline',
        noun: 'inline padding',
        stated: 'no part carries padding-left / padding-right / padding-inline',
        why: "text flush to the field edge is exactly fluent.input's NOT-recognisable verdict.",
        predicate: ink(PADDING_INLINE, 'any'),
      },
      {
        id: 'input/type-fact',
        noun: 'a type fact',
        stated: 'no part carries font-size or line-height',
        why: 'field text at canvas default size breaks the type scale.',
        predicate: ink(TYPE_FACT, 'any'),
      },
      {
        id: 'input/width-rule',
        noun: 'a width rule',
        stated: 'no part carries a width, a min/max-width, a grow flag or text content to hug',
        why: 'a field with no width behaviour hugs to caret width — the 30px reject.',
        predicate: { kind: 'widthOrContent' },
      },
    ],
    expected: [
      {
        id: 'input/height',
        noun: 'a field height',
        stated: 'no part carries height or min-height',
        why: 'field height is the second half of the box the designer recognises.',
        predicate: ink(HEIGHT_GROUP, 'any'),
      },
    ],
  },

  card: {
    required: [
      {
        id: 'card/interior-stack',
        noun: 'interior layout',
        stated: 'no part carries layout.direction "column"',
        why: 'header/body/footer stack vertically; with no column axis the card mints as ONE ROW — the pill.',
        predicate: { kind: 'layout', directions: ['column'], scope: 'any' },
      },
      {
        id: 'card/padding',
        noun: 'padding',
        stated: 'no part carries any padding channel',
        why: 'interior breathing room is what makes a surface a card.',
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'card/surface-ink',
        noun: 'surface ink',
        stated: 'no part carries background-color, a border colour or box-shadow',
        why: 'an elevated or bordered surface, else the card is an invisible group.',
        predicate: ink(SURFACE_INK, 'any'),
      },
      {
        id: 'card/width-rule',
        noun: 'a width rule',
        stated: 'no part carries a width, a min/max-width, a grow flag or text content to hug',
        why: 'an empty hug card collapses to a pill.',
        predicate: { kind: 'widthOrContent' },
      },
    ],
    expected: [
      {
        id: 'card/radius',
        noun: 'a corner radius',
        stated: 'no part carries border-radius',
        why: 'the rounded surface is most of a card at a glance.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
      {
        id: 'card/regions',
        noun: 'interior regions',
        stated: 'the anatomy carries fewer than 3 parts',
        why: 'a card with no interior grouping has nothing to stack.',
        predicate: { kind: 'minParts', n: 3 },
      },
    ],
  },

  avatar: {
    required: [
      {
        id: 'avatar/geometry',
        noun: 'geometry',
        stated: 'no single part carries both a width and a height',
        why: 'fixed W=H is the silhouette.',
        predicate: { kind: 'channelAll', groups: [WIDTH_GROUP, HEIGHT_GROUP], scope: 'any' },
      },
      {
        id: 'avatar/shape',
        noun: 'a shape radius',
        stated: 'no part carries border-radius',
        why: 'the circle (or squircle) IS the archetype.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
      {
        id: 'avatar/fill-or-content',
        noun: 'a fill',
        stated: 'no part carries background-color or fill',
        why: 'initials and images sit on a fill; absent, the avatar mints as an empty ring.',
        predicate: ink([...FILL, 'fill'], 'any'),
      },
    ],
    expected: [
      {
        id: 'avatar/initials-type',
        noun: 'a type fact for initials',
        stated: 'no part carries font-size or line-height',
        why: 'initials at default size overflow the circle.',
        predicate: ink(TYPE_FACT, 'any'),
      },
    ],
  },

  tabs: {
    required: [
      {
        id: 'tabs/row-layout',
        noun: 'a row axis',
        stated: 'no part carries layout.direction "row"',
        why: 'tabs are a horizontal rail.',
        predicate: { kind: 'layout', directions: ['row', 'any'], scope: 'any' },
      },
      {
        id: 'tabs/item-padding',
        noun: 'item padding',
        stated: 'no part carries any padding channel',
        why: 'hit-area padding is what separates tab items from a row of words.',
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'tabs/active-indicator',
        noun: 'a selected axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'the selected underline or fill is the component\'s meaning.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
    expected: [
      {
        id: 'tabs/rail',
        noun: 'a bottom rail',
        stated: 'no part carries border-bottom-width or border-bottom-color',
        why: 'the rail is what tells a reader where the tab strip ends.',
        predicate: ink(['border-bottom-width', 'border-bottom-color'], 'any'),
      },
    ],
  },

  accordion: {
    required: [
      {
        id: 'accordion/divider',
        noun: 'a separating rule',
        stated: 'no part carries a border width or colour on any edge',
        why:
          'rules are what make stacked items an accordion. A FULL box border separates them just as well as a row ' +
          'rule does (ds.accordion-item draws one), so the fact is "a border exists", not "the border is directional".',
        predicate: ink(
          ['border-top-width', 'border-bottom-width', 'border-top-color', 'border-bottom-color', 'border-width', 'border-color'],
          'any',
        ),
      },
      {
        id: 'accordion/header-layout',
        noun: 'a header row',
        stated: 'no part carries layout.direction "row"',
        why: 'label and chevron share a row.',
        predicate: { kind: 'layout', directions: ['row', 'any'], scope: 'any' },
      },
      {
        id: 'accordion/open-axis',
        noun: 'an open/closed axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'open/closed IS the component.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
    expected: [
      {
        id: 'accordion/chevron',
        noun: 'a chevron',
        stated: 'no part carries an icon, a shape or an icon component ref',
        why: 'the chevron is what says "this opens".',
        predicate: { kind: 'icon' },
      },
    ],
  },

  'progress / spinner': {
    required: [
      {
        id: 'progress/geometry',
        noun: 'geometry',
        stated: 'no part carries a height or a width',
        why: 'track thickness / spinner diameter is the silhouette.',
        predicate: ink([...HEIGHT_GROUP, ...WIDTH_GROUP], 'any'),
      },
      {
        id: 'progress/ink',
        noun: 'an ink fact',
        stated: 'no part carries background-color, a border colour, fill, stroke or color',
        why: 'track versus indicator needs at least one ink fact.',
        predicate: ink([...FILL, 'border-color', 'border-top-color', 'fill', 'stroke', 'color'], 'any'),
      },
    ],
    expected: [
      {
        id: 'progress/radius',
        noun: 'a track radius',
        stated: 'no part carries border-radius',
        why: 'square track ends read as a divider.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  slider: {
    required: [
      {
        id: 'slider/track',
        noun: 'a track height',
        stated: 'no part carries height or min-height',
        why: 'the thin track height is the silhouette.',
        predicate: ink(HEIGHT_GROUP, 'any'),
      },
      {
        id: 'slider/thumb',
        noun: 'a thumb part',
        stated: 'the anatomy carries fewer than 2 parts',
        why: 'a slider without a thumb is a divider.',
        predicate: { kind: 'minParts', n: 2 },
      },
      {
        id: 'slider/ink',
        noun: 'an ink fact',
        stated: 'no part carries background-color, a border colour or color',
        why: 'the track/filled distinction needs ink.',
        predicate: ink([...FILL, 'border-color', 'color'], 'any'),
      },
    ],
    expected: [
      {
        id: 'slider/thumb-radius',
        noun: 'a thumb radius',
        stated: 'no part carries border-radius',
        why: 'a square thumb reads as a scrollbar.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  'select / combobox': {
    required: [
      {
        id: 'select/box-grammar',
        noun: 'trigger-box grammar',
        stated: 'no part carries a border, a fill or a shadow',
        why: 'the trigger is an input box; without box facts it minted as bare 30px text.',
        predicate: ink(BOX_GRAMMAR, 'any'),
      },
      {
        id: 'select/padding-inline',
        noun: 'inline padding',
        stated: 'no part carries padding-left / padding-right / padding-inline',
        why: 'value text flush to the border fails recognisability.',
        predicate: ink(PADDING_INLINE, 'any'),
      },
      {
        id: 'select/width-rule',
        noun: 'a width rule',
        stated: 'no part carries a width, a min/max-width, a grow flag or text content to hug',
        why: 'a trigger hugging its placeholder is the 30px reject.',
        predicate: { kind: 'widthOrContent' },
      },
      {
        id: 'select/chevron',
        noun: 'a chevron',
        stated: 'no part carries an icon, a shape or an icon component ref',
        why: 'the chevron is what says "this opens".',
        predicate: { kind: 'icon' },
      },
    ],
    expected: [
      {
        id: 'select/height',
        noun: 'a trigger height',
        stated: 'no part carries height or min-height',
        why: 'trigger height is what makes it match the fields beside it.',
        predicate: ink(HEIGHT_GROUP, 'any'),
      },
    ],
  },

  'modal / dialog': {
    required: [
      {
        id: 'dialog/panel-stack',
        noun: 'a panel stack',
        stated: 'no part carries layout.direction "column"',
        why: 'title/body/actions stack vertically; without the axis the dialog mints as ONE ROW.',
        predicate: { kind: 'layout', directions: ['column'], scope: 'any' },
      },
      {
        id: 'dialog/surface-elevation',
        noun: 'an elevated surface',
        stated: 'no single part carries a background-color together with a shadow or border',
        why: 'an opaque panel raised over the page is the archetype.',
        predicate: {
          kind: 'channelAll',
          groups: [['background-color'], ['box-shadow', 'border-color', 'border-width', 'border-top-width']],
          scope: 'any',
        },
      },
      {
        id: 'dialog/padding',
        noun: 'panel padding',
        stated: 'no part carries any padding channel',
        why: 'panel interior padding; without it the title sits on the panel edge.',
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'dialog/regions',
        noun: 'interior regions',
        stated: 'the anatomy carries fewer than 3 parts',
        why: 'title/body/action grouping has to exist at all.',
        predicate: { kind: 'minParts', n: 3 },
      },
    ],
    expected: [
      {
        id: 'dialog/radius',
        noun: 'a panel radius',
        stated: 'no part carries border-radius',
        why: 'the rounded panel is a large part of the dialog read.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  'tooltip / popover': {
    required: [
      {
        id: 'tooltip/surface',
        noun: 'a surface fill',
        stated: 'no part carries background-color',
        why: 'the floating surface is the bubble.',
        predicate: ink(FILL, 'any'),
      },
      {
        id: 'tooltip/padding',
        noun: 'padding',
        stated: 'no part carries any padding channel',
        why: 'text flush to the bubble edge is not a tooltip.',
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'tooltip/type-fact',
        noun: 'a type fact',
        stated: 'no part carries font-size or line-height',
        why: 'tooltip type is smaller than body — the default size breaks it.',
        predicate: ink(TYPE_FACT, 'any'),
      },
    ],
    expected: [
      {
        id: 'tooltip/radius',
        noun: 'a corner radius',
        stated: 'no part carries border-radius',
        why: 'square bubbles read as panels.',
        predicate: ink(['border-radius', 'border-top-left-radius'], 'any'),
      },
    ],
  },

  'menu / dropdown': {
    required: [
      {
        id: 'menu/column-stack',
        noun: 'a column stack',
        stated: 'no part carries layout.direction "column"',
        why: 'menu items stack.',
        predicate: { kind: 'layout', directions: ['column'], scope: 'any' },
      },
      {
        id: 'menu/surface',
        noun: 'a surface fill',
        stated: 'no part carries background-color',
        why: 'the elevated panel is what separates a menu from the page.',
        predicate: ink(FILL, 'any'),
      },
      {
        id: 'menu/item-padding',
        noun: 'item padding',
        stated: 'no part carries any padding channel',
        why: 'item hit areas.',
        predicate: ink(PADDING_ANY, 'any'),
      },
    ],
    expected: [
      {
        id: 'menu/shadow',
        noun: 'elevation',
        stated: 'no part carries box-shadow',
        why: 'a flat menu panel merges into the page.',
        predicate: ink(['box-shadow'], 'any'),
      },
    ],
  },

  pagination: {
    required: [
      {
        id: 'pagination/row-layout',
        noun: 'a row axis',
        stated: 'no part carries layout.direction "row"',
        why: 'page items are a row.',
        predicate: { kind: 'layout', directions: ['row', 'any'], scope: 'any' },
      },
      {
        id: 'pagination/item-box',
        noun: 'an item box',
        stated: 'no part carries a width or inline padding',
        why: 'page cells need a box to be clickable targets rather than digits.',
        predicate: ink([...WIDTH_GROUP, 'padding-left', 'padding-inline', 'padding'], 'any'),
      },
    ],
    expected: [
      {
        id: 'pagination/current',
        noun: 'a current-page axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'which page you are on is the point.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
  },

  'table / data-grid': {
    required: [
      {
        id: 'table/column-stack',
        noun: 'a column stack',
        stated: 'no part carries layout.direction "column"',
        why: 'rows stack — the table-display lowering lands exactly this.',
        predicate: { kind: 'layout', directions: ['column'], scope: 'any' },
      },
      {
        id: 'table/cell-padding',
        noun: 'cell padding',
        stated: 'no part carries any padding channel',
        why: "cell padding is the grid's rhythm.",
        predicate: ink(PADDING_ANY, 'any'),
      },
      {
        id: 'table/row-rule',
        noun: 'a row rule',
        stated: 'no part carries a top or bottom border width or colour',
        why: 'row rules are what make it a table.',
        predicate: ink(['border-bottom-width', 'border-top-width', 'border-bottom-color', 'border-top-color'], 'any'),
      },
    ],
    expected: [
      {
        id: 'table/header-type',
        noun: 'a header type fact',
        stated: 'no part carries font-weight',
        why: 'the header row is read by weight before anything else.',
        predicate: ink(['font-weight'], 'any'),
      },
    ],
  },

  breadcrumb: {
    required: [
      {
        id: 'breadcrumb/row-layout',
        noun: 'a row axis',
        stated: 'no part carries layout.direction "row"',
        why: 'crumbs are a row.',
        predicate: { kind: 'layout', directions: ['row', 'any'], scope: 'any' },
      },
      {
        id: 'breadcrumb/separator-or-gap',
        noun: 'separation',
        stated: 'no part carries gap, column-gap, a left margin or left padding',
        why: 'crumbs run together without separation.',
        predicate: ink(['gap', 'column-gap', 'margin-left', 'padding-left', 'padding-inline'], 'any'),
      },
    ],
    expected: [
      {
        id: 'breadcrumb/separator-glyph',
        noun: 'a separator glyph',
        stated: 'no part carries an icon, a shape, static text or an icon component ref',
        why: 'the chevron or slash is what makes a row of links a trail.',
        predicate: { kind: 'icon' },
      },
    ],
  },

  'nav (top / side)': {
    required: [
      {
        id: 'nav/axis',
        noun: 'an axis',
        stated: 'no part carries a layout direction',
        why: 'a nav IS its axis.',
        predicate: { kind: 'layout', directions: ['row', 'column', 'any'], scope: 'any' },
      },
      {
        id: 'nav/item-padding',
        noun: 'item padding',
        stated: 'no part carries any padding channel',
        why: 'item hit areas.',
        predicate: ink(PADDING_ANY, 'any'),
      },
    ],
    expected: [
      {
        id: 'nav/active-item',
        noun: 'an active-item axis',
        stated: 'the contract declares no states and no enum/boolean prop',
        why: 'where you are is the nav\'s job.',
        predicate: { kind: 'statesOrAxis' },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Channel presence — the eight styling channels a surface draws from
// ---------------------------------------------------------------------------

/** Every channel name this part carries, from ALL eight styling channels.
 *  A fact is present when a surface has something to draw for it; which of
 *  the eight it rides in is not the question. */
export function channelsOf(part: Part): Set<string> {
  const out = new Set<string>();
  const add = (rec: Record<string, unknown> | undefined) => {
    if (rec) for (const k of Object.keys(rec)) out.add(k);
  };
  add(part.tokens);
  add(part.literals);
  add(part.declared);
  const byProp = part.tokensByProp;
  if (Array.isArray(byProp)) for (const e of byProp) for (const v of Object.values(e.map ?? {})) add(v as Record<string, unknown>);
  else if (byProp) for (const v of Object.values(byProp.map ?? {})) add(v as Record<string, unknown>);
  for (const e of part.literalsByProp ?? []) for (const v of Object.values(e.map ?? {})) add(v as Record<string, unknown>);
  for (const v of Object.values(part.states ?? {})) add(v);
  for (const e of part.statesByProp ?? []) for (const v of Object.values(e.map ?? {})) add(v as Record<string, unknown>);
  for (const v of Object.values(part.declaredStates ?? {})) add(v);
  // Layout sizing that is spelled as a layout field rather than a channel.
  if (part.layout?.grow) out.add('flex-grow');
  return out;
}

interface FlatPart {
  part: Part;
  isRoot: boolean;
  channels: Set<string>;
}

function flatten(contract: Contract): FlatPart[] {
  const out: FlatPart[] = [];
  const walk = (part: Part, isRoot: boolean) => {
    out.push({ part, isRoot, channels: channelsOf(part) });
    for (const child of Object.values(part.parts ?? {})) walk(child, false);
  };
  // Every TOP-LEVEL anatomy entry is a root (multi-root anatomy is legal).
  for (const part of Object.values(contract.anatomy ?? {})) walk(part, true);
  return out;
}

const ICON_NAME = /icon|chevron|caret|arrow|check|glyph|symbol|svg|mark/i;

function hasGlyph(parts: FlatPart[]): boolean {
  return parts.some(({ part }) => {
    if (part.icon) return true;
    if (part.shape) return true;
    if (part.component && ICON_NAME.test(part.component.id)) return true;
    if (part.slot?.accepts?.some((id) => ICON_NAME.test(id))) return true;
    // An SVG captured as an asset rides `content`/`text` on an icon-named
    // element, or an <svg>/<path> element outright.
    if (part.element && /^(svg|path|use|symbol)$/i.test(part.element)) return true;
    return false;
  });
}

function hasStatesOrAxis(contract: Contract, parts: FlatPart[]): boolean {
  if ((contract.states ?? []).length > 0) return true;
  if (parts.some(({ part }) => part.states || part.statesByProp || part.declaredStates)) return true;
  return (contract.props ?? []).some((p) => {
    if (p.type === 'boolean') return true;
    return typeof p.type === 'object' && 'enum' in p.type && p.type.enum.length > 1;
  });
}

const WIDTH_CHANNELS = ['width', 'min-width', 'max-width', 'flex-grow', 'flex-basis'];

function hasWidthOrContent(parts: FlatPart[]): boolean {
  for (const { part, channels } of parts) {
    if (WIDTH_CHANNELS.some((c) => channels.has(c))) return true;
    if (part.layout?.grow) return true;
    if (part.content || part.text || part.textByProp) return true;
  }
  return false;
}

function scopedParts(parts: FlatPart[], scope: 'root' | 'any'): FlatPart[] {
  return scope === 'root' ? parts.filter((p) => p.isRoot) : parts;
}

function holds(predicate: FactPredicate, contract: Contract, parts: FlatPart[]): boolean {
  switch (predicate.kind) {
    case 'channel':
      return scopedParts(parts, predicate.scope).some(({ channels }) => predicate.channels.some((c) => channels.has(c)));
    case 'channelAll':
      return scopedParts(parts, predicate.scope).some(({ channels }) =>
        predicate.groups.every((group) => group.some((c) => channels.has(c))),
      );
    case 'layout':
      return scopedParts(parts, predicate.scope).some(({ part }) => {
        const layout = part.layout;
        if (!layout) return false;
        const direction = layout.direction ?? (layout.display === 'flex' || layout.display === 'inline-flex' ? 'row' : undefined);
        if (!direction) return predicate.directions.includes('any') && Boolean(layout.display);
        if (predicate.directions.includes(direction as 'row' | 'column')) return true;
        return predicate.directions.includes('any');
      });
    case 'statesOrAxis':
      return hasStatesOrAxis(contract, parts);
    case 'icon':
      return hasGlyph(parts);
    case 'widthOrContent':
      return hasWidthOrContent(parts);
    case 'minParts':
      return parts.length >= predicate.n;
    case 'anyOf':
      return predicate.of.some((p) => holds(p, contract, parts));
  }
}

// ---------------------------------------------------------------------------
// The referee
// ---------------------------------------------------------------------------

export interface FactFinding {
  factId: string;
  /** The full refusal/warning line, exactly as the tool prints it. */
  line: string;
}

export interface RequiredFactsResult {
  id: string;
  archetype: Archetype | 'none';
  /** How the archetype was decided — `declared` wins, `name-map` seeds,
   *  `unmapped` enforces nothing. */
  source: 'declared' | 'name-map' | 'unmapped';
  /** REQUIRED facts the contract does not carry. Non-empty ⇒ refuse to mint
   *  (warn until the posture flips). */
  missing: FactFinding[];
  /** EXPECTED facts the contract does not carry. Always warn-only. */
  warns: FactFinding[];
  /** Set when the archetype could not be decided — "declare archetype". */
  undeclared: string | null;
}

/** `<id>: <archetype> lacks <noun> — cannot mint: <stated> (required fact
 *  <fact-id>)` — the house `<id>: <violation>` deep-referee grammar. */
export function refusalLine(contractId: string, archetype: string, fact: RequiredFact): string {
  return `${contractId}: ${archetype} lacks ${fact.noun} — cannot mint: ${fact.stated} (required fact ${fact.id})`;
}

/** The same fact, said where refusing would be wrong: `generate` renders code,
 *  and CSS inheritance carries facts the canvas cannot. */
export function generateWarnLine(contractId: string, archetype: string, fact: RequiredFact): string {
  return (
    `${contractId}: ${archetype} lacks ${fact.noun} — will not be recognisable on the canvas — generated anyway ` +
    `(code carries the fact through CSS defaults; the canvas cannot): ${fact.stated} (required fact ${fact.id})`
  );
}

/** The EXPECTED-tier line. Never a refusal, on any surface. */
export function expectedWarnLine(contractId: string, archetype: string, fact: RequiredFact): string {
  return `${contractId}: ${archetype} lacks ${fact.noun} — minted anyway: ${fact.stated} (expected fact ${fact.id})`;
}

export const UNDECLARED_ARCHETYPE_WARNING = (contractId: string): string =>
  `${contractId}: unmapped archetype — required-facts not checked; declare \`archetype\` in the contract ` +
  `(one of the docs/23 §C.1.1 classes, or "none" if this is not a component archetype)`;

export interface CheckOptions {
  /** Override the archetype (the gate re-checks a contract as another class
   *  in its self-test). Normally omitted — the contract decides. */
  archetype?: Archetype | 'none';
  /** `generate` phrases the same absence differently — it does not refuse. */
  voice?: 'mint' | 'generate';
}

/** THE REFEREE. Pure: contract in, findings out. */
export function checkRequiredFacts(contract: Contract, options: CheckOptions = {}): RequiredFactsResult {
  const resolved = options.archetype ? { archetype: options.archetype, source: 'declared' as const } : resolveArchetype(contract);
  const { archetype, source } = resolved;
  const base: RequiredFactsResult = {
    id: contract.id,
    archetype,
    source,
    missing: [],
    warns: [],
    undeclared: null,
  };
  if (archetype === 'none') return base;
  if (archetype === 'unmapped') return { ...base, undeclared: UNDECLARED_ARCHETYPE_WARNING(contract.id) };

  const table = ARCHETYPE_REQUIRED_FACTS[archetype];
  if (!table) return base;
  const parts = flatten(contract);
  const say = options.voice === 'generate' ? generateWarnLine : refusalLine;
  for (const fact of table.required) {
    if (!holds(fact.predicate, contract, parts)) {
      base.missing.push({ factId: fact.id, line: say(contract.id, archetype, fact) });
    }
  }
  for (const fact of table.expected) {
    if (!holds(fact.predicate, contract, parts)) {
      base.warns.push({ factId: fact.id, line: expectedWarnLine(contract.id, archetype, fact) });
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// THE GLOBAL FACT THAT IS NOT HERE — `type-scale/rem-base`, and why
// ---------------------------------------------------------------------------

/**
 * The design for this module carried one GLOBAL required fact:
 * `type-scale/rem-base` — "a font-size that resolves to a rem quantity refuses
 * unless the token set declares a rem base", written against the polaris
 * evidence that `/p/font-size-350 = 0.875rem` minted as the Figma number
 * 0.875, a broken type scale nothing named.
 *
 * IT IS NOT IMPLEMENTED, because the premise is dead. Reading the instrument
 * instead of the report:
 *
 *   · `px()` (packages/core/src/tokens.ts) converts rem/em at the CSS root
 *     ratio — `if (/^-?[\d.]+(rem|em)$/.test(s)) return n * 16` — carrying a
 *     dated live-canvas receipt for exactly this defect ("2026-07-22, Astryx
 *     genesis … the real Figma canvas refused fontSize < 1").
 *   · `pxOrNull()` does the same, and types every non-dimension token as a
 *     Figma STRING so it keeps its unit instead of becoming a bare float.
 *   · `compileLineHeight()` routes unitless ratios to PERCENT, and a value it
 *     cannot spell becomes a NAMED channel miss, never a silent number.
 *
 * A first cut of this fact was written, wired, and run: it refused ten astryx
 * and polaris contracts whose rem type scale mints CORRECTLY today. A gate
 * that reds a right answer is worse than no gate, so it was removed rather
 * than weakened — and the reason is recorded here so the next reader does not
 * re-derive it from the same stale premise. If a future capture introduces a
 * unit the three functions above do not handle, the place to refuse is at that
 * type boundary, where the value is, not in an archetype table.
 */

// ---------------------------------------------------------------------------
// Posture
// ---------------------------------------------------------------------------

/** WARN by default; REFUSE under `DS_REQUIRED_FACTS=refuse` or an explicit
 *  `--strict`. The design's phase plan, compressed: the wave is visible one
 *  full cycle before anything blocks, and the flag exists TODAY so a team that
 *  wants the refusal now can have it. `refuse` becomes the default once the
 *  burn-down in parity/receipts/v1/REQUIRED-FACTS.md lands. */
export type Posture = 'warn' | 'refuse';

export function posture(env: Record<string, string | undefined>, strictFlag = false): Posture {
  if (strictFlag) return 'refuse';
  const raw = (env.DS_REQUIRED_FACTS ?? '').trim().toLowerCase();
  if (raw === 'refuse' || raw === 'strict' || raw === '1') return 'refuse';
  return 'warn';
}
