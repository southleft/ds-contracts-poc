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
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    supportingText: { control: 'boolean' },
    theme: { control: 'select', options: ['light', 'dark'] },
    arrow: {
      control: 'select',
      options: ['bottomCenter', 'none', 'topCenter', 'bottomLeft', 'left', 'right', 'bottomRight'],
    },
  },
  args: {
    supportingText: true,
    theme: 'light',
    arrow: 'bottomCenter',
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Light: Story = {
  args: { theme: 'light' },
};

export const Dark: Story = {
  args: { theme: 'dark' },
};
/** Every legal combination the contract defines (theme × arrow). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(7, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Tooltip theme="light" arrow="bottomCenter" />
      <Tooltip theme="light" arrow="none" />
      <Tooltip theme="light" arrow="topCenter" />
      <Tooltip theme="light" arrow="bottomLeft" />
      <Tooltip theme="light" arrow="left" />
      <Tooltip theme="light" arrow="right" />
      <Tooltip theme="light" arrow="bottomRight" />
      <Tooltip theme="dark" arrow="bottomCenter" />
      <Tooltip theme="dark" arrow="none" />
      <Tooltip theme="dark" arrow="topCenter" />
      <Tooltip theme="dark" arrow="bottomLeft" />
      <Tooltip theme="dark" arrow="left" />
      <Tooltip theme="dark" arrow="right" />
      <Tooltip theme="dark" arrow="bottomRight" />
    </div>
  ),
};
