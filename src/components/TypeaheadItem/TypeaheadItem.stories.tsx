/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/typeahead-item.contract.json (ds.typeahead-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TypeaheadItem } from './TypeaheadItem';

const meta = {
  title: 'Components/TypeaheadItem',
  component: TypeaheadItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Default dropdown item for search results: label with optional icon and description. API mirrors industry convention (Astryx TypeaheadItem) with the item object flattened to explicit props.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Primary result text.' },
    description: { control: 'text', description: 'Secondary text below the label.' },
    icon: { control: false },
  },
  args: {
    label: 'Search result',
    description: 'Supporting detail about this result.',
  },
} satisfies Meta<typeof TypeaheadItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
