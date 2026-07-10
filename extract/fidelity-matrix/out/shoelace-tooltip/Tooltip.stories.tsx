/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tooltip.contract.json (ds.tooltip v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption." } },
  },
  argTypes: {
    placement: { control: 'select', options: ['left', 'topleft', 'bottomleft', 'bottom', 'top', 'topright', 'bottomright', 'right'] },
    text: { control: 'text' },
  },
  args: {
    placement: 'left',
    text: 'Tooltip text',
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Left: Story = {
  args: { placement: 'left' },
};

export const Topleft: Story = {
  args: { placement: 'topleft' },
};

export const Bottomleft: Story = {
  args: { placement: 'bottomleft' },
};

export const Bottom: Story = {
  args: { placement: 'bottom' },
};

export const Top: Story = {
  args: { placement: 'top' },
};

export const Topright: Story = {
  args: { placement: 'topright' },
};

export const Bottomright: Story = {
  args: { placement: 'bottomright' },
};

export const Right: Story = {
  args: { placement: 'right' },
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
        <Tooltip placement="left" />
        <Tooltip placement="topleft" />
        <Tooltip placement="bottomleft" />
        <Tooltip placement="bottom" />
        <Tooltip placement="top" />
        <Tooltip placement="topright" />
        <Tooltip placement="bottomright" />
        <Tooltip placement="right" />
    </div>
  ),
};
