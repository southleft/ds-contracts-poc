/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/token.contract.json (ds.token v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { Token } from './Token';

const meta = {
  title: 'Components/Token',
  component: Token,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Small inline element for discrete associated data — tags, categories, active filters. API mirrors industry convention (Astryx Token): 11-color vocabulary with size scale; removal and click behavior are a declared boundary.',
      },
    },
  },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'default',
        'red',
        'orange',
        'yellow',
        'green',
        'teal',
        'cyan',
        'blue',
        'purple',
        'pink',
        'gray',
      ],
      description: 'Color variant.',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Token size.' },
    isDisabled: { control: 'boolean', description: 'Reduces opacity and blocks interactions.' },
    label: { control: 'text', description: 'Text label inside the token.' },
    icon: { control: false },
    endContent: { control: false },
  },
  args: {
    color: 'default',
    size: 'md',
    isDisabled: false,
    label: 'Token',
  },
} satisfies Meta<typeof Token>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { color: 'default' },
};

export const Red: Story = {
  args: { color: 'red' },
};

export const Orange: Story = {
  args: { color: 'orange' },
};

export const Yellow: Story = {
  args: { color: 'yellow' },
};

export const Green: Story = {
  args: { color: 'green' },
};

export const Teal: Story = {
  args: { color: 'teal' },
};

export const Cyan: Story = {
  args: { color: 'cyan' },
};

export const Blue: Story = {
  args: { color: 'blue' },
};

export const Purple: Story = {
  args: { color: 'purple' },
};

export const Pink: Story = {
  args: { color: 'pink' },
};

export const Gray: Story = {
  args: { color: 'gray' },
};
/** The "endContent" slot accepts: ds.badge. */
export const WithEndContent: Story = {
  render: (args) => <Token {...args} endContent={<Badge>Badge</Badge>} />,
};
/** Every legal combination the contract defines (color × size). */
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
      <Token color="default" size="sm" label="Token" />
      <Token color="default" size="md" label="Token" />
      <Token color="default" size="lg" label="Token" />
      <Token color="red" size="sm" label="Token" />
      <Token color="red" size="md" label="Token" />
      <Token color="red" size="lg" label="Token" />
      <Token color="orange" size="sm" label="Token" />
      <Token color="orange" size="md" label="Token" />
      <Token color="orange" size="lg" label="Token" />
      <Token color="yellow" size="sm" label="Token" />
      <Token color="yellow" size="md" label="Token" />
      <Token color="yellow" size="lg" label="Token" />
      <Token color="green" size="sm" label="Token" />
      <Token color="green" size="md" label="Token" />
      <Token color="green" size="lg" label="Token" />
      <Token color="teal" size="sm" label="Token" />
      <Token color="teal" size="md" label="Token" />
      <Token color="teal" size="lg" label="Token" />
      <Token color="cyan" size="sm" label="Token" />
      <Token color="cyan" size="md" label="Token" />
      <Token color="cyan" size="lg" label="Token" />
      <Token color="blue" size="sm" label="Token" />
      <Token color="blue" size="md" label="Token" />
      <Token color="blue" size="lg" label="Token" />
      <Token color="purple" size="sm" label="Token" />
      <Token color="purple" size="md" label="Token" />
      <Token color="purple" size="lg" label="Token" />
      <Token color="pink" size="sm" label="Token" />
      <Token color="pink" size="md" label="Token" />
      <Token color="pink" size="lg" label="Token" />
      <Token color="gray" size="sm" label="Token" />
      <Token color="gray" size="md" label="Token" />
      <Token color="gray" size="lg" label="Token" />
    </div>
  ),
};
