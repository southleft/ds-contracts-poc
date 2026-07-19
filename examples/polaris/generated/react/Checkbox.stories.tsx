/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (polaris.checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md." } },
  },
  argTypes: {
    ariaControls: { control: 'text', description: 'Indicates the ID of the element that is controlled by the checkbox' },
    ariaDescribedBy: { control: 'text', description: 'Indicates the ID of the element that describes the checkbox' },
    labelHidden: { control: 'boolean', description: 'Visually hide the label' },
    disabled: { control: 'boolean', description: 'Disable input' },
    name: { control: 'text', description: 'Name for form input' },
    value: { control: 'text', description: 'Value for form input' },
    labelClassName: { control: 'text', description: 'Added to the wrapping label' },
  },
  args: {
    labelHidden: false,
    disabled: false,
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
