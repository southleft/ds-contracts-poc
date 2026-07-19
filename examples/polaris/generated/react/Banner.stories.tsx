/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (polaris.banner v0.2.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.2.0 (extract/computed round 2): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), contradictions resolved computed-wins per the decisions ledger (extract/computed/out/banner/decisions.md, human-acked; source resolved.contract.json). Everything the vocabulary cannot carry is named in contracts/banner.extension.json. Delta ledger: extract/computed/out/banner/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md)." } },
  },
  argTypes: {
    title: { control: 'text', description: 'Title content for the banner.' },
    hideIcon: { control: 'boolean', description: 'Renders the banner without a status icon.' },
    tone: { control: 'select', options: ['success', 'info', 'warning', 'critical'], description: 'Sets the status of the banner.' },
    stopAnnouncements: { control: 'boolean', description: 'Disables screen reader announcements when changing the content of the banner' },
  },
  args: {
    hideIcon: false,
    tone: 'info',
    stopAnnouncements: false,
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Success: Story = {
  args: { tone: 'success' },
};

export const Info: Story = {
  args: { tone: 'info' },
};

export const Warning: Story = {
  args: { tone: 'warning' },
};

export const Critical: Story = {
  args: { tone: 'critical' },
};
/** Every legal combination the contract defines. */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(1, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <Banner tone="success" />
        <Banner tone="info" />
        <Banner tone="warning" />
        <Banner tone="critical" />
    </div>
  ),
};
