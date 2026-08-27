/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.3.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Banner } from './Banner';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Astryx Banner — a status surface with title, description and optional dismiss. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Banner/Banner.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). status/container/isDismissable are verbatim; title and description are materialized text slots (Astryx types both as ReactNode). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/banner/decisions.md); extension sidecar carries the named overflow.',
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
