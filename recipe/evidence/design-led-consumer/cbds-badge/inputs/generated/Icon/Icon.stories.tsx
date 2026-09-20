/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon.contract.json (ds.icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Placeholder } from '../Placeholder';
import { Icon } from './Icon';

const meta = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  render: (args) => (
    <Icon {...args}>
      <Placeholder />
    </Icon>
  ),
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large', 'xlarge', '2xlarge', 'xsmall'],
    },
    children: { control: false },
  },
  args: {
    size: 'small',
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: 'small' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Large: Story = {
  args: { size: 'large' },
};

export const Xlarge: Story = {
  args: { size: 'xlarge' },
};

export const Size2xlarge: Story = {
  args: { size: '2xlarge' },
};

export const Xsmall: Story = {
  args: { size: 'xsmall' },
};
