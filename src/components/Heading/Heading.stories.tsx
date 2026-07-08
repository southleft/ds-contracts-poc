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
          'Sectioning heading whose rendered HTML element follows the level prop (h1–h6) via semantics.elementByProp, with a visual size ramp on the existing control type scale — document outline and visual weight are deliberately independent axes. Text nodes carry no element semantics, so only code renders the element itself.',
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
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description:
        'Visual size on the control type scale — independent of the document outline level.',
    },
    children: { control: 'text', description: 'Heading text.' },
  },
  args: {
    level: '2',
    size: 'lg',
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
/** Every legal combination the contract defines (level × size). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(3, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Heading level="1" size="sm">
        Heading
      </Heading>
      <Heading level="1" size="md">
        Heading
      </Heading>
      <Heading level="1" size="lg">
        Heading
      </Heading>
      <Heading level="2" size="sm">
        Heading
      </Heading>
      <Heading level="2" size="md">
        Heading
      </Heading>
      <Heading level="2" size="lg">
        Heading
      </Heading>
      <Heading level="3" size="sm">
        Heading
      </Heading>
      <Heading level="3" size="md">
        Heading
      </Heading>
      <Heading level="3" size="lg">
        Heading
      </Heading>
      <Heading level="4" size="sm">
        Heading
      </Heading>
      <Heading level="4" size="md">
        Heading
      </Heading>
      <Heading level="4" size="lg">
        Heading
      </Heading>
      <Heading level="5" size="sm">
        Heading
      </Heading>
      <Heading level="5" size="md">
        Heading
      </Heading>
      <Heading level="5" size="lg">
        Heading
      </Heading>
      <Heading level="6" size="sm">
        Heading
      </Heading>
      <Heading level="6" size="md">
        Heading
      </Heading>
      <Heading level="6" size="lg">
        Heading
      </Heading>
    </div>
  ),
};
