/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-field.contract.json (ds.text-field v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single-line text input for short-form values — names, emails, search queries. API mirrors industry convention (Astryx TextInput): required label, description, size scale. The wrapping-label anatomy gives implicit label association. Disabled fields dim and drop pointer interaction via stylesWhen (code-side conditional styling; a declared canvas fidelity limit).',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Control size scale.' },
    isRequired: {
      control: 'boolean',
      description: 'Marks the field required — shows the indicator beside the label.',
    },
    isDisabled: { control: 'boolean', description: 'Disabled state.' },
    label: {
      control: 'text',
      description: 'Field label — always rendered; placeholders are not labels.',
    },
    description: { control: 'text', description: 'Helper text between the label and the input.' },
    placeholder: {
      control: 'text',
      description: 'Hint shown when the field is empty. Never a substitute for the label.',
    },
  },
  args: {
    size: 'md',
    isRequired: false,
    isDisabled: false,
    label: 'Label',
    description: 'Helper text that explains the expected value.',
    placeholder: 'Enter a value…',
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
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
      <TextField size="sm" label="Label" />
      <TextField size="md" label="Label" />
      <TextField size="lg" label="Label" />
    </div>
  ),
};
