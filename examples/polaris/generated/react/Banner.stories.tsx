/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (polaris.banner v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md." } },
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
