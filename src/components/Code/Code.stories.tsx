/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/code.contract.json (ds.code v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Code } from './Code';

const meta = {
  title: 'Components/Code',
  component: Code,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline code element with monospace font and muted background. API mirrors industry convention (Astryx Code); block code is a separate component family.',
      },
    },
  },
  argTypes: {
    children: { control: 'text', description: 'The code content.' },
  },
  args: {
    children: 'npm run build',
  },
} satisfies Meta<typeof Code>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
