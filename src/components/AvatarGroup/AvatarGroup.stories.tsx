/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-group.contract.json (ds.avatar-group v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../Avatar';
import { AvatarGroup } from './AvatarGroup';

const meta = {
  title: 'Components/AvatarGroup',
  component: AvatarGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stacked avatars with an overflow count. API mirrors industry convention (Astryx AvatarGroup): overlapping layout — expressed as a negative-margin child rule in CSS and negative item spacing on the canvas.',
      },
    },
  },
  render: (args) => (
    <AvatarGroup {...args}>
      <Avatar size="md">AB</Avatar>
      <Avatar size="md">CD</Avatar>
      <Avatar size="md">EF</Avatar>
    </AvatarGroup>
  ),
  argTypes: {
    overflowLabel: { control: 'text', description: 'The +N overflow indicator text.' },
    children: { control: false },
  },
  args: {
    overflowLabel: '+3',
  },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
