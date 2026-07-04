/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-area.contract.json (ds.text-area v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextArea } from './TextArea';

const meta = {
  title: 'Components/TextArea',
  component: TextArea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-line text input for longer-form content — comments, descriptions, messages. API mirrors industry convention (Astryx TextArea); wrapping-label anatomy gives implicit association.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Control size scale (affects padding and text size).',
    },
    isRequired: { control: 'boolean', description: 'Marks the field required.' },
    label: { control: 'text', description: 'Field label — always rendered.' },
    description: {
      control: 'text',
      description: 'Helper text between the label and the textarea.',
    },
    placeholder: { control: 'text', description: 'Hint shown when empty.' },
  },
  args: {
    size: 'md',
    isRequired: false,
    label: 'Label',
    description: 'Helper text that explains the expected content.',
    placeholder: 'Write something…',
  },
} satisfies Meta<typeof TextArea>;

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
      <TextArea size="sm" label="Label" />
      <TextArea size="md" label="Label" />
      <TextArea size="lg" label="Label" />
    </div>
  ),
};
