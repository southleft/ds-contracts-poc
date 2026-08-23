/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-icon-button.contract.json (ds.atoms-icon-button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { IconsPlaceholder } from '../IconsPlaceholder';
import { AtomsIconButton } from './AtomsIconButton';

const meta = {
  title: 'Components/AtomsIconButton',
  component: AtomsIconButton,
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
    <AtomsIconButton {...args}>
      <IconsPlaceholder size="20" />
    </AtomsIconButton>
  ),
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'knockout', 'secondary', 'bare', 'bareKnockout'],
    },
    isDisabled: { control: 'boolean' },
    children: { control: false },
  },
  args: {
    variant: 'primary',
    isDisabled: false,
  },
} satisfies Meta<typeof AtomsIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Knockout: Story = {
  args: { variant: 'knockout' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Bare: Story = {
  args: { variant: 'bare' },
};

export const BareKnockout: Story = {
  args: { variant: 'bareKnockout' },
};
