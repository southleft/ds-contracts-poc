/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-circle.contract.json (ds.progress-circle v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ProgressCircle } from './ProgressCircle';

const meta = {
  title: 'Components/ProgressCircle',
  component: ProgressCircle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['md', 'lg', 'sm', 'xs'] },
    shape: { control: 'select', options: ['circle', 'halfCircle'] },
    label: { control: 'boolean' },
  },
  args: {
    size: 'md',
    shape: 'circle',
    label: true,
  },
} satisfies Meta<typeof ProgressCircle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Xs: Story = {
  args: { size: 'xs' },
};
/** Every legal combination the contract defines (size × shape). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <ProgressCircle size="md" shape="circle" />
      <ProgressCircle size="md" shape="halfCircle" />
      <ProgressCircle size="lg" shape="circle" />
      <ProgressCircle size="lg" shape="halfCircle" />
      <ProgressCircle size="sm" shape="circle" />
      <ProgressCircle size="sm" shape="halfCircle" />
      <ProgressCircle size="xs" shape="circle" />
      <ProgressCircle size="xs" shape="halfCircle" />
    </div>
  ),
};
