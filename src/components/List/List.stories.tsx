/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/list.contract.json (ds.list v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListItem } from '../ListItem';
import { List } from './List';

const meta = {
  title: 'Components/List',
  component: List,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Vertical collection of items with consistent density. API mirrors industry convention (Astryx List); dividers need sibling-selector styling and marker styles need list-style tokens — documented gaps.',
      },
    },
  },
  render: (args) => (
    <List {...args}>
      <ListItem label="Design tokens" description="210 governed values" />
      <ListItem label="Contracts" description="One JSON file per component" />
      <ListItem label="Parity checks" description="Three surfaces, one differ" />
    </List>
  ),
  argTypes: {
    density: {
      control: 'select',
      options: ['compact', 'balanced', 'spacious'],
      description: 'Item spacing density.',
    },
    children: { control: false },
  },
  args: {
    density: 'balanced',
  },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Compact: Story = {
  args: { density: 'compact' },
};

export const Balanced: Story = {
  args: { density: 'balanced' },
};

export const Spacious: Story = {
  args: { density: 'spacious' },
};
