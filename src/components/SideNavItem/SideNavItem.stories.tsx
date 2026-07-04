/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/side-nav-item.contract.json (ds.side-nav-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { SideNavItem } from './SideNavItem';

const meta = {
  title: 'Components/SideNavItem',
  component: SideNavItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A sidebar navigation row: icon, label, and trailing content, with a selected state. API mirrors industry convention (Astryx SideNavItem); nesting and collapse are behavior-layer boundaries.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'selected'],
      description: 'Whether this item is the current page.',
    },
    label: { control: 'text', description: 'Item text.' },
    href: { control: 'text', description: 'Navigation target URL.' },
    icon: { control: false },
    endContent: { control: false },
  },
  args: {
    state: 'default',
    label: 'Navigation item',
    href: '#',
  },
} satisfies Meta<typeof SideNavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Selected: Story = {
  args: { state: 'selected' },
};
/** The "endContent" slot accepts: ds.badge. */
export const WithEndContent: Story = {
  render: (args) => <SideNavItem {...args} endContent={<Badge>Badge</Badge>} />,
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
      <SideNavItem state="default" label="Navigation item" />
      <SideNavItem state="selected" label="Navigation item" />
    </div>
  ),
};
