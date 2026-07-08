/**
 * The curated gallery — repo contracts spanning the composition ladder, plus
 * the foreign-code fixture that shows the degradation story (honest tiers).
 */
import calloutTsx from '../../../extract/fixtures/foreign-css/Callout.tsx?raw';
import calloutCss from '../../../extract/fixtures/foreign-css/Callout.module.css?raw';

export interface ContractExample {
  kind: 'contract';
  slug: string;
  contractId: string;
  name: string;
  category: 'Atom' | 'Molecule' | 'Composition';
  blurb: string;
  /** One line of "what to notice" — the specific thing this card teaches. */
  caption: string;
}

export interface CodeExample {
  kind: 'code';
  slug: string;
  name: string;
  category: 'Foreign code';
  blurb: string;
  /** One line of "what to notice" — the specific thing this card teaches. */
  caption: string;
  tsx: string;
  css: string;
  sourcePath: string;
}

export type Example = ContractExample | CodeExample;

export const examples: Example[] = [
  {
    kind: 'contract',
    slug: 'badge',
    contractId: 'ds.badge',
    name: 'Badge',
    category: 'Atom',
    blurb: 'Status at a glance. Enum variants bound to feedback tokens — the smallest complete contract.',
    caption: 'One enum prop fans out on both surfaces: four variant classes in the CSS, four Figma variants in the sync script — same source line.',
  },
  {
    kind: 'contract',
    slug: 'button',
    contractId: 'ds.button',
    name: 'Button',
    category: 'Atom',
    blurb: 'Variants, sizes, icon slots, and figmaStatePreviews — the React output ships a state-preview story.',
    caption: 'State previews: hover and focus ship as extra canvas variants (the State axis) while code keeps them as live CSS states.',
  },
  {
    kind: 'contract',
    slug: 'switch',
    contractId: 'ds.switch',
    name: 'Switch',
    category: 'Atom',
    blurb: 'A controlled boolean with events. CSS renders its states; the React output wires the handlers.',
    caption: 'Structure does the work: spacer parts plus visibility conditions move the thumb — off/on is an enum, no JavaScript in the preview.',
  },
  {
    kind: 'contract',
    slug: 'checkbox',
    contractId: 'ds.checkbox',
    name: 'Checkbox',
    category: 'Atom',
    blurb: 'Checked, indeterminate, disabled — icon assets inlined from the same SVGs the generator uses.',
    caption: 'The onToggle event is declared but code-only — the canvas honestly shows only what it can render.',
  },
  {
    kind: 'contract',
    slug: 'heading',
    contractId: 'ds.heading',
    name: 'Heading',
    category: 'Atom',
    blurb: 'Semantic levels with token-bound type styles — element choice driven by the contract.',
    caption: 'The rendered element follows the level prop: level 2 emits an h2 — semantics live in the contract, not a template.',
  },
  {
    kind: 'contract',
    slug: 'card',
    contractId: 'ds.card',
    name: 'Card',
    category: 'Molecule',
    blurb: 'Slots and elevation. Composition refs resolve through the bundled contract set.',
    caption: 'Composition: a nested Avatar instance plus body and footer slots — children resolve through their own contracts, never copied in.',
  },
  {
    kind: 'contract',
    slug: 'banner',
    contractId: 'ds.banner',
    name: 'Banner',
    category: 'Molecule',
    blurb: 'Feedback surface composing icon + text parts, tone driven by one enum.',
    caption: 'Slots with accepts: the action slot names ds.button as what may fill it — a constrained insertion point, not a free-for-all.',
  },
  {
    kind: 'contract',
    slug: 'chat-message',
    contractId: 'ds.chat-message',
    name: 'ChatMessage',
    category: 'Composition',
    blurb: 'Composes Avatar and ChatMessageMetadata by contract id — the dependency CSS rides along.',
    caption: 'One layoutByProp entry flips the row when sender is user — the same flip lands in CSS rules and in compiled Figma variants.',
  },
  {
    kind: 'contract',
    slug: 'chat-message-metadata',
    contractId: 'ds.chat-message-metadata',
    name: 'ChatMessageMetadata',
    category: 'Composition',
    blurb: 'The composed child on its own — small contracts stay independently emittable.',
    caption: 'The status enum picks the icon asset per variant — sending, sent, delivered, read, error — one anatomy part, five glyphs.',
  },
  {
    kind: 'code',
    slug: 'callout-foreign',
    name: 'Callout (foreign code)',
    category: 'Foreign code',
    blurb: 'Hand-written CSS this engine never generated. Structure is extracted; every raw value is reported with nearest-token candidates — named degradation, nothing invented.',
    caption: 'Raw values get reported, never invented — the receipts list every hex and px with its nearest-token candidates.',
    tsx: calloutTsx,
    css: calloutCss,
    sourcePath: 'extract/fixtures/foreign-css/Callout.tsx',
  },
];

export const exampleBySlug = new Map(examples.map((e) => [e.slug, e]));
