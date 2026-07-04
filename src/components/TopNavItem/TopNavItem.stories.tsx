/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/top-nav-item.contract.json (ds.top-nav-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TopNavItem } from './TopNavItem';

const meta = {
  title: 'Components/TopNavItem',
  component: TopNavItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A navigation item in a TopNav or SideNav context. API mirrors industry convention (Astryx TopNavItem) with selection flattened to a state enum; the selected state applies aria-current.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'selected'],
      description: 'Whether this item is the current page.',
    },
    label: { control: 'text', description: 'Visible item text.' },
    href: { control: 'text', description: 'Navigation target URL.' },
    icon: { control: false },
  },
  args: {
    state: 'default',
    label: 'Nav item',
    href: '#',
  },
} satisfies Meta<typeof TopNavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Selected: Story = {
  args: { state: 'selected' },
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
      <TopNavItem state="default" label="Nav item" />
      <TopNavItem state="selected" label="Nav item" />
    </div>
  ),
};
