/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-passage.contract.json (ds.text-passage v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { TextPassage } from './TextPassage';

const meta = {
  title: 'Components/TextPassage',
  component: TextPassage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Text Passage" instances of Tab Panel — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    state: { control: 'select', options: ['default'] },
    width: { control: 'select', options: ['default'] },
  },
  args: {
    state: 'default',
    width: 'default',
  },
} satisfies Meta<typeof TextPassage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};
/** Every legal combination the contract defines (state × width). */
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
      <TextPassage state="default" width="default" />
    </div>
  ),
};
