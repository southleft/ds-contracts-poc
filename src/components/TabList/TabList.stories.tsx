/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-list.contract.json (ds.tab-list v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tab } from '../Tab';
import { TabList } from './TabList';

const meta = {
  title: 'Components/TabList',
  component: TabList,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tab-style navigation container holding Tab items. API mirrors industry convention (Astryx TabList); roving-tabindex keyboard behavior and controlled selection are declared boundaries.',
      },
    },
  },
  render: (args) => (
    <TabList {...args}>
      <Tab label="Overview" state="selected" />
      <Tab label="Components" />
      <Tab label="Tokens" />
    </TabList>
  ),
  argTypes: {
    children: { control: false },
  },
  args: {},
} satisfies Meta<typeof TabList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
