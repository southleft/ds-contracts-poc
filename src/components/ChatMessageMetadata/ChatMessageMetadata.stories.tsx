/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-message-metadata.contract.json (ds.chat-message-metadata v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatMessageMetadata } from './ChatMessageMetadata';

const meta = {
  title: 'Components/ChatMessageMetadata',
  component: ChatMessageMetadata,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Metadata row for a chat message: delivery status, timestamp, and footer content. API mirrors industry convention (Astryx ChatMessageMetadata): status drives the icon.',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['sending', 'sent', 'delivered', 'read', 'error'],
      description: 'Delivery status — drives the leading icon.',
    },
    timestamp: { control: 'text', description: 'Display timestamp text.' },
    footer: { control: false },
  },
  args: {
    status: 'sent',
    timestamp: '2:14 PM',
  },
} satisfies Meta<typeof ChatMessageMetadata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sending: Story = {
  args: { status: 'sending' },
};

export const Sent: Story = {
  args: { status: 'sent' },
};

export const Delivered: Story = {
  args: { status: 'delivered' },
};

export const Read: Story = {
  args: { status: 'read' },
};

export const Error: Story = {
  args: { status: 'error' },
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
      <ChatMessageMetadata status="sending" />
      <ChatMessageMetadata status="sent" />
      <ChatMessageMetadata status="delivered" />
      <ChatMessageMetadata status="read" />
      <ChatMessageMetadata status="error" />
    </div>
  ),
};
