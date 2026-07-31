/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/social-icon.contract.json (ds.social-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SocialIcon } from './SocialIcon';

const meta = {
  title: 'Components/SocialIcon',
  component: SocialIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Social icon" instances of Social button — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    platform: {
      control: 'select',
      options: ['facebook', 'google', 'apple', 'figma', 'dribbble', 'xtwitter'],
    },
    state: { control: 'select', options: ['default'] },
    style: { control: 'select', options: ['white', 'brand'] },
  },
  args: {
    platform: 'facebook',
    state: 'default',
    style: 'white',
  },
} satisfies Meta<typeof SocialIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Facebook: Story = {
  args: { platform: 'facebook' },
};

export const Google: Story = {
  args: { platform: 'google' },
};

export const Apple: Story = {
  args: { platform: 'apple' },
};

export const Figma: Story = {
  args: { platform: 'figma' },
};

export const Dribbble: Story = {
  args: { platform: 'dribbble' },
};

export const Xtwitter: Story = {
  args: { platform: 'xtwitter' },
};
/** Every legal combination the contract defines (platform × state × style). */
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
      <SocialIcon platform="facebook" state="default" style="white" />
      <SocialIcon platform="facebook" state="default" style="brand" />
      <SocialIcon platform="google" state="default" style="white" />
      <SocialIcon platform="google" state="default" style="brand" />
      <SocialIcon platform="apple" state="default" style="white" />
      <SocialIcon platform="apple" state="default" style="brand" />
      <SocialIcon platform="figma" state="default" style="white" />
      <SocialIcon platform="figma" state="default" style="brand" />
      <SocialIcon platform="dribbble" state="default" style="white" />
      <SocialIcon platform="dribbble" state="default" style="brand" />
      <SocialIcon platform="xtwitter" state="default" style="white" />
      <SocialIcon platform="xtwitter" state="default" style="brand" />
    </div>
  ),
};
