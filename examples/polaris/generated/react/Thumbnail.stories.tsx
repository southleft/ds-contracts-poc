/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/thumbnail.contract.json (polaris.thumbnail v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Thumbnail } from './Thumbnail';

const meta = {
  title: 'Components/Thumbnail',
  component: Thumbnail,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Thumbnail/Thumbnail.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md." } },
  },
  argTypes: {
    size: { control: 'select', options: ['extraSmall', 'small', 'medium', 'large'], description: 'Size of thumbnail' },
    alt: { control: 'text', description: 'Alt text for the thumbnail image' },
    transparent: { control: 'boolean', description: 'Transparent background' },
  },
  args: {
    size: 'medium',
    alt: 'Black choker necklace',
    transparent: false,
  },
} satisfies Meta<typeof Thumbnail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ExtraSmall: Story = {
  args: { size: 'extraSmall' },
};

export const Small: Story = {
  args: { size: 'small' },
};

export const Medium: Story = {
  args: { size: 'medium' },
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
        <Thumbnail size="extraSmall" alt="Black choker necklace" />
        <Thumbnail size="small" alt="Black choker necklace" />
        <Thumbnail size="medium" alt="Black choker necklace" />
        <Thumbnail size="large" alt="Black choker necklace" />
    </div>
  ),
};
