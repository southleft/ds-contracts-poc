/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (ds.progress-bar v1.0.1)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Horizontal bar showing completion progress. API mirrors industry convention (Astryx ProgressBar): number-valued value/max drive the fill; the canvas renders the defaults' fraction as its honest static state. Indeterminate mode needs animation on the canvas — a documented boundary.",
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['accent', 'success', 'warning', 'error', 'neutral'],
      description: 'Semantic color of the fill.',
    },
    value: { control: { type: 'number' }, description: 'Current progress value.' },
    max: { control: { type: 'number' }, description: 'Maximum value.' },
    label: {
      control: 'text',
      description: 'Accessible name — screen readers must know what is progressing.',
    },
  },
  args: {
    variant: 'accent',
    value: 60,
    max: 100,
    label: 'Progress',
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Accent: Story = {
  args: { variant: 'accent' },
};

export const Success: Story = {
  args: { variant: 'success' },
};

export const Warning: Story = {
  args: { variant: 'warning' },
};

export const Error: Story = {
  args: { variant: 'error' },
};

export const Neutral: Story = {
  args: { variant: 'neutral' },
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
      <ProgressBar variant="accent" label="Progress" />
      <ProgressBar variant="success" label="Progress" />
      <ProgressBar variant="warning" label="Progress" />
      <ProgressBar variant="error" label="Progress" />
      <ProgressBar variant="neutral" label="Progress" />
    </div>
  ),
};
