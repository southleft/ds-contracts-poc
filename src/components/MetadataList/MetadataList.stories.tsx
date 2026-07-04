/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/metadata-list.contract.json (ds.metadata-list v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetadataListItem } from '../MetadataListItem';
import { MetadataList } from './MetadataList';

const meta = {
  title: 'Components/MetadataList',
  component: MetadataList,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Key–value pairs for object attributes — detail panels, settings summaries, record information. API mirrors industry convention (Astryx MetadataList); multi-column layout and collapse behavior are documented boundaries.',
      },
    },
  },
  render: (args) => (
    <MetadataList {...args}>
      <MetadataListItem label="Owner" value="Design Infrastructure" />
      <MetadataListItem label="Status" value="Active" />
      <MetadataListItem label="Updated" value="2 hours ago" />
    </MetadataList>
  ),
  argTypes: {
    title: { control: 'text', description: 'Heading above the list.' },
    children: { control: false },
  },
  args: {
    title: 'Details',
  },
} satisfies Meta<typeof MetadataList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
