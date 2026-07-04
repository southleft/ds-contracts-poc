/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/skeleton.contract.json (ds.skeleton v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Pulsing placeholder previewing the shape of loading content. API mirrors industry convention (Astryx Skeleton) with the free-form width/height flattened to a shape variant; the pulse is CSS-only — the canvas shows the static shape.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'rect', 'circle'],
      description: 'The shape being previewed.',
    },
  },
  args: {
    variant: 'text',
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Text: Story = {
  args: { variant: 'text' },
};

export const Rect: Story = {
  args: { variant: 'rect' },
};

export const Circle: Story = {
  args: { variant: 'circle' },
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
      <Skeleton variant="text" />
      <Skeleton variant="rect" />
      <Skeleton variant="circle" />
    </div>
  ),
};
