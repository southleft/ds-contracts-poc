/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (ds.slider v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Slider } from './Slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
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
    label: { control: 'select', options: ['bottom', 'bottomFloating', 'topFloating', 'false'] },
    rightControl: { control: 'select', options: ['25', '50', '75', '100'] },
    leftControl: { control: 'select', options: ['0', '25', '50', '75'] },
  },
  args: {
    label: 'bottom',
    rightControl: '25',
    leftControl: '0',
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Bottom: Story = {
  args: { label: 'bottom' },
};

export const BottomFloating: Story = {
  args: { label: 'bottomFloating' },
};

export const TopFloating: Story = {
  args: { label: 'topFloating' },
};

export const False: Story = {
  args: { label: 'false' },
};
/** Every legal combination the contract defines (label × rightControl × leftControl). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(16, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Slider label="bottom" rightControl="25" leftControl="0" />
      <Slider label="bottom" rightControl="25" leftControl="25" />
      <Slider label="bottom" rightControl="25" leftControl="50" />
      <Slider label="bottom" rightControl="25" leftControl="75" />
      <Slider label="bottom" rightControl="50" leftControl="0" />
      <Slider label="bottom" rightControl="50" leftControl="25" />
      <Slider label="bottom" rightControl="50" leftControl="50" />
      <Slider label="bottom" rightControl="50" leftControl="75" />
      <Slider label="bottom" rightControl="75" leftControl="0" />
      <Slider label="bottom" rightControl="75" leftControl="25" />
      <Slider label="bottom" rightControl="75" leftControl="50" />
      <Slider label="bottom" rightControl="75" leftControl="75" />
      <Slider label="bottom" rightControl="100" leftControl="0" />
      <Slider label="bottom" rightControl="100" leftControl="25" />
      <Slider label="bottom" rightControl="100" leftControl="50" />
      <Slider label="bottom" rightControl="100" leftControl="75" />
      <Slider label="bottomFloating" rightControl="25" leftControl="0" />
      <Slider label="bottomFloating" rightControl="25" leftControl="25" />
      <Slider label="bottomFloating" rightControl="25" leftControl="50" />
      <Slider label="bottomFloating" rightControl="25" leftControl="75" />
      <Slider label="bottomFloating" rightControl="50" leftControl="0" />
      <Slider label="bottomFloating" rightControl="50" leftControl="25" />
      <Slider label="bottomFloating" rightControl="50" leftControl="50" />
      <Slider label="bottomFloating" rightControl="50" leftControl="75" />
      <Slider label="bottomFloating" rightControl="75" leftControl="0" />
      <Slider label="bottomFloating" rightControl="75" leftControl="25" />
      <Slider label="bottomFloating" rightControl="75" leftControl="50" />
      <Slider label="bottomFloating" rightControl="75" leftControl="75" />
      <Slider label="bottomFloating" rightControl="100" leftControl="0" />
      <Slider label="bottomFloating" rightControl="100" leftControl="25" />
      <Slider label="bottomFloating" rightControl="100" leftControl="50" />
      <Slider label="bottomFloating" rightControl="100" leftControl="75" />
      <Slider label="topFloating" rightControl="25" leftControl="0" />
      <Slider label="topFloating" rightControl="25" leftControl="25" />
      <Slider label="topFloating" rightControl="25" leftControl="50" />
      <Slider label="topFloating" rightControl="25" leftControl="75" />
      <Slider label="topFloating" rightControl="50" leftControl="0" />
      <Slider label="topFloating" rightControl="50" leftControl="25" />
      <Slider label="topFloating" rightControl="50" leftControl="50" />
      <Slider label="topFloating" rightControl="50" leftControl="75" />
      <Slider label="topFloating" rightControl="75" leftControl="0" />
      <Slider label="topFloating" rightControl="75" leftControl="25" />
      <Slider label="topFloating" rightControl="75" leftControl="50" />
      <Slider label="topFloating" rightControl="75" leftControl="75" />
      <Slider label="topFloating" rightControl="100" leftControl="0" />
      <Slider label="topFloating" rightControl="100" leftControl="25" />
      <Slider label="topFloating" rightControl="100" leftControl="50" />
      <Slider label="topFloating" rightControl="100" leftControl="75" />
      <Slider label="false" rightControl="25" leftControl="0" />
      <Slider label="false" rightControl="25" leftControl="25" />
      <Slider label="false" rightControl="25" leftControl="50" />
      <Slider label="false" rightControl="25" leftControl="75" />
      <Slider label="false" rightControl="50" leftControl="0" />
      <Slider label="false" rightControl="50" leftControl="25" />
      <Slider label="false" rightControl="50" leftControl="50" />
      <Slider label="false" rightControl="50" leftControl="75" />
      <Slider label="false" rightControl="75" leftControl="0" />
      <Slider label="false" rightControl="75" leftControl="25" />
      <Slider label="false" rightControl="75" leftControl="50" />
      <Slider label="false" rightControl="75" leftControl="75" />
      <Slider label="false" rightControl="100" leftControl="0" />
      <Slider label="false" rightControl="100" leftControl="25" />
      <Slider label="false" rightControl="100" leftControl="50" />
      <Slider label="false" rightControl="100" leftControl="75" />
    </div>
  ),
};
