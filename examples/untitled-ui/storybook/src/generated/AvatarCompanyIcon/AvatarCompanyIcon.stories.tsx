/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-company-icon.contract.json (ds.avatar-company-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarCompanyIcon } from './AvatarCompanyIcon';

const meta = {
  title: 'Components/AvatarCompanyIcon',
  component: AvatarCompanyIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "_Avatar company icon" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['xl', '2xl', 'lg', 'md', 'sm', 'xs'] },
  },
  args: {
    size: 'xl',
  },
} satisfies Meta<typeof AvatarCompanyIcon>;

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
      <AvatarCompanyIcon size="xl" />
      <AvatarCompanyIcon size="2xl" />
      <AvatarCompanyIcon size="lg" />
      <AvatarCompanyIcon size="md" />
      <AvatarCompanyIcon size="sm" />
      <AvatarCompanyIcon size="xs" />
    </div>
  ),
};
