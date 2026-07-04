/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/empty-state.contract.json (ds.empty-state v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Placeholder for a content area with no data — empty lists, zero results, first-time setup. API mirrors industry convention (Astryx EmptyState): always a title and a next step; the icon is decorative.',
      },
    },
  },
  argTypes: {
    title: { control: 'text', description: 'Primary message.' },
    description: {
      control: 'text',
      description: 'Secondary text explaining what will appear here and how.',
    },
    icon: { control: false },
    actions: { control: false },
  },
  args: {
    title: 'Nothing here yet',
    description: 'When items are added they will show up in this list.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "actions" slot accepts: ds.button. */
export const WithActions: Story = {
  render: (args) => <EmptyState {...args} actions={<Button>Button</Button>} />,
};
