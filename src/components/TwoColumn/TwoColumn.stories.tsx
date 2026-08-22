/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/two-column.contract.json (ds.two-column v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { TwoColumn } from './TwoColumn';

const meta = {
  title: 'Components/TwoColumn',
  component: TwoColumn,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Two equal fr columns, each a slot. The simplest declared-track grid: G1 tracks, G2 explicit placement, one row that hugs its content.',
      },
    },
  },
  argTypes: {
    start: { control: false },
    end: { control: false },
  },
  args: {},
} satisfies Meta<typeof TwoColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
