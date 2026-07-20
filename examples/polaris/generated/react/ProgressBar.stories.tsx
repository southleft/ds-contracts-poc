/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (polaris.progress-bar v0.3.2)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/ProgressBar/ProgressBar.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/progress-bar.extension.json. Delta ledger: extract/computed/out/progressbar/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md)." } },
  },
  argTypes: {
    progress: { control: { type: 'number' }, description: 'The progression of certain tasks' },
    size: { control: 'select', options: ['small', 'medium', 'large'], description: 'Size of progressbar' },
    animated: { control: 'boolean', description: 'Whether the fill animation is triggered' },
    ariaLabelledBy: { control: 'text', description: 'Id (ids) of element (elements) that describes progressbar' },
    tone: { control: 'select', options: ['highlight', 'primary', 'success', 'critical'], description: 'Color of progressbar' },
  },
  args: {
    progress: 0,
    size: 'medium',
    animated: false,
    tone: 'highlight',
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: 'small' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Large: Story = {
  args: { size: 'large' },
};
/** Every legal combination the contract defines (size × tone). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(4, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <ProgressBar size="small" tone="highlight" />
        <ProgressBar size="small" tone="primary" />
        <ProgressBar size="small" tone="success" />
        <ProgressBar size="small" tone="critical" />
        <ProgressBar size="medium" tone="highlight" />
        <ProgressBar size="medium" tone="primary" />
        <ProgressBar size="medium" tone="success" />
        <ProgressBar size="medium" tone="critical" />
        <ProgressBar size="large" tone="highlight" />
        <ProgressBar size="large" tone="primary" />
        <ProgressBar size="large" tone="success" />
        <ProgressBar size="large" tone="critical" />
    </div>
  ),
};
