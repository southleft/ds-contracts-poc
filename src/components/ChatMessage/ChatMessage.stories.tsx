/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-message.contract.json (ds.chat-message v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../Avatar';
import { ChatMessageMetadata } from '../ChatMessageMetadata';
import { ChatMessage } from './ChatMessage';

const meta = {
  title: 'Components/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sender-context wrapper for a chat message: avatar, name, bubble content, and metadata. API mirrors industry convention (Astryx ChatMessage); the bubble color follows sender, and sender-based alignment flips via layoutByProp — user messages render right-aligned (row-reverse root, end-aligned body) on both surfaces.',
      },
    },
  },
  argTypes: {
    sender: {
      control: 'select',
      options: ['user', 'assistant', 'system'],
      description: 'Who sent it — drives the bubble color scheme.',
    },
    name: { control: 'text', description: 'Sender name shown above the message body.' },
    avatar: { control: false },
    metadata: { control: false },
    children: { control: 'text' },
  },
  args: {
    sender: 'assistant',
    name: 'Assistant',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const User: Story = {
  args: { sender: 'user' },
};

export const Assistant: Story = {
  args: { sender: 'assistant' },
};

export const System: Story = {
  args: { sender: 'system' },
};
/** The "avatar" slot accepts: ds.avatar. */
export const WithAvatar: Story = {
  render: (args) => <ChatMessage {...args} avatar={<Avatar>AB</Avatar>} />,
};
/** The "metadata" slot accepts: ds.chat-message-metadata. */
export const WithMetadata: Story = {
  render: (args) => <ChatMessage {...args} metadata={<ChatMessageMetadata />} />,
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
      <ChatMessage sender="user">ChatMessage</ChatMessage>
      <ChatMessage sender="assistant">ChatMessage</ChatMessage>
      <ChatMessage sender="system">ChatMessage</ChatMessage>
    </div>
  ),
};
