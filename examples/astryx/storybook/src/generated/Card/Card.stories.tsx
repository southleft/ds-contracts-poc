/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (astryx.card v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Card — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Card/Card.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). The single extracted structural axis (variant, 13 values) is verbatim; children is a materialized content slot (Astryx types Card body as ReactNode, dropped as a node prop). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'transparent',
        'muted',
        'blue',
        'cyan',
        'gray',
        'green',
        'orange',
        'pink',
        'purple',
        'red',
        'teal',
        'yellow',
      ],
      description: 'The surface tone of the card.',
    },
    children: { control: 'text', description: 'Card body (materialized slot).' },
  },
  args: {
    variant: 'default',
    children: 'Card content',
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { variant: 'default' },
};

export const Transparent: Story = {
  args: { variant: 'transparent' },
};

export const Muted: Story = {
  args: { variant: 'muted' },
};

export const Blue: Story = {
  args: { variant: 'blue' },
};

export const Cyan: Story = {
  args: { variant: 'cyan' },
};

export const Gray: Story = {
  args: { variant: 'gray' },
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
      <Card variant="default">Card content</Card>
      <Card variant="transparent">Card content</Card>
      <Card variant="muted">Card content</Card>
      <Card variant="blue">Card content</Card>
      <Card variant="cyan">Card content</Card>
      <Card variant="gray">Card content</Card>
      <Card variant="green">Card content</Card>
      <Card variant="orange">Card content</Card>
      <Card variant="pink">Card content</Card>
      <Card variant="purple">Card content</Card>
      <Card variant="red">Card content</Card>
      <Card variant="teal">Card content</Card>
      <Card variant="yellow">Card content</Card>
    </div>
  ),
};
