/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dot.contract.json (ds.dot v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dot } from './Dot';

const meta = {
  title: 'Components/Dot',
  component: Dot,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "_Dot" instances of _Badge base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm'] },
  },
  args: {
    size: 'sm',
  },
} satisfies Meta<typeof Dot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
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
      <Dot size="sm" />
    </div>
  ),
};
