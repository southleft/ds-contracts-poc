/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (polaris.progress-bar v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/ProgressBar/ProgressBar.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    progress: { control: { type: 'number' }, description: 'The progression of certain tasks' },
    size: { control: 'select', options: ['small', 'medium', 'large'], description: 'Size of progressbar' },
    animated: { control: 'boolean', description: 'Whether the fill animation is triggered' },
    ariaLabelledBy: { control: 'text', description: 'Id (ids) of element (elements) that describes progressbar' },
    tone: { control: 'select', options: ['highlight', 'primary', 'success', 'critical'], description: 'Color of progressbar' },
  },
  args: {
    progress: 40,
    size: 'medium',
    animated: false,
    tone: 'highlight',
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: 'small' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Large: Story = {
  args: { size: 'large' },
};
/** Every legal combination the contract defines (size × tone). */
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
        <ProgressBar size="small" tone="highlight" />
        <ProgressBar size="small" tone="primary" />
        <ProgressBar size="small" tone="success" />
        <ProgressBar size="small" tone="critical" />
        <ProgressBar size="medium" tone="highlight" />
        <ProgressBar size="medium" tone="primary" />
        <ProgressBar size="medium" tone="success" />
        <ProgressBar size="medium" tone="critical" />
        <ProgressBar size="large" tone="highlight" />
        <ProgressBar size="large" tone="primary" />
        <ProgressBar size="large" tone="success" />
        <ProgressBar size="large" tone="critical" />
    </div>
  ),
};
