/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/token.contract.json (astryx.token v0.3.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Token } from './Token';

const meta = {
  title: 'Components/Token',
  component: Token,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Token (Tag/Chip) — a compact labelled chip. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Token/Token.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/size/color and isDisabled are verbatim; href link-mode, description and isLabelHidden are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/token/decisions.md); extension sidecar carries the named overflow.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Tag label.' },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'The size of the tag.' },
    color: {
      control: 'select',
      options: [
        'default',
        'red',
        'orange',
        'yellow',
        'green',
        'teal',
        'cyan',
        'blue',
        'purple',
        'pink',
        'gray',
      ],
      description: 'The tag color.',
    },
    isDisabled: { control: 'boolean', description: 'Whether the tag is disabled.' },
  },
  args: {
    label: 'Tag',
    size: 'md',
    color: 'default',
    isDisabled: false,
  },
} satisfies Meta<typeof Token>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
};
/** Every legal combination the contract defines (size × color). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(11, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Token size="sm" color="default" label="Tag" />
      <Token size="sm" color="red" label="Tag" />
      <Token size="sm" color="orange" label="Tag" />
      <Token size="sm" color="yellow" label="Tag" />
      <Token size="sm" color="green" label="Tag" />
      <Token size="sm" color="teal" label="Tag" />
      <Token size="sm" color="cyan" label="Tag" />
      <Token size="sm" color="blue" label="Tag" />
      <Token size="sm" color="purple" label="Tag" />
      <Token size="sm" color="pink" label="Tag" />
      <Token size="sm" color="gray" label="Tag" />
      <Token size="md" color="default" label="Tag" />
      <Token size="md" color="red" label="Tag" />
      <Token size="md" color="orange" label="Tag" />
      <Token size="md" color="yellow" label="Tag" />
      <Token size="md" color="green" label="Tag" />
      <Token size="md" color="teal" label="Tag" />
      <Token size="md" color="cyan" label="Tag" />
      <Token size="md" color="blue" label="Tag" />
      <Token size="md" color="purple" label="Tag" />
      <Token size="md" color="pink" label="Tag" />
      <Token size="md" color="gray" label="Tag" />
      <Token size="lg" color="default" label="Tag" />
      <Token size="lg" color="red" label="Tag" />
      <Token size="lg" color="orange" label="Tag" />
      <Token size="lg" color="yellow" label="Tag" />
      <Token size="lg" color="green" label="Tag" />
      <Token size="lg" color="teal" label="Tag" />
      <Token size="lg" color="cyan" label="Tag" />
      <Token size="lg" color="blue" label="Tag" />
      <Token size="lg" color="purple" label="Tag" />
      <Token size="lg" color="pink" label="Tag" />
      <Token size="lg" color="gray" label="Tag" />
    </div>
  ),
};
