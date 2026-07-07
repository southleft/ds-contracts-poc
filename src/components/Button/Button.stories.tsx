/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v1.3.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Triggers an action or event. Use one primary button per context.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'Visual prominence of the action.',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Control density.' },
    disabled: {
      control: 'boolean',
      description: 'Prevents interaction and communicates unavailability.',
    },
    loading: {
      control: 'boolean',
      description:
        'Shows a spinning busy indicator beside the label while an async action resolves.',
    },
    children: { control: 'text', description: 'Button label.' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    children: 'Button',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
};
export const Disabled: Story = {
  args: { disabled: true },
};
/** Every legal combination the contract defines (variant × size). */
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
      <Button variant="primary" size="sm">
        Button
      </Button>
      <Button variant="primary" size="md">
        Button
      </Button>
      <Button variant="primary" size="lg">
        Button
      </Button>
      <Button variant="secondary" size="sm">
        Button
      </Button>
      <Button variant="secondary" size="md">
        Button
      </Button>
      <Button variant="secondary" size="lg">
        Button
      </Button>
      <Button variant="danger" size="sm">
        Button
      </Button>
      <Button variant="danger" size="md">
        Button
      </Button>
      <Button variant="danger" size="lg">
        Button
      </Button>
    </div>
  ),
};
