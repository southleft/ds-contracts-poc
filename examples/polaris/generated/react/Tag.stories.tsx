/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tag.contract.json (polaris.tag v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag';

const meta = {
  title: 'Components/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Tag/Tag.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md." } },
  },
  argTypes: {
    disabled: { control: 'boolean', description: 'Disables the tag' },
    accessibilityLabel: { control: 'text', description: 'A string to use when tag has more than textual content' },
    url: { control: 'text', description: 'Url to navigate to when tag is clicked or keypressed.' },
  },
  args: {
    disabled: false,
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
