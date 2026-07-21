/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-input.contract.json (astryx.text-input v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextInput } from './TextInput';

const meta = {
  title: 'Components/TextInput',
  component: TextInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx TextInput — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/TextInput/TextInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). type/label/size/placeholder and the optional/required/disabled/clear/autofocus flags are verbatim (83% facts-carried); description, disabledMessage, labelTooltip, htmlName and isLoading are dropped. value is materialized as a placeholder-backed text field. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email'],
      description: 'The input type.',
    },
    label: { control: 'text', description: 'The field label.' },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'The field size.' },
    placeholder: { control: 'text', description: 'Placeholder text.' },
    isRequired: { control: 'boolean', description: 'Whether the field is required.' },
    isDisabled: { control: 'boolean', description: 'Whether the field is disabled.' },
    hasClear: { control: 'boolean', description: 'Whether the field shows a clear button.' },
  },
  args: {
    type: 'text',
    label: 'Email',
    size: 'md',
    placeholder: 'you@example.com',
    isRequired: false,
    isDisabled: false,
    hasClear: false,
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Text: Story = {
  args: { type: 'text' },
};

export const Password: Story = {
  args: { type: 'password' },
};

export const Email: Story = {
  args: { type: 'email' },
};
/** Every legal combination the contract defines (type × size). */
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
      <TextInput type="text" size="sm" label="Email" />
      <TextInput type="text" size="md" label="Email" />
      <TextInput type="text" size="lg" label="Email" />
      <TextInput type="password" size="sm" label="Email" />
      <TextInput type="password" size="md" label="Email" />
      <TextInput type="password" size="lg" label="Email" />
      <TextInput type="email" size="sm" label="Email" />
      <TextInput type="email" size="md" label="Email" />
      <TextInput type="email" size="lg" label="Email" />
    </div>
  ),
};
