/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (astryx.button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Button — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Button/Button.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). Visual/structural API is verbatim; HTML passthrough (type, name, form, target, rel), href link-mode, isInterruptible and tooltip are dropped (documented in DEV-JOURNEY.md). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
      description: 'The visual style variant of the button.',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'The size of the button.',
    },
    isDisabled: { control: 'boolean', description: 'Whether the button is disabled.' },
    isLoading: { control: 'boolean', description: 'Whether the button is in a loading state.' },
    isIconOnly: { control: 'boolean', description: 'Renders as a square icon-only button.' },
    label: { control: 'text', description: 'Accessible, visible button label.' },
  },
  args: {
    variant: 'secondary',
    size: 'md',
    isDisabled: false,
    isLoading: false,
    isIconOnly: false,
    label: 'Button',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
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
      <Button variant="primary" size="sm" label="Button" />
      <Button variant="primary" size="md" label="Button" />
      <Button variant="primary" size="lg" label="Button" />
      <Button variant="secondary" size="sm" label="Button" />
      <Button variant="secondary" size="md" label="Button" />
      <Button variant="secondary" size="lg" label="Button" />
      <Button variant="ghost" size="sm" label="Button" />
      <Button variant="ghost" size="md" label="Button" />
      <Button variant="ghost" size="lg" label="Button" />
      <Button variant="destructive" size="sm" label="Button" />
      <Button variant="destructive" size="md" label="Button" />
      <Button variant="destructive" size="lg" label="Button" />
    </div>
  ),
};
