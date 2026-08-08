/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field-label.contract.json (ds.field-label v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldLabel } from './FieldLabel';

const meta = {
  title: 'Components/FieldLabel',
  component: FieldLabel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested ".Field label" instances of Atoms/Input — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    hasTooltip: { control: 'boolean' },
    labelText: { control: 'text' },
  },
  args: {
    hasTooltip: true,
    labelText: 'Label',
  },
} satisfies Meta<typeof FieldLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
