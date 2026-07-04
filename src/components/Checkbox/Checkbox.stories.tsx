/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Toggles a single on/off value — settings, terms acceptance, opt-ins. API mirrors industry convention (Astryx CheckboxInput): checked, unchecked, and indeterminate are prop-driven appearance states.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'select',
      options: ['unchecked', 'checked', 'indeterminate'],
      description: 'Checked, unchecked, or indeterminate (partial selection in a group).',
    },
    size: { control: 'select', options: ['sm', 'md'], description: 'Control size.' },
    label: {
      control: 'text',
      description: 'Always rendered — users must know what they are toggling.',
    },
    description: { control: 'text', description: 'Secondary text below the label.' },
  },
  args: {
    value: 'unchecked',
    size: 'md',
    label: 'Checkbox label',
    description: 'Supporting detail for this option.',
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Unchecked: Story = {
  args: { value: 'unchecked' },
};

export const Checked: Story = {
  args: { value: 'checked' },
};

export const Indeterminate: Story = {
  args: { value: 'indeterminate' },
};
/** Every legal combination the contract defines (value × size). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Checkbox value="unchecked" size="sm" label="Checkbox label" />
      <Checkbox value="unchecked" size="md" label="Checkbox label" />
      <Checkbox value="checked" size="sm" label="Checkbox label" />
      <Checkbox value="checked" size="md" label="Checkbox label" />
      <Checkbox value="indeterminate" size="sm" label="Checkbox label" />
      <Checkbox value="indeterminate" size="md" label="Checkbox label" />
    </div>
  ),
};
