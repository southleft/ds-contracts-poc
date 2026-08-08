/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icons-checkbox.contract.json (ds.icons-checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconsCheckbox } from './IconsCheckbox';

const meta = {
  title: 'Components/IconsCheckbox',
  component: IconsCheckbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Icons/Checkbox" instances of Atoms/Checkbox — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    state: { control: 'select', options: ['unselected', 'selected'] },
  },
  args: {
    state: 'unselected',
  },
} satisfies Meta<typeof IconsCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Unselected: Story = {
  args: { state: 'unselected' },
};

export const Selected: Story = {
  args: { state: 'selected' },
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
      <IconsCheckbox state="unselected" />
      <IconsCheckbox state="selected" />
    </div>
  ),
};
