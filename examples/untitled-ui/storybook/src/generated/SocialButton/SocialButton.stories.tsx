/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/social-button.contract.json (ds.social-button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { SocialButton } from './SocialButton';

const meta = {
  title: 'Components/SocialButton',
  component: SocialButton,
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
    social: {
      control: 'select',
      options: ['facebook', 'google', 'apple', 'figma', 'dribbble', 'x'],
    },
    supportingText: { control: 'boolean' },
    theme: { control: 'select', options: ['brand', 'colorWithBrand', 'color'] },
    state: { control: 'select', options: ['default', 'hover', 'focused'] },
  },
  args: {
    social: 'facebook',
    supportingText: true,
    theme: 'brand',
    state: 'default',
  },
} satisfies Meta<typeof SocialButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Facebook: Story = {
  args: { social: 'facebook' },
};

export const Google: Story = {
  args: { social: 'google' },
};

export const Apple: Story = {
  args: { social: 'apple' },
};

export const Figma: Story = {
  args: { social: 'figma' },
};

export const Dribbble: Story = {
  args: { social: 'dribbble' },
};

export const X: Story = {
  args: { social: 'x' },
};
/** Every legal combination the contract defines (social × theme × state). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(9, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <SocialButton social="facebook" theme="brand" state="default" />
      <SocialButton social="facebook" theme="brand" state="hover" />
      <SocialButton social="facebook" theme="brand" state="focused" />
      <SocialButton social="facebook" theme="colorWithBrand" state="default" />
      <SocialButton social="facebook" theme="colorWithBrand" state="hover" />
      <SocialButton social="facebook" theme="colorWithBrand" state="focused" />
      <SocialButton social="facebook" theme="color" state="default" />
      <SocialButton social="facebook" theme="color" state="hover" />
      <SocialButton social="facebook" theme="color" state="focused" />
      <SocialButton social="google" theme="brand" state="default" />
      <SocialButton social="google" theme="brand" state="hover" />
      <SocialButton social="google" theme="brand" state="focused" />
      <SocialButton social="google" theme="colorWithBrand" state="default" />
      <SocialButton social="google" theme="colorWithBrand" state="hover" />
      <SocialButton social="google" theme="colorWithBrand" state="focused" />
      <SocialButton social="google" theme="color" state="default" />
      <SocialButton social="google" theme="color" state="hover" />
      <SocialButton social="google" theme="color" state="focused" />
      <SocialButton social="apple" theme="brand" state="default" />
      <SocialButton social="apple" theme="brand" state="hover" />
      <SocialButton social="apple" theme="brand" state="focused" />
      <SocialButton social="apple" theme="colorWithBrand" state="default" />
      <SocialButton social="apple" theme="colorWithBrand" state="hover" />
      <SocialButton social="apple" theme="colorWithBrand" state="focused" />
      <SocialButton social="apple" theme="color" state="default" />
      <SocialButton social="apple" theme="color" state="hover" />
      <SocialButton social="apple" theme="color" state="focused" />
      <SocialButton social="figma" theme="brand" state="default" />
      <SocialButton social="figma" theme="brand" state="hover" />
      <SocialButton social="figma" theme="brand" state="focused" />
      <SocialButton social="figma" theme="colorWithBrand" state="default" />
      <SocialButton social="figma" theme="colorWithBrand" state="hover" />
      <SocialButton social="figma" theme="colorWithBrand" state="focused" />
      <SocialButton social="figma" theme="color" state="default" />
      <SocialButton social="figma" theme="color" state="hover" />
      <SocialButton social="figma" theme="color" state="focused" />
      <SocialButton social="dribbble" theme="brand" state="default" />
      <SocialButton social="dribbble" theme="brand" state="hover" />
      <SocialButton social="dribbble" theme="brand" state="focused" />
      <SocialButton social="dribbble" theme="colorWithBrand" state="default" />
      <SocialButton social="dribbble" theme="colorWithBrand" state="hover" />
      <SocialButton social="dribbble" theme="colorWithBrand" state="focused" />
      <SocialButton social="dribbble" theme="color" state="default" />
      <SocialButton social="dribbble" theme="color" state="hover" />
      <SocialButton social="dribbble" theme="color" state="focused" />
      <SocialButton social="x" theme="brand" state="default" />
      <SocialButton social="x" theme="brand" state="hover" />
      <SocialButton social="x" theme="brand" state="focused" />
      <SocialButton social="x" theme="colorWithBrand" state="default" />
      <SocialButton social="x" theme="colorWithBrand" state="hover" />
      <SocialButton social="x" theme="colorWithBrand" state="focused" />
      <SocialButton social="x" theme="color" state="default" />
      <SocialButton social="x" theme="color" state="hover" />
      <SocialButton social="x" theme="color" state="focused" />
    </div>
  ),
};
