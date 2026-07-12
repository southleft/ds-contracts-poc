/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (ds.switch v2.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Toggle for on/off settings that take effect immediately. API mirrors industry convention (Astryx Switch) with the boolean value flattened to an off/on enum so both surfaces render both states truthfully; toggle behavior is a declared boundary. v2.0.0 (breaking, DOM shape): the control is a NATIVE input[type=checkbox] with role=switch (the modern switch pattern) inside the wrapping label — checked is DOM state, not ARIA on a button; track and thumb are presentational.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'select',
      options: ['off', 'on'],
      description: 'On or off — drives the track color and thumb position.',
    },
    label: {
      control: 'text',
      description: 'Always rendered — users must know what they are toggling.',
    },
    description: { control: 'text', description: 'Secondary text below the label.' },
    onToggle: {
      control: false,
      description:
        'Fires when the input is toggled; uncontrolled instances flip value off/on themselves.',
    },
  },
  args: {
    label: 'Enable notifications',
    description: 'Takes effect immediately.',
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Off: Story = {
  args: { value: 'off' },
};

export const On: Story = {
  args: { value: 'on' },
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
      <Switch value="off" label="Enable notifications" />
      <Switch value="on" label="Enable notifications" />
    </div>
  ),
};
