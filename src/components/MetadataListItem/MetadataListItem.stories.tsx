/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/metadata-list-item.contract.json (ds.metadata-list-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetadataListItem } from './MetadataListItem';

const meta = {
  title: 'Components/MetadataListItem',
  component: MetadataListItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One key–value pair in a MetadataList: a label and a value area. API mirrors industry convention (Astryx MetadataListItem).',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'The key text.' },
    value: {
      control: 'text',
      description: 'The value text. Use the children slot instead for rich values.',
    },
    icon: { control: false },
  },
  args: {
    label: 'Label',
    value: 'Value',
  },
} satisfies Meta<typeof MetadataListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
