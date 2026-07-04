/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/blockquote.contract.json (ds.blockquote v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Blockquote } from './Blockquote';

const meta = {
  title: 'Components/Blockquote',
  component: Blockquote,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Styled quotation block with an accent left border for quotes, testimonials, and excerpts. API mirrors industry convention (Astryx Blockquote): content plus an optional cite slot rendered in semantic footer/cite markup.',
      },
    },
  },
  argTypes: {
    cite: { control: false },
    children: { control: 'text' },
  },
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Blockquote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
