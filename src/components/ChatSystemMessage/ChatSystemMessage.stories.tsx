/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-system-message.contract.json (ds.chat-system-message v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatSystemMessage } from './ChatSystemMessage';

const meta = {
  title: 'Components/ChatSystemMessage',
  component: ChatSystemMessage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Centered system message for non-sender chat content — date separators, membership changes, status notices. API mirrors industry convention (Astryx ChatSystemMessage): the divider variant adds a line on each side.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'divider'],
      description: 'Plain centered text, or text between divider lines.',
    },
    message: {
      control: 'text',
      description: 'Short factual string — a date, a join notice, a status change.',
    },
    icon: { control: false },
  },
  args: {
    variant: 'default',
    message: 'Today',
  },
} satisfies Meta<typeof ChatSystemMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { variant: 'default' },
};

export const Divider: Story = {
  args: { variant: 'divider' },
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
      <ChatSystemMessage variant="default" message="Today" />
      <ChatSystemMessage variant="divider" message="Today" />
    </div>
  ),
};
