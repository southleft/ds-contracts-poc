/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (astryx.slider v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from './Slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Slider — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Slider/Slider.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/min/max/step/orientation/valueDisplay and the optional/required/disabled flags are verbatim (82%; recovered from a union-of-refs named-skip via the keyof+union adapter fix). value, description, disabledMessage, labelTooltip, htmlName and minStepsBetweenThumbs are dropped. STRUCTURAL: track/thumb render as styled boxes, not a native range input. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'The slider label.' },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Slider orientation.',
    },
    valueDisplay: {
      control: 'select',
      options: ['tooltip', 'text', 'none'],
      description: 'How the current value is shown.',
    },
    isDisabled: { control: 'boolean', description: 'Whether the slider is disabled.' },
    isRequired: { control: 'boolean', description: 'Whether the slider is required.' },
  },
  args: {
    label: 'Volume',
    orientation: 'horizontal',
    valueDisplay: 'tooltip',
    isDisabled: false,
    isRequired: false,
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
};
/** Every legal combination the contract defines (orientation × valueDisplay). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(3, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Slider orientation="horizontal" valueDisplay="tooltip" label="Volume" />
      <Slider orientation="horizontal" valueDisplay="text" label="Volume" />
      <Slider orientation="horizontal" valueDisplay="none" label="Volume" />
      <Slider orientation="vertical" valueDisplay="tooltip" label="Volume" />
      <Slider orientation="vertical" valueDisplay="text" label="Volume" />
      <Slider orientation="vertical" valueDisplay="none" label="Volume" />
    </div>
  ),
};
