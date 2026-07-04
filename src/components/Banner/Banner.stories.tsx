/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (ds.banner v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Persistent inline notification for page- or section-level feedback. API mirrors industry convention (Astryx Banner): status drives color, icon, and ARIA role; dismissable banners expose a close affordance; endContent carries actions.',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
      description:
        'Feedback tone — drives the color scheme, the leading icon, and the ARIA role (error/warning announce as alerts).',
    },
    container: {
      control: 'select',
      options: ['card', 'section'],
      description: 'card = standalone with radius; section = full-bleed, square.',
    },
    isDismissable: {
      control: 'boolean',
      description: 'Shows the close affordance. Keep error banners until resolved.',
    },
    title: { control: 'text', description: 'Prominent header text.' },
    description: { control: 'text', description: 'Secondary text below the title.' },
    endContent: { control: false },
  },
  args: {
    status: 'info',
    container: 'card',
    isDismissable: false,
    title: 'Banner title',
    description: 'Supporting detail that explains what happened and what to do next.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Info: Story = {
  args: { status: 'info' },
};

export const Success: Story = {
  args: { status: 'success' },
};

export const Warning: Story = {
  args: { status: 'warning' },
};

export const Error: Story = {
  args: { status: 'error' },
};
/** The "endContent" slot accepts: ds.button. */
export const WithEndContent: Story = {
  render: (args) => <Banner {...args} endContent={<Button>Button</Button>} />,
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
      <Banner status="info" container="card" title="Banner title" />
      <Banner status="info" container="section" title="Banner title" />
      <Banner status="success" container="card" title="Banner title" />
      <Banner status="success" container="section" title="Banner title" />
      <Banner status="warning" container="card" title="Banner title" />
      <Banner status="warning" container="section" title="Banner title" />
      <Banner status="error" container="card" title="Banner title" />
      <Banner status="error" container="section" title="Banner title" />
    </div>
  ),
};
