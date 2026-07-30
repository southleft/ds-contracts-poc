/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-label-group.contract.json (ds.avatar-label-group v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarLabelGroup } from './AvatarLabelGroup';

const meta = {
  title: 'Components/AvatarLabelGroup',
  component: AvatarLabelGroup,
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
    size: { control: 'select', options: ['md', 'lg', 'xl', 'sm'] },
    statusIcon: { control: 'select', options: ['onlineIndicator', 'company', 'false'] },
  },
  args: {
    size: 'md',
    statusIcon: 'onlineIndicator',
  },
} satisfies Meta<typeof AvatarLabelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
};

export const Xl: Story = {
  args: { size: 'xl' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};
/** Every legal combination the contract defines (size × statusIcon). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(3, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <AvatarLabelGroup size="md" statusIcon="onlineIndicator" />
      <AvatarLabelGroup size="md" statusIcon="company" />
      <AvatarLabelGroup size="md" statusIcon="false" />
      <AvatarLabelGroup size="lg" statusIcon="onlineIndicator" />
      <AvatarLabelGroup size="lg" statusIcon="company" />
      <AvatarLabelGroup size="lg" statusIcon="false" />
      <AvatarLabelGroup size="xl" statusIcon="onlineIndicator" />
      <AvatarLabelGroup size="xl" statusIcon="company" />
      <AvatarLabelGroup size="xl" statusIcon="false" />
      <AvatarLabelGroup size="sm" statusIcon="onlineIndicator" />
      <AvatarLabelGroup size="sm" statusIcon="company" />
      <AvatarLabelGroup size="sm" statusIcon="false" />
    </div>
  ),
};
