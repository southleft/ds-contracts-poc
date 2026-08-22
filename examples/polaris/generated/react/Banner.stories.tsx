/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (polaris.banner v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    title: { control: 'text', description: 'Title content for the banner.' },
    hideIcon: { control: 'boolean', description: 'Renders the banner without a status icon.' },
    tone: { control: 'select', options: ['success', 'info', 'warning', 'critical'], description: 'Sets the status of the banner.' },
    stopAnnouncements: { control: 'boolean', description: 'Disables screen reader announcements when changing the content of the banner' },
    dismissible: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `onDismiss` ({"$callback":true}); the created subtree is carried as parts gated on this prop.' },
    withAction: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `action` ({"content":"Print label"}); the created subtree is carried as parts gated on this prop.' },
    children: { control: 'text', description: 'Promoted from the computed floor: the mounted children render as this part\'s text (captured mount proof).' },
  },
  args: {
    hideIcon: false,
    tone: 'info',
    stopAnnouncements: false,
    dismissible: false,
    withAction: false,
    children: 'Use your finance report to get detailed insights.',
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
        <Banner tone="success">Use your finance report to get detailed insights.</Banner>
        <Banner tone="info">Use your finance report to get detailed insights.</Banner>
        <Banner tone="warning">Use your finance report to get detailed insights.</Banner>
        <Banner tone="critical">Use your finance report to get detailed insights.</Banner>
    </div>
  ),
};
