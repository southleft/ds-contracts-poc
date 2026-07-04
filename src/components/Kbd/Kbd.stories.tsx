/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/kbd.contract.json (ds.kbd v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './Kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a keyboard shortcut as a styled key badge for tooltips, menus, and help text. API mirrors industry convention (Astryx Kbd); multi-key parsing ("mod+K" into separate badges) is display logic — a documented gap, one badge per component for now.',
      },
    },
  },
  argTypes: {
    keys: { control: 'text', description: 'The shortcut text, e.g. "⌘K".' },
  },
  args: {
    keys: '⌘K',
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
