/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/stack.contract.json (ds.stack v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Stack',
  component: Stack,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Vertical layout primitive — stacks children with a token-governed gap. Screens compose from Stack/Inline instead of raw styled divs.',
      },
    },
  },
  argTypes: {
    gap: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Space between children.' },
  },
  args: {
    gap: 'md',
  },
} satisfies Meta<typeof Stack>;

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
      <Stack gap="sm" />
      <Stack gap="md" />
      <Stack gap="lg" />
    </div>
  ),
};
