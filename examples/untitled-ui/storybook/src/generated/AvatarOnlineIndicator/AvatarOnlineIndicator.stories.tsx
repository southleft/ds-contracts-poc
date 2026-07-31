/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-online-indicator.contract.json (ds.avatar-online-indicator v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarOnlineIndicator } from './AvatarOnlineIndicator';

const meta = {
  title: 'Components/AvatarOnlineIndicator',
  component: AvatarOnlineIndicator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "_Avatar online indicator" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['xl', '2xl', 'lg', 'md', 'sm', 'xs'] },
    online: { control: 'select', options: ['true'] },
  },
  args: {
    size: 'xl',
    online: 'true',
  },
} satisfies Meta<typeof AvatarOnlineIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Xl: Story = {
  args: { size: 'xl' },
};

export const Size2xl: Story = {
  args: { size: '2xl' },
};

export const Lg: Story = {
  args: { size: 'lg' },
};

export const Md: Story = {
  args: { size: 'md' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};

export const Xs: Story = {
  args: { size: 'xs' },
};
/** Every legal combination the contract defines (size × online). */
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
      <AvatarOnlineIndicator size="xl" online="true" />
      <AvatarOnlineIndicator size="2xl" online="true" />
      <AvatarOnlineIndicator size="lg" online="true" />
      <AvatarOnlineIndicator size="md" online="true" />
      <AvatarOnlineIndicator size="sm" online="true" />
      <AvatarOnlineIndicator size="xs" online="true" />
    </div>
  ),
};
