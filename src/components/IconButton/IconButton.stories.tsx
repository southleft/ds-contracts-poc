/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon-button.contract.json (ds.icon-button v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A button showing only an icon, for toolbars, table rows, and compact UI. API mirrors industry convention (Astryx IconButton): the required label is the accessible name and is never rendered visibly.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
      description:
        'Visual style. Ghost sits on the surface wash (transparent tokens are a documented gap).',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Square control size.' },
    isDisabled: { control: 'boolean', description: 'Disables the button.' },
    label: {
      control: 'text',
      description:
        'Accessible name (aria-label). Be specific: "Delete conversation", not "Delete".',
    },
    icon: { control: false },
  },
  args: {
    variant: 'secondary',
    size: 'md',
    isDisabled: false,
    label: 'Action',
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
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
      <IconButton variant="primary" size="sm" label="Action" />
      <IconButton variant="primary" size="md" label="Action" />
      <IconButton variant="primary" size="lg" label="Action" />
      <IconButton variant="secondary" size="sm" label="Action" />
      <IconButton variant="secondary" size="md" label="Action" />
      <IconButton variant="secondary" size="lg" label="Action" />
      <IconButton variant="ghost" size="sm" label="Action" />
      <IconButton variant="ghost" size="md" label="Action" />
      <IconButton variant="ghost" size="lg" label="Action" />
      <IconButton variant="destructive" size="sm" label="Action" />
      <IconButton variant="destructive" size="md" label="Action" />
      <IconButton variant="destructive" size="lg" label="Action" />
    </div>
  ),
};
