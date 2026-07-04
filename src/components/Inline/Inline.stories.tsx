/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline.contract.json (ds.inline v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from './Inline';

const meta = {
  title: 'Components/Inline',
  component: Inline,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Horizontal layout primitive — lays children out in a row with a token-governed gap, vertically centered.',
      },
    },
  },
  argTypes: {
    gap: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Space between children.' },
  },
  args: {
    gap: 'md',
  },
} satisfies Meta<typeof Inline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { gap: 'sm' },
};

export const Md: Story = {
  args: { gap: 'md' },
};

export const Lg: Story = {
  args: { gap: 'lg' },
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
      <Inline gap="sm" />
      <Inline gap="md" />
      <Inline gap="lg" />
    </div>
  ),
};
