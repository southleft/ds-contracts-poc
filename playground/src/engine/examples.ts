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
}

export interface CodeExample {
  kind: 'code';
  slug: string;
  name: string;
  category: 'Foreign code';
  blurb: string;
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
  },
  {
    kind: 'contract',
    slug: 'button',
    contractId: 'ds.button',
    name: 'Button',
    category: 'Atom',
    blurb: 'Variants, sizes, icon slots, and figmaStatePreviews — the React output ships a state-preview story.',
  },
  {
    kind: 'contract',
    slug: 'switch',
    contractId: 'ds.switch',
    name: 'Switch',
    category: 'Atom',
    blurb: 'A controlled boolean with events. CSS renders its states; the React output wires the handlers.',
  },
  {
    kind: 'contract',
    slug: 'checkbox',
    contractId: 'ds.checkbox',
    name: 'Checkbox',
    category: 'Atom',
    blurb: 'Checked, indeterminate, disabled — icon assets inlined from the same SVGs the generator uses.',
  },
  {
    kind: 'contract',
    slug: 'heading',
    contractId: 'ds.heading',
    name: 'Heading',
    category: 'Atom',
    blurb: 'Semantic levels with token-bound type styles — element choice driven by the contract.',
  },
  {
    kind: 'contract',
    slug: 'card',
    contractId: 'ds.card',
    name: 'Card',
    category: 'Molecule',
    blurb: 'Slots and elevation. Composition refs resolve through the bundled contract set.',
  },
  {
    kind: 'contract',
    slug: 'banner',
    contractId: 'ds.banner',
    name: 'Banner',
    category: 'Molecule',
    blurb: 'Feedback surface composing icon + text parts, tone driven by one enum.',
  },
  {
    kind: 'contract',
    slug: 'chat-message',
    contractId: 'ds.chat-message',
    name: 'ChatMessage',
    category: 'Composition',
    blurb: 'Composes Avatar and ChatMessageMetadata by contract id — the dependency CSS rides along.',
  },
  {
    kind: 'contract',
    slug: 'chat-message-metadata',
    contractId: 'ds.chat-message-metadata',
    name: 'ChatMessageMetadata',
    category: 'Composition',
    blurb: 'The composed child on its own — small contracts stay independently emittable.',
  },
  {
    kind: 'code',
    slug: 'callout-foreign',
    name: 'Callout (foreign code)',
    category: 'Foreign code',
    blurb: 'Hand-written CSS this engine never generated. Structure is extracted; every raw value is reported with nearest-token candidates — named degradation, nothing invented.',
    tsx: calloutTsx,
    css: calloutCss,
    sourcePath: 'extract/fixtures/foreign-css/Callout.tsx',
  },
];

export const exampleBySlug = new Map(examples.map((e) => [e.slug, e]));
