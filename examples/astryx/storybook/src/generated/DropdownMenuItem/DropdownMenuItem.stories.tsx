/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-menu-item.contract.json (astryx.dropdown-menu-item v0.2.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenuItem } from './DropdownMenuItem';

const meta = {
  title: 'Components/DropdownMenuItem',
  component: DropdownMenuItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "PROMOTED from the Phase B composition-tier extraction (round 2, StyleX anatomy). One menu row — the repeated item of astryx.dropdown-menu. Curation receipts: the extracted anatomy leaned on the internal <Item> layout component (astryx.item); promotion FLATTENS it to the element row Item renders (a deep-internal contract is not part of the exhibit set), keeping the extracted StyleX token bindings verbatim. The extracted `description`/`endContent`/icon channels are deferred to a later round — this exhibit carries the label row, the composition proof's moving part.",
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: "The menu item's label text." },
    isDisabled: { control: 'boolean', description: 'Whether the item is disabled.' },
  },
  args: {
    label: 'Menu item',
    isDisabled: false,
  },
} satisfies Meta<typeof DropdownMenuItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
