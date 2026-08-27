/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-input.contract.json (astryx.checkbox-input v0.3.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { CheckboxInput } from './CheckboxInput';

const meta = {
  title: 'Components/CheckboxInput',
  component: CheckboxInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx CheckboxInput — a labelled checkbox form control. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/CheckboxInput/CheckboxInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/size and the disabled/readOnly/required flags are verbatim; description, disabledMessage, htmlName, isLoading and isLabelHidden are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/checkboxinput/decisions.md); extension sidecar carries the named overflow.',
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
