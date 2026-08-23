/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-menu.contract.json (astryx.dropdown-menu v0.2.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { DropdownMenu } from './DropdownMenu';

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "PROMOTED from the Phase B composition-tier extraction (round 2) — the flagship composition exhibit: a MULTI-ROOT component (trigger + menu overlay) whose menu holds a REPEATED astryx.dropdown-menu-item collection over the `items` prop. The extraction recovered exactly this shape from Meta's source (fragment root → trigger Button ref + popover.render overlay carrying the items repeat AND the children slot). Curation receipts: (1) the DUAL MODE — items-array XOR compound children — is mutually exclusive in code; the contract carries the DATA mode (repeat), the canvas-projectable one; (2) the DropdownMenuContext provider ref was dropped (context is a code mechanism, not anatomy); (3) the popover overlay projects as a sibling root below the trigger — live placement/anchoring is a design-tool behavior outside the contract (same convention as the composite Modal's roots); (4) the repeat sample is authored (design-time values are not decidable from code — the extractor said so by name).",
      },
    },
  },
  argTypes: {
    items: {
      control: false,
      description:
        "The menu's item records — one astryx.dropdown-menu-item per record (the extracted repeat channel).",
    },
    hasChevron: {
      control: 'boolean',
      description: 'Whether the trigger shows the dropdown chevron (extracted, default true).',
    },
  },
  args: {
    items: [{ label: 'Edit' }, { label: 'Duplicate' }, { label: 'Delete' }],
    hasChevron: true,
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
