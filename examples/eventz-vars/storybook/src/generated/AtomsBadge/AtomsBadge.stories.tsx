/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-badge.contract.json (ds.atoms-badge v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { AtomsBadge } from './AtomsBadge';

const meta = {
  title: 'Components/AtomsBadge',
  component: AtomsBadge,
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
    variant: { control: 'select', options: ['accent', 'info', 'warning', 'featured', 'brand'] },
    hasIcon: { control: 'boolean' },
    hasLabel: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    variant: 'accent',
    hasIcon: true,
    hasLabel: true,
    label: 'Label',
  },
} satisfies Meta<typeof AtomsBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Accent: Story = {
  args: { variant: 'accent' },
};

export const Info: Story = {
  args: { variant: 'info' },
};

export const Warning: Story = {
  args: { variant: 'warning' },
};

export const Featured: Story = {
  args: { variant: 'featured' },
};

export const Brand: Story = {
  args: { variant: 'brand' },
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
      <AtomsBadge variant="accent" />
      <AtomsBadge variant="info" />
      <AtomsBadge variant="warning" />
      <AtomsBadge variant="featured" />
      <AtomsBadge variant="brand" />
    </div>
  ),
};
