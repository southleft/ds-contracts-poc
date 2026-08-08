/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/grid-gallery.contract.json (ds.grid-gallery v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridGallery } from './GridGallery';

const meta = {
  title: 'Components/GridGallery',
  component: GridGallery,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Three equal fr columns filled by row auto-flow (G5) — the placement fact is CHILD ORDER, not an anchor. Six repeated slots flow into two derived rows.',
      },
    },
  },
  argTypes: {
    item1: { control: false },
    item2: { control: false },
    item3: { control: false },
    item4: { control: false },
    item5: { control: false },
    item6: { control: false },
  },
  args: {},
} satisfies Meta<typeof GridGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
