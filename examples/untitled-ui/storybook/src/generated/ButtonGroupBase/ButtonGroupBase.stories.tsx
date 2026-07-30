/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-group-base.contract.json (ds.button-group-base v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ButtonGroupBase } from './ButtonGroupBase';

const meta = {
  title: 'Components/ButtonGroupBase',
  component: ButtonGroupBase,
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
    current: { control: 'boolean' },
    icon: { control: 'select', options: ['false', 'only', 'leading', 'dot'] },
    state: { control: 'select', options: ['default', 'focused', 'disabled', 'hover'] },
  },
  args: {
    current: false,
    icon: 'false',
    state: 'default',
  },
} satisfies Meta<typeof ButtonGroupBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const False: Story = {
  args: { icon: 'false' },
};

export const Only: Story = {
  args: { icon: 'only' },
};

export const Leading: Story = {
  args: { icon: 'leading' },
};

export const Dot: Story = {
  args: { icon: 'dot' },
};
/** Every legal combination the contract defines (icon × state). */
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
      <ButtonGroupBase icon="false" state="default" />
      <ButtonGroupBase icon="false" state="focused" />
      <ButtonGroupBase icon="false" state="disabled" />
      <ButtonGroupBase icon="false" state="hover" />
      <ButtonGroupBase icon="only" state="default" />
      <ButtonGroupBase icon="only" state="focused" />
      <ButtonGroupBase icon="only" state="disabled" />
      <ButtonGroupBase icon="only" state="hover" />
      <ButtonGroupBase icon="leading" state="default" />
      <ButtonGroupBase icon="leading" state="focused" />
      <ButtonGroupBase icon="leading" state="disabled" />
      <ButtonGroupBase icon="leading" state="hover" />
      <ButtonGroupBase icon="dot" state="default" />
      <ButtonGroupBase icon="dot" state="focused" />
      <ButtonGroupBase icon="dot" state="disabled" />
      <ButtonGroupBase icon="dot" state="hover" />
    </div>
  ),
};
