/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (polaris.badge v0.3.2)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Badge/Badge.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: single-tone static bindings on root (background-color/color/font-weight) and label typography REMOVED — the real tone/progress axes contest them per value; the computed floor rebuilds these channels from browser truth (S2 base + per-axis mint). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/badge.extension.json. Delta ledger: extract/computed/out/badge/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md)." } },
  },
  argTypes: {
    tone: { control: 'select', options: ['info', 'success', 'warning', 'critical', 'attention', 'new', 'magic', 'info-strong', 'success-strong', 'warning-strong', 'critical-strong', 'attention-strong', 'read-only', 'enabled'], description: 'Colors and labels the badge with the given tone (round 4: enumerated from the real @shopify/polaris@13.9.5 Badge API — the static extraction had missed the styling axes entirely).' },
    progress: { control: 'select', options: ['none', 'incomplete', 'partiallyComplete', 'complete'], description: 'Render a pip showing the progress of a given task (round 4: real Badge API axis).' },
    toneAndProgressLabelOverride: { control: 'text', description: 'Pass a custom accessibilityLabel' },
  },
  args: {
    progress: 'none',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Info: Story = {
  args: { tone: 'info' },
};

export const Success: Story = {
  args: { tone: 'success' },
};

export const Warning: Story = {
  args: { tone: 'warning' },
};

export const Critical: Story = {
  args: { tone: 'critical' },
};

export const Attention: Story = {
  args: { tone: 'attention' },
};

export const New: Story = {
  args: { tone: 'new' },
};

export const Magic: Story = {
  args: { tone: 'magic' },
};

export const InfoStrong: Story = {
  args: { tone: 'info-strong' },
};

export const SuccessStrong: Story = {
  args: { tone: 'success-strong' },
};

export const WarningStrong: Story = {
  args: { tone: 'warning-strong' },
};

export const CriticalStrong: Story = {
  args: { tone: 'critical-strong' },
};

export const AttentionStrong: Story = {
  args: { tone: 'attention-strong' },
};

export const ReadOnly: Story = {
  args: { tone: 'read-only' },
};

export const Enabled: Story = {
  args: { tone: 'enabled' },
};
/** Every legal combination the contract defines (tone × progress). */
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
        <Badge tone="info" progress="none" />
        <Badge tone="info" progress="incomplete" />
        <Badge tone="info" progress="partiallyComplete" />
        <Badge tone="info" progress="complete" />
        <Badge tone="success" progress="none" />
        <Badge tone="success" progress="incomplete" />
        <Badge tone="success" progress="partiallyComplete" />
        <Badge tone="success" progress="complete" />
        <Badge tone="warning" progress="none" />
        <Badge tone="warning" progress="incomplete" />
        <Badge tone="warning" progress="partiallyComplete" />
        <Badge tone="warning" progress="complete" />
        <Badge tone="critical" progress="none" />
        <Badge tone="critical" progress="incomplete" />
        <Badge tone="critical" progress="partiallyComplete" />
        <Badge tone="critical" progress="complete" />
        <Badge tone="attention" progress="none" />
        <Badge tone="attention" progress="incomplete" />
        <Badge tone="attention" progress="partiallyComplete" />
        <Badge tone="attention" progress="complete" />
        <Badge tone="new" progress="none" />
        <Badge tone="new" progress="incomplete" />
        <Badge tone="new" progress="partiallyComplete" />
        <Badge tone="new" progress="complete" />
        <Badge tone="magic" progress="none" />
        <Badge tone="magic" progress="incomplete" />
        <Badge tone="magic" progress="partiallyComplete" />
        <Badge tone="magic" progress="complete" />
        <Badge tone="info-strong" progress="none" />
        <Badge tone="info-strong" progress="incomplete" />
        <Badge tone="info-strong" progress="partiallyComplete" />
        <Badge tone="info-strong" progress="complete" />
        <Badge tone="success-strong" progress="none" />
        <Badge tone="success-strong" progress="incomplete" />
        <Badge tone="success-strong" progress="partiallyComplete" />
        <Badge tone="success-strong" progress="complete" />
        <Badge tone="warning-strong" progress="none" />
        <Badge tone="warning-strong" progress="incomplete" />
        <Badge tone="warning-strong" progress="partiallyComplete" />
        <Badge tone="warning-strong" progress="complete" />
        <Badge tone="critical-strong" progress="none" />
        <Badge tone="critical-strong" progress="incomplete" />
        <Badge tone="critical-strong" progress="partiallyComplete" />
        <Badge tone="critical-strong" progress="complete" />
        <Badge tone="attention-strong" progress="none" />
        <Badge tone="attention-strong" progress="incomplete" />
        <Badge tone="attention-strong" progress="partiallyComplete" />
        <Badge tone="attention-strong" progress="complete" />
        <Badge tone="read-only" progress="none" />
        <Badge tone="read-only" progress="incomplete" />
        <Badge tone="read-only" progress="partiallyComplete" />
        <Badge tone="read-only" progress="complete" />
        <Badge tone="enabled" progress="none" />
        <Badge tone="enabled" progress="incomplete" />
        <Badge tone="enabled" progress="partiallyComplete" />
        <Badge tone="enabled" progress="complete" />
    </div>
  ),
};
