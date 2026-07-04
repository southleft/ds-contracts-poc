/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/status-dot.contract.json (ds.status-dot v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusDot } from './StatusDot';

const meta = {
  title: 'Components/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Small colored dot communicating status — presence, severity, activity. API mirrors industry convention (Astryx StatusDot): five semantic variants with a required accessible label.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'error', 'accent', 'neutral'],
      description: 'Semantic color variant.',
    },
    label: {
      control: 'text',
      description:
        'Accessible label announced by screen readers — status must never be conveyed by color alone.',
    },
  },
  args: {
    variant: 'neutral',
    label: 'Status',
  },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Success: Story = {
  args: { variant: 'success' },
};

export const Warning: Story = {
  args: { variant: 'warning' },
};

export const Error: Story = {
  args: { variant: 'error' },
};

export const Accent: Story = {
  args: { variant: 'accent' },
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
      <StatusDot variant="success" label="Status" />
      <StatusDot variant="warning" label="Status" />
      <StatusDot variant="error" label="Status" />
      <StatusDot variant="accent" label="Status" />
      <StatusDot variant="neutral" label="Status" />
    </div>
  ),
};
