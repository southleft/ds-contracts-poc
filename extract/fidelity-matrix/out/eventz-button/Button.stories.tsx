/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Play } from '../Play';
import { Pause } from '../Pause';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption." } },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'knockout', 'secondary', 'bare'] },
    isDisabled: { control: 'boolean' },
    text: { control: 'text' },
    hasStartIcon: { control: 'boolean' },
    hasEndIcon: { control: 'boolean' },
    startIcon: { control: false },
    endIcon: { control: false },
  },
  args: {
    variant: 'primary',
    isDisabled: false,
    text: 'Label',
    hasStartIcon: true,
    hasEndIcon: true,
  },
} satisfies Meta<typeof Button>;

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
/** The "startIcon" slot accepts: anything. */
export const WithStartIcon: Story = {
  render: (args) => (
    <Button {...args} startIcon={<><Play /></>} />
  ),
};
/** The "endIcon" slot accepts: anything. */
export const WithEndIcon: Story = {
  render: (args) => (
    <Button {...args} endIcon={<><Pause /></>} />
  ),
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
        <Button variant="primary" />
        <Button variant="knockout" />
        <Button variant="secondary" />
        <Button variant="bare" />
    </div>
  ),
};
