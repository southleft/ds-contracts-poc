/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab.contract.json (ds.tab v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { Tab } from './Tab';

const meta = {
  title: 'Components/Tab',
  component: Tab,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single tab in a TabList. API mirrors industry convention (Astryx Tab) with selection flattened to a state enum so both surfaces render it truthfully; selection behavior itself is a declared boundary.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'selected'],
      description: 'Selection state — selected tabs render semibold in the accent color.',
    },
    label: { control: 'text', description: 'Visible tab text.' },
    icon: { control: false },
    endContent: { control: false },
  },
  args: {
    state: 'default',
    label: 'Tab',
  },
} satisfies Meta<typeof Tab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Selected: Story = {
  args: { state: 'selected' },
};
/** The "endContent" slot accepts: ds.badge, ds.status-dot. */
export const WithEndContent: Story = {
  render: (args) => <Tab {...args} endContent={<Badge>Badge</Badge>} />,
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
      <Tab state="default" label="Tab" />
      <Tab state="selected" label="Tab" />
    </div>
  ),
};
