/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/arrow-arc-left.contract.json (ds.arrow-arc-left v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ArrowArcLeft } from './ArrowArcLeft';

const meta = {
  title: 'Components/ArrowArcLeft',
  component: ArrowArcLeft,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "ArrowArcLeft" instances of Icon — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    format: { control: 'select', options: ['outline'] },
    weight: { control: 'select', options: ['regular'] },
  },
  args: {
    format: 'outline',
    weight: 'regular',
  },
} satisfies Meta<typeof ArrowArcLeft>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Outline: Story = {
  args: { format: 'outline' },
};
/** Every legal combination the contract defines (format × weight). */
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
      <ArrowArcLeft format="outline" weight="regular" />
    </div>
  ),
};
