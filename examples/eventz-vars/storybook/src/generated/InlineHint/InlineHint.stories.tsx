/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline-hint.contract.json (ds.inline-hint v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { InlineHint } from './InlineHint';

const meta = {
  title: 'Components/InlineHint',
  component: InlineHint,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested ".Inline hint" instances of Atoms/Checkbox — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    supportingText: { control: 'text' },
  },
  args: {
    supportingText: 'Hint text',
  },
} satisfies Meta<typeof InlineHint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
