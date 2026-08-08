/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-tag.contract.json (ds.atoms-tag v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtomsTag } from './AtomsTag';

const meta = {
  title: 'Components/AtomsTag',
  component: AtomsTag,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    isInteractive: { control: 'boolean' },
    variant: { control: 'select', options: ['parent', 'child'] },
    isActive: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    isInteractive: true,
    variant: 'parent',
    isActive: true,
    label: 'Label',
  },
} satisfies Meta<typeof AtomsTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Parent: Story = {
  args: { variant: 'parent' },
};

export const Child: Story = {
  args: { variant: 'child' },
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
      <AtomsTag variant="parent" />
      <AtomsTag variant="child" />
    </div>
  ),
};
