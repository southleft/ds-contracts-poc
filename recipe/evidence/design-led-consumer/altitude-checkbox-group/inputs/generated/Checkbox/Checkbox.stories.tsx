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
          'Tag: al-checkbox\n\nProps\n- hideLabel: boolean — Hide label?\n- isChecked: boolean — Checked attribute\n- isDisabled: boolean — Disabled attribute\n- isError: boolean — Error state\n- isIndeterminate: boolean — Indeterminate state\n\nSlots\n- (default) — The component content that appears next to the checkbox\n- error — If content is slotted, it will display in place of the errorNote property\n- field-note — If content is slotted, it will display in place of the fieldNote property\n\nAccessibility\n- element: <div>\n- key Enter: Toggles the checked state. Space is the native <input type="checkbox"> activation and needs no handler here.\n- focus: The native input takes focus; the visible indicator is a 1px primary border edge plus a 3px soft halo of the same hue (--al-theme-color-border-primary-default / -weak), with outline: none. The solid edge carries the 3:1 WCAG non-text contrast - the halo is decoration.\n\nDocs: https://altitude.pages.dev/docs/components/checkbox/\n\nDocumentation: https://altitude.pages.dev/docs/components/checkbox/',
      },
    },
  },
  argTypes: {
    state: { control: 'select', options: ['default', 'disabled', 'focus', 'hover', 'error'] },
    checked: { control: 'select', options: ['off', 'indeterminate', 'on'] },
    label: { control: 'select', options: ['shown', 'hidden'] },
    text: { control: 'text' },
  },
  args: {
    state: 'default',
    checked: 'off',
    label: 'shown',
    text: 'Checkbox label',
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Disabled: Story = {
  args: { state: 'disabled' },
};

export const Focus: Story = {
  args: { state: 'focus' },
};

export const Hover: Story = {
  args: { state: 'hover' },
};

export const Error: Story = {
  args: { state: 'error' },
};
/** Every legal combination the contract defines (state × checked × label). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(6, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Checkbox state="default" checked="off" label="shown" />
      <Checkbox state="default" checked="off" label="hidden" />
      <Checkbox state="default" checked="indeterminate" label="shown" />
      <Checkbox state="default" checked="indeterminate" label="hidden" />
      <Checkbox state="default" checked="on" label="shown" />
      <Checkbox state="default" checked="on" label="hidden" />
      <Checkbox state="disabled" checked="off" label="shown" />
      <Checkbox state="disabled" checked="off" label="hidden" />
      <Checkbox state="disabled" checked="indeterminate" label="shown" />
      <Checkbox state="disabled" checked="indeterminate" label="hidden" />
      <Checkbox state="disabled" checked="on" label="shown" />
      <Checkbox state="disabled" checked="on" label="hidden" />
      <Checkbox state="focus" checked="off" label="shown" />
      <Checkbox state="focus" checked="off" label="hidden" />
      <Checkbox state="focus" checked="indeterminate" label="shown" />
      <Checkbox state="focus" checked="indeterminate" label="hidden" />
      <Checkbox state="focus" checked="on" label="shown" />
      <Checkbox state="focus" checked="on" label="hidden" />
      <Checkbox state="hover" checked="off" label="shown" />
      <Checkbox state="hover" checked="off" label="hidden" />
      <Checkbox state="hover" checked="indeterminate" label="shown" />
      <Checkbox state="hover" checked="indeterminate" label="hidden" />
      <Checkbox state="hover" checked="on" label="shown" />
      <Checkbox state="hover" checked="on" label="hidden" />
      <Checkbox state="error" checked="off" label="shown" />
      <Checkbox state="error" checked="off" label="hidden" />
      <Checkbox state="error" checked="indeterminate" label="shown" />
      <Checkbox state="error" checked="indeterminate" label="hidden" />
      <Checkbox state="error" checked="on" label="shown" />
      <Checkbox state="error" checked="on" label="hidden" />
    </div>
  ),
};
