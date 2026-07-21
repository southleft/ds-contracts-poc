/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (astryx.switch v0.1.0)
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
          'Astryx Switch — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Switch/Switch.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label + labelPosition + labelSpacing and the disabled/optional/required flags are verbatim; value, description, htmlName, labelTooltip, disabledMessage and isLoading are dropped. STRUCTURAL: the track renders as a styled box, not a native role=switch input. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'The switch label.' },
    labelPosition: {
      control: 'select',
      options: ['start', 'end'],
      description: 'Where the label sits relative to the track.',
    },
    isDisabled: { control: 'boolean', description: 'Whether the switch is disabled.' },
    isRequired: { control: 'boolean', description: 'Whether the switch is required.' },
  },
  args: {
    label: 'Enable notifications',
    labelPosition: 'end',
    isDisabled: false,
    isRequired: false,
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Start: Story = {
  args: { labelPosition: 'start' },
};

export const End: Story = {
  args: { labelPosition: 'end' },
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
      <Switch labelPosition="start" label="Enable notifications" />
      <Switch labelPosition="end" label="Enable notifications" />
    </div>
  ),
};
