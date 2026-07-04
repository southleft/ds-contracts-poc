/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/divider.contract.json (ds.divider v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider } from './Divider';

const meta = {
  title: 'Components/Divider',
  component: Divider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Visual separator dividing content into distinct sections. API mirrors industry convention (Astryx Divider) at the variant level; orientation requires per-enum-value property overrides — a documented schema gap.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['subtle', 'strong'],
      description: 'Visual weight of the line.',
    },
  },
  args: {
    variant: 'subtle',
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Subtle: Story = {
  args: { variant: 'subtle' },
};

export const Strong: Story = {
  args: { variant: 'strong' },
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
      <Divider variant="subtle" />
      <Divider variant="strong" />
    </div>
  ),
};
