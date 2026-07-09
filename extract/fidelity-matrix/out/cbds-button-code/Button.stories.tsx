/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from southleft/cbds-components/src/components/Button/Button.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review." } },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'surface', 'danger', 'ghost'] },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    fullWidth: { control: 'boolean' },
    iconLeft: { control: false },
    iconRight: { control: false },
    children: { control: 'text' },
  },
  args: {
    variant: 'primary',
    size: 'medium',
    fullWidth: false,
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Surface: Story = {
  args: { variant: 'surface' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};
/** Every legal combination the contract defines (variant × size). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(3, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <Button variant="primary" size="small">Button</Button>
        <Button variant="primary" size="medium">Button</Button>
        <Button variant="primary" size="large">Button</Button>
        <Button variant="surface" size="small">Button</Button>
        <Button variant="surface" size="medium">Button</Button>
        <Button variant="surface" size="large">Button</Button>
        <Button variant="danger" size="small">Button</Button>
        <Button variant="danger" size="medium">Button</Button>
        <Button variant="danger" size="large">Button</Button>
        <Button variant="ghost" size="small">Button</Button>
        <Button variant="ghost" size="medium">Button</Button>
        <Button variant="ghost" size="large">Button</Button>
    </div>
  ),
};
