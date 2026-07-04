/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/top-nav.contract.json (ds.top-nav v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TopNavItem } from '../TopNavItem';
import { TopNav } from './TopNav';

const meta = {
  title: 'Components/TopNav',
  component: TopNav,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Horizontal main navigation bar with heading, start, center, and end areas. API mirrors industry convention (Astryx TopNav); hover menus and mega-menus are behavior-layer boundaries.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Accessible label for the navigation landmark.' },
    heading: { control: false },
    startContent: { control: false },
    endContent: { control: false },
  },
  args: {
    label: 'Main',
  },
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "startContent" slot accepts: ds.top-nav-item. */
export const WithStartContent: Story = {
  render: (args) => <TopNav {...args} startContent={<TopNavItem label="Nav item" />} />,
};
