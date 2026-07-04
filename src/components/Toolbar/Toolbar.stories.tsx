/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toolbar.contract.json (ds.toolbar v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from './Toolbar';

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'General-purpose toolbar container with start, center, and end content areas for contextual actions. API mirrors industry convention (Astryx Toolbar); roving-tabindex keyboard behavior is a declared boundary.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Minimum toolbar height; children keep their own sizes.',
    },
    label: { control: 'text', description: 'Accessible label for the toolbar.' },
    startContent: { control: false },
    centerContent: { control: false },
    endContent: { control: false },
  },
  args: {
    size: 'md',
    label: 'Toolbar',
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
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
      <Toolbar size="sm" label="Toolbar" />
      <Toolbar size="md" label="Toolbar" />
      <Toolbar size="lg" label="Toolbar" />
    </div>
  ),
};
