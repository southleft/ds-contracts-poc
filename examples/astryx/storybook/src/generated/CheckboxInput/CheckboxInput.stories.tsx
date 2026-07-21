/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-input.contract.json (astryx.checkbox-input v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckboxInput } from './CheckboxInput';

const meta = {
  title: 'Components/CheckboxInput',
  component: CheckboxInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx CheckboxInput — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/CheckboxInput/CheckboxInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label + size + the disabled/readonly/optional/required flags are verbatim; description, disabledMessage, htmlName and isLoading are dropped. STRUCTURAL: the control renders as a styled box (div), not a native <input> — a11y semantics are a Phase A-2 concern. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'The checkbox label.' },
    size: { control: 'select', options: ['sm', 'md'], description: 'The control size.' },
    isDisabled: { control: 'boolean', description: 'Whether the checkbox is disabled.' },
    isReadOnly: { control: 'boolean', description: 'Whether the checkbox is read-only.' },
    isRequired: { control: 'boolean', description: 'Whether the checkbox is required.' },
  },
  args: {
    label: 'Accept terms',
    size: 'md',
    isDisabled: false,
    isReadOnly: false,
    isRequired: false,
  },
} satisfies Meta<typeof CheckboxInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Md: Story = {
  args: { size: 'md' },
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
      <CheckboxInput size="sm" label="Accept terms" />
      <CheckboxInput size="md" label="Accept terms" />
    </div>
  ),
};
