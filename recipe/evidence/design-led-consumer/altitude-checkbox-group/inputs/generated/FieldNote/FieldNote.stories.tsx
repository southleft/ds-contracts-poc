/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field-note.contract.json (ds.field-note v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { FieldNote } from './FieldNote';

const meta = {
  title: 'Components/FieldNote',
  component: FieldNote,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tag: al-field-note\n\nProps\n- isDisabled: boolean — Disabled attribute\n- isError: boolean — Error state\n\nSlots\n- (default) — The field note content\n\nAccessibility\n- element: <div>\n\nDocs: https://altitude.pages.dev/docs/components/field-note/\n\nDocumentation: https://altitude.pages.dev/docs/components/field-note/',
      },
    },
  },
  argTypes: {
    state: { control: 'select', options: ['default', 'error', 'disabled'] },
    text: { control: 'text' },
  },
  args: {
    state: 'default',
    text: 'Helper text',
  },
} satisfies Meta<typeof FieldNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Error: Story = {
  args: { state: 'error' },
};

export const Disabled: Story = {
  args: { state: 'disabled' },
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
      <FieldNote state="default" />
      <FieldNote state="error" />
      <FieldNote state="disabled" />
    </div>
  ),
};
