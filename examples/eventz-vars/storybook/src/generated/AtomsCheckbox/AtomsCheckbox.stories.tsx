/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-checkbox.contract.json (ds.atoms-checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtomsCheckbox } from './AtomsCheckbox';

const meta = {
  title: 'Components/AtomsCheckbox',
  component: AtomsCheckbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    isChecked: { control: 'boolean' },
    isDisabled: { control: 'boolean' },
    label: { control: 'text' },
    hasHint: { control: 'boolean' },
  },
  args: {
    isChecked: false,
    isDisabled: false,
    label: 'Label',
    hasHint: true,
  },
} satisfies Meta<typeof AtomsCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
