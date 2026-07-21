/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (astryx.progress-bar v0.1.0)
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
          'Astryx ProgressBar — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/ProgressBar/ProgressBar.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). value/max/label/variant and the value-label/indeterminate/disabled flags are verbatim (89% facts-carried, the richest census extraction). STRUCTURAL: the track/fill render as styled boxes, not a native <progress>. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    value: { control: { type: 'number' }, description: 'Current progress value.' },
    max: { control: { type: 'number' }, description: 'Maximum progress value.' },
    label: { control: 'text', description: 'Accessible label for the progress bar.' },
    variant: {
      control: 'select',
      options: ['accent', 'success', 'warning', 'neutral', 'error'],
      description: 'The fill tone.',
    },
    isIndeterminate: { control: 'boolean', description: 'Whether progress is indeterminate.' },
    isDisabled: { control: 'boolean', description: 'Whether the progress bar is disabled.' },
  },
  args: {
    value: 40,
    max: 100,
    label: 'Uploading',
    variant: 'accent',
    isIndeterminate: false,
    isDisabled: false,
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

export const Neutral: Story = {
  args: { variant: 'neutral' },
};

export const Error: Story = {
  args: { variant: 'error' },
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
      <ProgressBar variant="accent" label="Uploading" />
      <ProgressBar variant="success" label="Uploading" />
      <ProgressBar variant="warning" label="Uploading" />
      <ProgressBar variant="neutral" label="Uploading" />
      <ProgressBar variant="error" label="Uploading" />
    </div>
  ),
};
