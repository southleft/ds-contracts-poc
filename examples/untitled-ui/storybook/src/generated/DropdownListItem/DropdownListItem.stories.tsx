/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-list-item.contract.json (ds.dropdown-list-item v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { DropdownListItem } from './DropdownListItem';

const meta = {
  title: 'Components/DropdownListItem',
  component: DropdownListItem,
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
    icon: { control: 'boolean' },
    checkbox: { control: 'boolean' },
    shortcut: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    icon: true,
    checkbox: false,
    shortcut: false,
    disabled: false,
  },
} satisfies Meta<typeof DropdownListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
