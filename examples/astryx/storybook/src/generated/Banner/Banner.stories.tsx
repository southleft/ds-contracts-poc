/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.2.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Banner — promoted from @astryxdesign/core@0.1.6 (src/Banner/Banner.tsx). Two-part structure: a status header (muted background, status icon, semibold title, supporting description) and an optional collapsible content area (out of scope for the default exhibit). Status backgrounds use accent/warning/error/success *-muted tokens; icons use the vendor defaultIconNames mapping at md (20px).',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'warning', 'error', 'success'],
      description: 'Status type controlling the icon and color scheme.',
    },
    container: {
      control: 'select',
      options: ['card', 'section'],
      description: 'How the banner is contained.',
    },
    isDismissable: { control: 'boolean', description: 'Whether the banner can be dismissed.' },
    title: { control: 'text', description: 'Title text displayed prominently in the header area.' },
    description: {
      control: 'text',
      description: 'Optional supporting text below the title in the header area.',
    },
  },
  args: {
    status: 'info',
    container: 'card',
    isDismissable: false,
    title: 'A new software update is available.',
    description: 'See what changed in this version.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Info: Story = {
  args: { status: 'info' },
};

export const Warning: Story = {
  args: { status: 'warning' },
};

export const Error: Story = {
  args: { status: 'error' },
};

export const Success: Story = {
  args: { status: 'success' },
};
/** Every legal combination the contract defines (status × container). */
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
      <Banner status="info" container="card" />
      <Banner status="info" container="section" />
      <Banner status="warning" container="card" />
      <Banner status="warning" container="section" />
      <Banner status="error" container="card" />
      <Banner status="error" container="section" />
      <Banner status="success" container="card" />
      <Banner status="success" container="section" />
    </div>
  ),
};
