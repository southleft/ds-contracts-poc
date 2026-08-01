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
    children: { control: 'text' },
  },
  args: {
    supportingText: true,
    theme: 'light',
    arrow: 'bottomCenter',
    children: 'This is a tooltip',
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
      <Tooltip theme="light" arrow="bottomCenter">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="none">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="topCenter">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="bottomLeft">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="left">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="right">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="light" arrow="bottomRight">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="bottomCenter">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="none">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="topCenter">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="bottomLeft">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="left">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="right">
        This is a tooltip
      </Tooltip>
      <Tooltip theme="dark" arrow="bottomRight">
        This is a tooltip
      </Tooltip>
    </div>
  ),
};
