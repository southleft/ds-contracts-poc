/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-group.contract.json (ds.checkbox-group v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { CheckboxGroup } from './CheckboxGroup';

const meta = {
  title: 'Components/CheckboxGroup',
  component: CheckboxGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A set of checkboxes that are one question. It exists for its semantics, not its spacing — it renders a real `<fieldset>` with a `<legend>`, carries one field note and one error note for the whole set, and cascades `isRequired` and `isDisabled` down to every checkbox inside it.\n\nTag: al-checkbox-group\n\nProps\n- direction: row | column — Direction\n- hideLegend: boolean — Hide legend?\n- isDisabled: boolean — Disabled attribute\n- isError: boolean — Error state\n- label — Label\n  - Displays: inside the legend\n\nSlots\n- (default) — The component content, a set of checkbox items.\n- error — If content is slotted, it will display in place of the errorNote property\n- field-note — If content is slotted, it will display in place of the fieldNote property\n\nAccessibility\n- element: <fieldset>\n\nDocs: https://altitude.pages.dev/docs/components/checkbox-group/\n\nDocumentation: https://altitude.pages.dev/docs/components/checkbox-group/',
      },
    },
  },
  argTypes: {
    legend: { control: 'select', options: ['shown', 'hidden'] },
    orientation: { control: 'select', options: ['column', 'row'] },
    state: { control: 'select', options: ['default', 'disabled', 'error'] },
    text: { control: 'text' },
    items: { control: false },
  },
  args: {
    legend: 'shown',
    orientation: 'column',
    state: 'default',
    text: 'Checkbox group legend label',
    items: [{ text: 'Checkbox label' }, { text: 'Checkbox label' }, { text: 'Checkbox label' }],
  },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Shown: Story = {
  args: { legend: 'shown' },
};

export const Hidden: Story = {
  args: { legend: 'hidden' },
};
/** Every legal combination the contract defines (legend × orientation × state). */
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
      <CheckboxGroup legend="shown" orientation="column" state="default" />
      <CheckboxGroup legend="shown" orientation="column" state="disabled" />
      <CheckboxGroup legend="shown" orientation="column" state="error" />
      <CheckboxGroup legend="shown" orientation="row" state="default" />
      <CheckboxGroup legend="shown" orientation="row" state="disabled" />
      <CheckboxGroup legend="shown" orientation="row" state="error" />
      <CheckboxGroup legend="hidden" orientation="column" state="default" />
      <CheckboxGroup legend="hidden" orientation="column" state="disabled" />
      <CheckboxGroup legend="hidden" orientation="column" state="error" />
      <CheckboxGroup legend="hidden" orientation="row" state="default" />
      <CheckboxGroup legend="hidden" orientation="row" state="disabled" />
      <CheckboxGroup legend="hidden" orientation="row" state="error" />
    </div>
  ),
};
