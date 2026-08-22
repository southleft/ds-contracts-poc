/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/input-field-base.contract.json (ds.input-field-base v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { InputFieldBase } from './InputFieldBase';

const meta = {
  title: 'Components/InputFieldBase',
  component: InputFieldBase,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['default', 'paymentInput', 'leadingDropdown', 'leadingText', 'trailingDropdown'],
    },
    destructive: { control: 'boolean' },
  },
  args: {
    type: 'default',
    destructive: false,
  },
} satisfies Meta<typeof InputFieldBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { type: 'default' },
};

export const PaymentInput: Story = {
  args: { type: 'paymentInput' },
};

export const LeadingDropdown: Story = {
  args: { type: 'leadingDropdown' },
};

export const LeadingText: Story = {
  args: { type: 'leadingText' },
};

export const TrailingDropdown: Story = {
  args: { type: 'trailingDropdown' },
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
      <InputFieldBase type="default" />
      <InputFieldBase type="paymentInput" />
      <InputFieldBase type="leadingDropdown" />
      <InputFieldBase type="leadingText" />
      <InputFieldBase type="trailingDropdown" />
    </div>
  ),
};
