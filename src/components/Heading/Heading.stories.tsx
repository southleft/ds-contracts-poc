/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/heading.contract.json (ds.heading v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading } from './Heading';

const meta = {
  title: 'Components/Heading',
  component: Heading,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sectioning heading whose rendered HTML element follows the level prop (h1–h6) via semantics.elementByProp, with a token-governed size ramp. The canvas renders the same ramp as a Level variant set — text nodes carry no element semantics, so only code renders the element itself.',
      },
    },
  },
  argTypes: {
    level: {
      control: 'select',
      options: ['1', '2', '3', '4', '5', '6'],
      description:
        'Document outline level — drives the rendered element (h1–h6) and the size ramp.',
    },
    children: { control: 'text', description: 'Heading text.' },
  },
  args: {
    level: '2',
    children: 'Heading',
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Level1: Story = {
  args: { level: '1' },
};

export const Level2: Story = {
  args: { level: '2' },
};

export const Level3: Story = {
  args: { level: '3' },
};

export const Level4: Story = {
  args: { level: '4' },
};

export const Level5: Story = {
  args: { level: '5' },
};

export const Level6: Story = {
  args: { level: '6' },
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
      <Heading level="1">Heading</Heading>
      <Heading level="2">Heading</Heading>
      <Heading level="3">Heading</Heading>
      <Heading level="4">Heading</Heading>
      <Heading level="5">Heading</Heading>
      <Heading level="6">Heading</Heading>
    </div>
  ),
};
