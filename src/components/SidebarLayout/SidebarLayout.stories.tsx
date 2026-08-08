/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/sidebar-layout.contract.json (ds.sidebar-layout v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidebarLayout } from './SidebarLayout';

const meta = {
  title: 'Components/SidebarLayout',
  component: SidebarLayout,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A stationary px sidebar column beside an fr main column — mixed track kinds in one declared list (G1). The sidebar never reflows; main absorbs the remainder.',
      },
    },
  },
  argTypes: {
    sidebar: { control: false },
    main: { control: false },
  },
  args: {},
} satisfies Meta<typeof SidebarLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
