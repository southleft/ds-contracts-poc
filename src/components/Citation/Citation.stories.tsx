/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/citation.contract.json (ds.citation v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Citation } from './Citation';

const meta = {
  title: 'Components/Citation',
  component: Citation,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline reference to an external source — attribution in AI-generated responses, articles, anywhere provenance matters. API mirrors industry convention (Astryx Citation): label chips or compact numbered badges.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['label', 'number'],
      description:
        "Label chip with the source title, or a compact numbered badge. Don't mix both in one paragraph.",
    },
    sourceTitle: { control: 'text', description: "The source's display title (label variant)." },
    number: { control: 'text', description: 'Display index (number variant).' },
    href: { control: 'text', description: 'Source URL.' },
  },
  args: {
    variant: 'label',
    sourceTitle: 'example.com',
    number: '1',
    href: 'https://example.com',
  },
} satisfies Meta<typeof Citation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Label: Story = {
  args: { variant: 'label' },
};

export const Number: Story = {
  args: { variant: 'number' },
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
      <Citation variant="label" sourceTitle="example.com" />
      <Citation variant="number" sourceTitle="example.com" />
    </div>
  ),
};
