/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/list-item.contract.json (ds.list-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { ListItem } from './ListItem';

const meta = {
  title: 'Components/ListItem',
  component: ListItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single row in a List: label with optional description, leading and trailing content. API mirrors industry convention (Astryx ListItem); click/link behavior is a declared boundary.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Primary text.' },
    description: { control: 'text', description: 'Secondary content below the label.' },
    startContent: { control: false },
    endContent: { control: false },
  },
  args: {
    label: 'List item',
    description: 'Supporting detail for this item.',
  },
} satisfies Meta<typeof ListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "endContent" slot accepts: ds.badge. */
export const WithEndContent: Story = {
  render: (args) => <ListItem {...args} endContent={<Badge>Badge</Badge>} />,
};
