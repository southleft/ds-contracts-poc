/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-group.contract.json (ds.avatar-group v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { AvatarGroup } from './AvatarGroup';

const meta = {
  title: 'Components/AvatarGroup',
  component: AvatarGroup,
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
    size: { control: 'select', options: ['xs', 'sm', 'md'] },
    addUserButton: { control: 'boolean' },
    moreUsers: { control: 'boolean' },
  },
  args: {
    size: 'xs',
    addUserButton: true,
    moreUsers: true,
  },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Xs: Story = {
  args: { size: 'xs' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Md: Story = {
  args: { size: 'md' },
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
      <AvatarGroup size="xs" />
      <AvatarGroup size="sm" />
      <AvatarGroup size="md" />
    </div>
  ),
};
