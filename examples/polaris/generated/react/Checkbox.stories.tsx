/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (polaris.checkbox v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: static backdrop bindings (border-color) removed — the checked axis contests them per value; the floor rebuilds from browser truth. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    checked: { control: 'select', options: ['unchecked', 'checked', 'indeterminate'], description: 'Checked state (round 4: enumerated as a contract enum — the real API is boolean | \'indeterminate\'; the capture maps unchecked→false, checked→true, indeterminate→\'indeterminate\'). The check/indeterminate glyphs and the checked backdrop ride this axis.' },
    ariaControls: { control: 'text', description: 'Indicates the ID of the element that is controlled by the checkbox' },
    ariaDescribedBy: { control: 'text', description: 'Indicates the ID of the element that describes the checkbox' },
    labelHidden: { control: 'boolean', description: 'Visually hide the label' },
    disabled: { control: 'boolean', description: 'Disable input' },
    name: { control: 'text', description: 'Name for form input' },
    value: { control: 'text', description: 'Value for form input' },
    labelClassName: { control: 'text', description: 'Added to the wrapping label' },
  },
  args: {
    checked: 'unchecked',
    labelHidden: false,
    disabled: false,
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Unchecked: Story = {
  args: { checked: 'unchecked' },
};

export const Checked: Story = {
  args: { checked: 'checked' },
};

export const Indeterminate: Story = {
  args: { checked: 'indeterminate' },
};
export const Disabled: Story = {
  args: { disabled: true },
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
        <Checkbox checked="unchecked" />
        <Checkbox checked="checked" />
        <Checkbox checked="indeterminate" />
    </div>
  ),
};
