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
    docs: { description: { component: "PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption." } },
  },
  argTypes: {
    size: { control: 'select', options: ['large', 'medium', 'small'] },
    state: { control: 'select', options: ['default', 'hover', 'focus', 'pressed', 'disabled'] },
    text: { control: 'text' },
    iconLeft: { control: 'boolean' },
    iconRight: { control: 'boolean' },
  },
  args: {
    size: 'large',
    state: 'default',
    text: 'Button',
    iconLeft: false,
    iconRight: false,
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
/** Every legal combination the contract defines (size × state). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(5, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <ButtonBrandPrimary size="large" state="default" />
        <ButtonBrandPrimary size="large" state="hover" />
        <ButtonBrandPrimary size="large" state="focus" />
        <ButtonBrandPrimary size="large" state="pressed" />
        <ButtonBrandPrimary size="large" state="disabled" />
        <ButtonBrandPrimary size="medium" state="default" />
        <ButtonBrandPrimary size="medium" state="hover" />
        <ButtonBrandPrimary size="medium" state="focus" />
        <ButtonBrandPrimary size="medium" state="pressed" />
        <ButtonBrandPrimary size="medium" state="disabled" />
        <ButtonBrandPrimary size="small" state="default" />
        <ButtonBrandPrimary size="small" state="hover" />
        <ButtonBrandPrimary size="small" state="focus" />
        <ButtonBrandPrimary size="small" state="pressed" />
        <ButtonBrandPrimary size="small" state="disabled" />
    </div>
  ),
};
