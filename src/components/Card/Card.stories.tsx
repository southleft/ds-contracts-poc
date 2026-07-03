/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (ds.card v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Groups related content behind one subject. Composes an Avatar, a bound title, a default body slot, and a constrained actions slot.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Card heading, bound to the header title part on both surfaces.',
    },
    actions: { control: false },
    children: { control: 'text' },
  },
  args: {
    title: 'Card title',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "actions" slot accepts: ds.button, ds.badge. */
export const WithActions: Story = {
  render: (args) => <Card {...args} actions={<Button>Button</Button>} />,
};
