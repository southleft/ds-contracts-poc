/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toast.contract.json (ds.toast v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Toast } from './Toast';

const meta = {
  title: 'Components/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Brief non-blocking notification confirming an action. API mirrors industry convention (Astryx Toast): the visual element — positioning, stacking, and auto-dismiss belong to the behavior layer and are a declared boundary.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['info', 'error'],
      description: 'Info confirms; error persists until dismissed (behavior layer).',
    },
    endContent: { control: false },
    children: { control: 'text' },
  },
  args: {
    type: 'info',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Info: Story = {
  args: { type: 'info' },
};

export const Error: Story = {
  args: { type: 'error' },
};
/** The "endContent" slot accepts: ds.button. */
export const WithEndContent: Story = {
  render: (args) => <Toast {...args} endContent={<Button>Button</Button>} />,
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
      <Toast type="info">Toast</Toast>
      <Toast type="error">Toast</Toast>
    </div>
  ),
};
