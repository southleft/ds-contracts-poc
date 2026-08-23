/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge-base.contract.json (ds.badge-base v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { BadgeBase } from './BadgeBase';

const meta = {
  title: 'Components/BadgeBase',
  component: BadgeBase,
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
    icon: {
      control: 'select',
      options: ['false', 'dot', 'country', 'avatar', 'xClose', 'iconRight', 'iconLeft', 'only'],
    },
  },
  args: {
    icon: 'false',
  },
} satisfies Meta<typeof BadgeBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const False: Story = {
  args: { icon: 'false' },
};

export const Dot: Story = {
  args: { icon: 'dot' },
};

export const Country: Story = {
  args: { icon: 'country' },
};

export const Avatar: Story = {
  args: { icon: 'avatar' },
};

export const XClose: Story = {
  args: { icon: 'xClose' },
};

export const IconRight: Story = {
  args: { icon: 'iconRight' },
};

export const IconLeft: Story = {
  args: { icon: 'iconLeft' },
};

export const Only: Story = {
  args: { icon: 'only' },
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
      <BadgeBase icon="false" />
      <BadgeBase icon="dot" />
      <BadgeBase icon="country" />
      <BadgeBase icon="avatar" />
      <BadgeBase icon="xClose" />
      <BadgeBase icon="iconRight" />
      <BadgeBase icon="iconLeft" />
      <BadgeBase icon="only" />
    </div>
  ),
};
