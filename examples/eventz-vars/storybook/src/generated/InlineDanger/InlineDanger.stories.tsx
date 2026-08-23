/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline-danger.contract.json (ds.inline-danger v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { InlineDanger } from './InlineDanger';

const meta = {
  title: 'Components/InlineDanger',
  component: InlineDanger,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested ".Inline danger" instances of Atoms/Input — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    supportingText: { control: 'text' },
  },
  args: {
    supportingText: 'Danger text',
  },
} satisfies Meta<typeof InlineDanger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
