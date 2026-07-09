/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption." } },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'knockout', 'secondary', 'bare'] },
    state: { control: 'select', options: ['default', 'hover', 'active', 'focus'] },
    isDisabled: { control: 'boolean' },
    text: { control: 'text' },
    hasStartIcon: { control: 'boolean' },
    hasEndIcon: { control: 'boolean' },
    startIcon: { control: false },
    endIcon: { control: false },
  },
  args: {
    variant: 'primary',
    state: 'default',
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
/** Every legal combination the contract defines (variant × state). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(4, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <Button variant="primary" state="default" />
        <Button variant="primary" state="hover" />
        <Button variant="primary" state="active" />
        <Button variant="primary" state="focus" />
        <Button variant="knockout" state="default" />
        <Button variant="knockout" state="hover" />
        <Button variant="knockout" state="active" />
        <Button variant="knockout" state="focus" />
        <Button variant="secondary" state="default" />
        <Button variant="secondary" state="hover" />
        <Button variant="secondary" state="active" />
        <Button variant="secondary" state="focus" />
        <Button variant="bare" state="default" />
        <Button variant="bare" state="hover" />
        <Button variant="bare" state="active" />
        <Button variant="bare" state="focus" />
    </div>
  ),
};
