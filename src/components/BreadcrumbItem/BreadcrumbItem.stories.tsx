/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/breadcrumb-item.contract.json (ds.breadcrumb-item v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BreadcrumbItem } from './BreadcrumbItem';

const meta = {
  title: 'Components/BreadcrumbItem',
  component: BreadcrumbItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One link in a breadcrumb trail with its leading separator. API mirrors industry convention (Astryx BreadcrumbItem); the first item is authored with hasSeparator off (positional part logic is a documented gap), and aria-current needs conditional attributes — also documented.',
      },
    },
  },
  argTypes: {
    hasSeparator: {
      control: 'boolean',
      description: 'Leading separator — off for the first item in a trail.',
    },
    label: { control: 'text', description: 'The crumb text.' },
    href: {
      control: 'text',
      description: 'Navigation target. Current-page items conventionally point at themselves.',
    },
  },
  args: {
    hasSeparator: true,
    label: 'Page',
    href: '#',
  },
} satisfies Meta<typeof BreadcrumbItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
