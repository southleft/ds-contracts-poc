/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-brand-primary.contract.json (ds.button-brand-primary v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ButtonBrandPrimary } from './ButtonBrandPrimary';

const meta = {
  title: 'Components/ButtonBrandPrimary',
  component: ButtonBrandPrimary,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption." } },
  },
  argTypes: {
    size: { control: 'select', options: ['large', 'medium', 'small'] },
    text: { control: 'text' },
    iconLeft: { control: 'boolean' },
    iconRight: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    size: 'large',
    text: 'Button',
    iconLeft: false,
    iconRight: false,
    disabled: false,
  },
} satisfies Meta<typeof ButtonBrandPrimary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Large: Story = {
  args: { size: 'large' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Small: Story = {
  args: { size: 'small' },
};
export const Disabled: Story = {
  args: { disabled: true },
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
        <ButtonBrandPrimary size="large" />
        <ButtonBrandPrimary size="medium" />
        <ButtonBrandPrimary size="small" />
    </div>
  ),
};
