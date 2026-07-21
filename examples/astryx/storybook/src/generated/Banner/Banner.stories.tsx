/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.1.0)
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
          'Astryx Banner — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Banner/Banner.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). status + container axes and the dismissable/expanded flags are verbatim; the banner message is a materialized text slot (Astryx types it as ReactNode children). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2).',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'warning', 'error', 'success'],
      description: 'The banner tone.',
    },
    container: {
      control: 'select',
      options: ['card', 'section'],
      description: 'How the banner is contained.',
    },
    isDismissable: { control: 'boolean', description: 'Whether the banner can be dismissed.' },
    children: { control: 'text', description: 'Banner message (materialized slot).' },
  },
  args: {
    status: 'info',
    container: 'card',
    isDismissable: false,
    children: 'Banner message',
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
      <Banner status="info" container="card">
        Banner message
      </Banner>
      <Banner status="info" container="section">
        Banner message
      </Banner>
      <Banner status="warning" container="card">
        Banner message
      </Banner>
      <Banner status="warning" container="section">
        Banner message
      </Banner>
      <Banner status="error" container="card">
        Banner message
      </Banner>
      <Banner status="error" container="section">
        Banner message
      </Banner>
      <Banner status="success" container="card">
        Banner message
      </Banner>
      <Banner status="success" container="section">
        Banner message
      </Banner>
    </div>
  ),
};
