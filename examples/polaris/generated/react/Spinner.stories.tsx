/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (polaris.spinner v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Spinner } from './Spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Spinner/Spinner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    size: { control: 'select', options: ['small', 'large'], description: 'Size of spinner' },
    accessibilityLabel: { control: 'text', description: 'Accessible label for the spinner' },
    hasFocusableParent: { control: 'boolean', description: 'Allows the component to apply the correct accessibility roles based on focus' },
  },
  args: {
    size: 'large',
    hasFocusableParent: false,
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: 'small' },
};

export const Large: Story = {
  args: { size: 'large' },
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
        <Spinner size="small" />
        <Spinner size="large" />
    </div>
  ),
};
