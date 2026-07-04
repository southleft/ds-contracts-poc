/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (ds.slider v1.0.0)
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
          'Numeric selection within bounds — the static surface of a slider: label, filled track to the current value, and thumb. API mirrors industry convention (Astryx Slider); drag behavior and range mode are declared boundaries.',
      },
    },
  },
  argTypes: {
    value: { control: { type: 'number' }, description: 'Current value — positions the thumb.' },
    max: { control: { type: 'number' }, description: 'Maximum value.' },
    label: { control: 'text', description: 'Always rendered.' },
  },
  args: {
    value: 40,
    max: 100,
    label: 'Volume',
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
