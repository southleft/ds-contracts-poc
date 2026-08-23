/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toggle-base.contract.json (ds.toggle-base v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ToggleBase } from './ToggleBase';

const meta = {
  title: 'Components/ToggleBase',
  component: ToggleBase,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    pressed: { control: 'boolean' },
    size: { control: 'select', options: ['md', 'sm'] },
    theme: { control: 'select', options: ['dark', 'light'] },
    disabled: { control: 'boolean' },
  },
  args: {
    pressed: true,
    size: 'md',
    theme: 'dark',
    disabled: false,
  },
} satisfies Meta<typeof ToggleBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Md: Story = {
  args: { size: 'md' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};
export const Disabled: Story = {
  args: { disabled: true },
};
/** Every legal combination the contract defines (size × theme). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <ToggleBase size="md" theme="dark" />
      <ToggleBase size="md" theme="light" />
      <ToggleBase size="sm" theme="dark" />
      <ToggleBase size="sm" theme="light" />
    </div>
  ),
};
