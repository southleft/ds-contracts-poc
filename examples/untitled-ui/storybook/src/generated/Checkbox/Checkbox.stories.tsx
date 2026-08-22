/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Checkbox" instances of _Dropdown list item — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component\'s exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    checked: { control: 'select', options: ['false'] },
    indeterminate: { control: 'select', options: ['false'] },
    size: { control: 'select', options: ['sm'] },
    type: { control: 'select', options: ['checkbox'] },
    text: { control: 'select', options: ['false'] },
    supportingText: { control: 'select', options: ['false'] },
    state: { control: 'select', options: ['default'] },
  },
  args: {
    checked: 'false',
    indeterminate: 'false',
    size: 'sm',
    type: 'checkbox',
    text: 'false',
    supportingText: 'false',
    state: 'default',
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const False: Story = {
  args: { checked: 'false' },
};
/** Every legal combination the contract defines (checked × indeterminate × size × type × text × supportingText × state). */
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
      <Checkbox
        checked="false"
        indeterminate="false"
        size="sm"
        type="checkbox"
        text="false"
        supportingText="false"
        state="default"
      />
    </div>
  ),
};
