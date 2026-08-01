/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (ds.avatar v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
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
    size: { control: 'select', options: ['xl', '2xl', 'lg', 'md', 'sm', 'xs'] },
    placeholder: { control: 'boolean' },
    text: { control: 'boolean' },
    statusIcon: { control: 'select', options: ['false', 'company', 'onlineIndicator'] },
    state: { control: 'select', options: ['default', 'hover', 'focused'] },
    children: { control: 'text' },
  },
  args: {
    size: 'xl',
    placeholder: false,
    text: true,
    statusIcon: 'false',
    state: 'default',
    children: 'OR',
  },
} satisfies Meta<typeof Avatar>;

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
/** Every legal combination the contract defines (size × statusIcon × state). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(9, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Avatar size="xl" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="xl" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="2xl" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="lg" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="md" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="sm" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="false" state="default">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="false" state="hover">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="false" state="focused">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="company" state="default">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="company" state="hover">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="company" state="focused">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="onlineIndicator" state="default">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="onlineIndicator" state="hover">
        OR
      </Avatar>
      <Avatar size="xs" statusIcon="onlineIndicator" state="focused">
        OR
      </Avatar>
    </div>
  ),
};
