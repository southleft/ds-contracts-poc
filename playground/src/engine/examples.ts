/**
 * The curated gallery — repo contracts spanning the composition ladder, plus
 * the foreign-code fixture that shows the degradation story (honest tiers).
 *
 * Captions state FACTS about their contracts. Countable claims (variant
 * fan-out, state-preview axes) are DERIVED from the loaded contract data —
 * the Badge card once said "four variants" while the contract shipped five;
 * a derived count cannot drift.
 */
import calloutTsx from '../../../extract/fixtures/foreign-css/Callout.tsx?raw';
import calloutCss from '../../../extract/fixtures/foreign-css/Callout.module.css?raw';
import { contractsById } from './data';

export interface ContractExample {
  kind: 'contract';
  slug: string;
  contractId: string;
  name: string;
  category: 'Atom' | 'Molecule' | 'Composition';
  blurb: string;
  /** One line of "what to notice" — the specific thing this card teaches. */
  caption: string;
  /** Present when this example lands on a NAMED refusal on purpose — the
   *  playground labels the refusal wall and the empty preview with it. */
  expectedRefusal?: string;
}

export interface CodeExample {
  kind: 'code';
  slug: string;
  name: string;
  category: 'Foreign code';
  blurb: string;
  /** One line of "what to notice" — the specific thing this card teaches. */
  caption: string;
  /** Present when this example lands on a NAMED refusal on purpose. */
  expectedRefusal?: string;
  tsx: string;
  css: string;
  sourcePath: string;
}

export type Example = ContractExample | CodeExample;

// --- derived caption facts (from the same contract data the engine runs on)

const enumValuesOf = (contractId: string, prop: string): string[] => {
  const p = contractsById.get(contractId)?.props.find((candidate) => candidate.name === prop);
  return p && typeof p.type === 'object' && 'enum' in p.type ? p.type.enum : [];
};

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/** "a, b, and c" — for the derived state-preview list. */
const listWords = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} and ${items[items.length - 1]}`;

const badgeVariantCount = countWord(enumValuesOf('ds.badge', 'variant').length);
const buttonStateList = listWords(contractsById.get('ds.button')?.states ?? []);
const metadataStatusList = enumValuesOf('ds.chat-message-metadata', 'status').join(', ');
const metadataStatusCount = countWord(enumValuesOf('ds.chat-message-metadata', 'status').length);

export const examples: Example[] = [
  {
    kind: 'contract',
    slug: 'badge',
    contractId: 'ds.badge',
    name: 'Badge',
    category: 'Atom',
    blurb: 'Status at a glance. Enum variants bound to feedback tokens — the smallest complete contract.',
    caption: `One enum prop fans out on both surfaces: ${badgeVariantCount} variant classes in the CSS, ${badgeVariantCount} Figma variants in the sync script — same source line.`,
  },
  {
    kind: 'contract',
    slug: 'button',
    contractId: 'ds.button',
    name: 'Button',
    category: 'Atom',
    blurb: 'Variants, sizes, icon slots, and figmaStatePreviews — the React output ships a state-preview story.',
    caption: `State previews: ${buttonStateList} ship as extra canvas variants (the State axis) while code keeps them as live CSS states.`,
  },
  {
    kind: 'contract',
    slug: 'switch',
    contractId: 'ds.switch',
    name: 'Switch',
    category: 'Atom',
    blurb: 'An off/on control with a declared toggle boundary. CSS renders both states; the React output wires the handler.',
    caption: 'A real input[type=checkbox] with role=switch carries the semantics; spacer parts with visibility conditions move the thumb — off/on is an enum, so both states render truthfully on both surfaces.',
  },
  {
    kind: 'contract',
    slug: 'checkbox',
    contractId: 'ds.checkbox',
    name: 'Checkbox',
    category: 'Atom',
    blurb: 'Checked, unchecked, indeterminate — a native input inside the label; icon assets inlined from the same SVGs the generator uses.',
    caption: 'All three values render as variants; indeterminate is a DOM property — the React output sets it, static HTML names the limit in a comment while the dash glyph still shows the state. onToggle stays code-only.',
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
    blurb: 'Slots on a raised surface. Composition refs resolve through the bundled contract set.',
    caption: 'Composition: a nested Avatar instance plus children and actions slots — slot content resolves through its own contract, never copied in.',
  },
  {
    kind: 'contract',
    slug: 'banner',
    contractId: 'ds.banner',
    name: 'Banner',
    category: 'Molecule',
    blurb: 'Feedback surface composing icon + text parts, tone and ARIA role driven by one status enum.',
    caption: 'Slots with accepts: the endContent slot names ds.button as its preferred filler — guidance both surfaces carry with the insertion point.',
  },
  {
    kind: 'contract',
    slug: 'chat-message',
    contractId: 'ds.chat-message',
    name: 'ChatMessage',
    category: 'Composition',
    blurb: 'Composes Avatar and ChatMessageMetadata by contract id — the dependency CSS rides along.',
    caption: 'A layoutByProp entry flips the row when sender is user — the same flip lands in CSS rules and in compiled Figma variants.',
  },
  {
    kind: 'contract',
    slug: 'chat-message-metadata',
    contractId: 'ds.chat-message-metadata',
    name: 'ChatMessageMetadata',
    category: 'Composition',
    blurb: 'The composed child on its own — small contracts stay independently emittable.',
    caption: `The status enum picks the icon asset per variant — ${metadataStatusList} — one anatomy part, ${metadataStatusCount} glyphs.`,
  },
  {
    kind: 'code',
    slug: 'callout-foreign',
    name: 'Callout (foreign code)',
    category: 'Foreign code',
    blurb: 'Hand-written CSS this engine never generated. Structure is extracted; every raw value is reported with nearest-token candidates — named degradation, nothing invented.',
    caption: 'Raw values get reported, never invented — the receipts list every hex and px with its nearest-token candidates. The proposal then refuses on purpose (see below).',
    expectedRefusal:
      'This example refuses ON PURPOSE. The foreign component’s required "heading" text prop declares no string default, so the generator refuses by name instead of inventing one — the same honesty the receipts apply to its raw values. Add a default (or run Fix with AI) and watch it pass.',
    tsx: calloutTsx,
    css: calloutCss,
    sourcePath: 'extract/fixtures/foreign-css/Callout.tsx',
  },
];

export const exampleBySlug = new Map(examples.map((e) => [e.slug, e]));
