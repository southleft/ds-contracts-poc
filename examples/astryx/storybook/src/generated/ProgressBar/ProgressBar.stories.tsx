/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (astryx.progress-bar v0.3.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx ProgressBar — a determinate meter with a label row. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/ProgressBar/ProgressBar.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). value/max/label/variant and the indeterminate/disabled flags are verbatim; isLabelHidden, hasValueLabel and formatValueLabel are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/progressbar/decisions.md); extension sidecar carries the named overflow.',
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
