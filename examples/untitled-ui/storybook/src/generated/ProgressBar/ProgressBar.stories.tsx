/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (ds.progress-bar v0.1.0)
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
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    progress: {
      control: 'select',
      options: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
    },
    label: {
      control: 'select',
      options: ['right', 'bottom', 'topFloating', 'bottomFloating', 'false'],
    },
  },
  args: {
    progress: '0',
    label: 'right',
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Progress0: Story = {
  args: { progress: '0' },
};

export const Progress10: Story = {
  args: { progress: '10' },
};

export const Progress20: Story = {
  args: { progress: '20' },
};

export const Progress30: Story = {
  args: { progress: '30' },
};

export const Progress40: Story = {
  args: { progress: '40' },
};

export const Progress50: Story = {
  args: { progress: '50' },
};

export const Progress60: Story = {
  args: { progress: '60' },
};

export const Progress70: Story = {
  args: { progress: '70' },
};

export const Progress80: Story = {
  args: { progress: '80' },
};

export const Progress90: Story = {
  args: { progress: '90' },
};

export const Progress100: Story = {
  args: { progress: '100' },
};
/** Every legal combination the contract defines (progress × label). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(5, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <ProgressBar progress="0" label="right" />
      <ProgressBar progress="0" label="bottom" />
      <ProgressBar progress="0" label="topFloating" />
      <ProgressBar progress="0" label="bottomFloating" />
      <ProgressBar progress="0" label="false" />
      <ProgressBar progress="10" label="right" />
      <ProgressBar progress="10" label="bottom" />
      <ProgressBar progress="10" label="topFloating" />
      <ProgressBar progress="10" label="bottomFloating" />
      <ProgressBar progress="10" label="false" />
      <ProgressBar progress="20" label="right" />
      <ProgressBar progress="20" label="bottom" />
      <ProgressBar progress="20" label="topFloating" />
      <ProgressBar progress="20" label="bottomFloating" />
      <ProgressBar progress="20" label="false" />
      <ProgressBar progress="30" label="right" />
      <ProgressBar progress="30" label="bottom" />
      <ProgressBar progress="30" label="topFloating" />
      <ProgressBar progress="30" label="bottomFloating" />
      <ProgressBar progress="30" label="false" />
      <ProgressBar progress="40" label="right" />
      <ProgressBar progress="40" label="bottom" />
      <ProgressBar progress="40" label="topFloating" />
      <ProgressBar progress="40" label="bottomFloating" />
      <ProgressBar progress="40" label="false" />
      <ProgressBar progress="50" label="right" />
      <ProgressBar progress="50" label="bottom" />
      <ProgressBar progress="50" label="topFloating" />
      <ProgressBar progress="50" label="bottomFloating" />
      <ProgressBar progress="50" label="false" />
      <ProgressBar progress="60" label="right" />
      <ProgressBar progress="60" label="bottom" />
      <ProgressBar progress="60" label="topFloating" />
      <ProgressBar progress="60" label="bottomFloating" />
      <ProgressBar progress="60" label="false" />
      <ProgressBar progress="70" label="right" />
      <ProgressBar progress="70" label="bottom" />
      <ProgressBar progress="70" label="topFloating" />
      <ProgressBar progress="70" label="bottomFloating" />
      <ProgressBar progress="70" label="false" />
      <ProgressBar progress="80" label="right" />
      <ProgressBar progress="80" label="bottom" />
      <ProgressBar progress="80" label="topFloating" />
      <ProgressBar progress="80" label="bottomFloating" />
      <ProgressBar progress="80" label="false" />
      <ProgressBar progress="90" label="right" />
      <ProgressBar progress="90" label="bottom" />
      <ProgressBar progress="90" label="topFloating" />
      <ProgressBar progress="90" label="bottomFloating" />
      <ProgressBar progress="90" label="false" />
      <ProgressBar progress="100" label="right" />
      <ProgressBar progress="100" label="bottom" />
      <ProgressBar progress="100" label="topFloating" />
      <ProgressBar progress="100" label="bottomFloating" />
      <ProgressBar progress="100" label="false" />
    </div>
  ),
};
