/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field.contract.json (ds.field v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field';

const meta = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Form field wrapper providing a label, description, and required indicator around any control. API mirrors industry convention (Astryx Field): the label targets the control via inputID; validation status needs structured-object props — a documented gap.',
      },
    },
  },
  argTypes: {
    isRequired: {
      control: 'boolean',
      description: 'Shows the required indicator beside the label.',
    },
    label: { control: 'text', description: 'Always rendered — even custom controls need names.' },
    inputID: {
      control: 'text',
      description: "The wrapped control's id, used for the label's htmlFor association.",
    },
    description: { control: 'text', description: 'Helper text between the label and the control.' },
    children: { control: 'text' },
  },
  args: {
    isRequired: false,
    label: 'Field label',
    inputID: 'field-control',
    description: 'Helper text for the wrapped control.',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
