/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (astryx.badge v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Badge — a small status/category label. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Badge/Badge.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). API surface (variant) is verbatim; the label is materialized as a text content part (Astryx types it as a ReactNode child slot, dropped as a `node` prop in extraction — see DEV-JOURNEY.md). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'neutral',
        'info',
        'success',
        'warning',
        'error',
        'blue',
        'cyan',
        'green',
        'orange',
        'pink',
        'purple',
        'red',
        'teal',
        'yellow',
      ],
      description: 'The visual style variant of the badge.',
    },
    children: {
      control: 'text',
      description: 'Badge label (materialized text slot — Astryx types this as a ReactNode child).',
    },
  },
  args: {
    variant: 'neutral',
    children: 'Badge',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Neutral: Story = {
  args: { variant: 'neutral' },
};

export const Info: Story = {
  args: { variant: 'info' },
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

export const Blue: Story = {
  args: { variant: 'blue' },
};

export const Cyan: Story = {
  args: { variant: 'cyan' },
};

export const Green: Story = {
  args: { variant: 'green' },
};

export const Orange: Story = {
  args: { variant: 'orange' },
};

export const Pink: Story = {
  args: { variant: 'pink' },
};

export const Purple: Story = {
  args: { variant: 'purple' },
};

export const Red: Story = {
  args: { variant: 'red' },
};

export const Teal: Story = {
  args: { variant: 'teal' },
};

export const Yellow: Story = {
  args: { variant: 'yellow' },
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
      <Badge variant="neutral">Badge</Badge>
      <Badge variant="info">Badge</Badge>
      <Badge variant="success">Badge</Badge>
      <Badge variant="warning">Badge</Badge>
      <Badge variant="error">Badge</Badge>
      <Badge variant="blue">Badge</Badge>
      <Badge variant="cyan">Badge</Badge>
      <Badge variant="green">Badge</Badge>
      <Badge variant="orange">Badge</Badge>
      <Badge variant="pink">Badge</Badge>
      <Badge variant="purple">Badge</Badge>
      <Badge variant="red">Badge</Badge>
      <Badge variant="teal">Badge</Badge>
      <Badge variant="yellow">Badge</Badge>
    </div>
  ),
};
