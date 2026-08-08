/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (polaris.button v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Button/Button.tsx (react-tsx adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    size: { control: 'select', options: ['micro', 'slim', 'medium', 'large'], description: 'Changes the size of the button, giving it more or less padding' },
    textAlign: { control: 'select', options: ['left', 'right', 'center', 'start', 'end'], description: 'Changes the inner text alignment of the button' },
    fullWidth: { control: 'boolean', description: 'Allows the button to grow to the width of its container' },
    removeUnderline: { control: 'boolean', description: 'Removes underline from button text (including on interaction)' },
    dataPrimaryLink: { control: 'boolean', description: 'Indicates whether or not the button is the primary navigation link when rendered inside of an `IndexTable.Row`' },
    tone: { control: 'select', options: ['default', 'critical', 'success'], description: 'Sets the color treatment of the Button. Wave B.4 FC-ENUM-HOLE: `default` is the developed unset tone (Polaris tone?: critical|success) — minted as `{variant}.none` paint paths.' },
    variant: { control: 'select', options: ['plain', 'primary', 'secondary', 'tertiary', 'monochromePlain'], description: 'Changes the visual appearance of the Button.' },
    withIcon: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `icon` ({"$import":"@shopify/polaris-icons#PlusCircleIcon"}); the created subtree is carried as parts gated on this prop.' },
  },
  args: {
    size: 'medium',
    textAlign: 'center',
    fullWidth: false,
    removeUnderline: false,
    dataPrimaryLink: false,
    tone: 'default',
    variant: 'secondary',
    withIcon: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Micro: Story = {
  args: { size: 'micro' },
};

export const Slim: Story = {
  args: { size: 'slim' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Large: Story = {
  args: { size: 'large' },
};
/** Every legal combination the contract defines (size × textAlign × tone × variant). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(75, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
        <Button size="micro" textAlign="left" tone="default" variant="plain" />
        <Button size="micro" textAlign="left" tone="default" variant="primary" />
        <Button size="micro" textAlign="left" tone="default" variant="secondary" />
        <Button size="micro" textAlign="left" tone="default" variant="tertiary" />
        <Button size="micro" textAlign="left" tone="default" variant="monochromePlain" />
        <Button size="micro" textAlign="left" tone="critical" variant="plain" />
        <Button size="micro" textAlign="left" tone="critical" variant="primary" />
        <Button size="micro" textAlign="left" tone="critical" variant="secondary" />
        <Button size="micro" textAlign="left" tone="critical" variant="tertiary" />
        <Button size="micro" textAlign="left" tone="critical" variant="monochromePlain" />
        <Button size="micro" textAlign="left" tone="success" variant="plain" />
        <Button size="micro" textAlign="left" tone="success" variant="primary" />
        <Button size="micro" textAlign="left" tone="success" variant="secondary" />
        <Button size="micro" textAlign="left" tone="success" variant="tertiary" />
        <Button size="micro" textAlign="left" tone="success" variant="monochromePlain" />
        <Button size="micro" textAlign="right" tone="default" variant="plain" />
        <Button size="micro" textAlign="right" tone="default" variant="primary" />
        <Button size="micro" textAlign="right" tone="default" variant="secondary" />
        <Button size="micro" textAlign="right" tone="default" variant="tertiary" />
        <Button size="micro" textAlign="right" tone="default" variant="monochromePlain" />
        <Button size="micro" textAlign="right" tone="critical" variant="plain" />
        <Button size="micro" textAlign="right" tone="critical" variant="primary" />
        <Button size="micro" textAlign="right" tone="critical" variant="secondary" />
        <Button size="micro" textAlign="right" tone="critical" variant="tertiary" />
        <Button size="micro" textAlign="right" tone="critical" variant="monochromePlain" />
        <Button size="micro" textAlign="right" tone="success" variant="plain" />
        <Button size="micro" textAlign="right" tone="success" variant="primary" />
        <Button size="micro" textAlign="right" tone="success" variant="secondary" />
        <Button size="micro" textAlign="right" tone="success" variant="tertiary" />
        <Button size="micro" textAlign="right" tone="success" variant="monochromePlain" />
        <Button size="micro" textAlign="center" tone="default" variant="plain" />
        <Button size="micro" textAlign="center" tone="default" variant="primary" />
        <Button size="micro" textAlign="center" tone="default" variant="secondary" />
        <Button size="micro" textAlign="center" tone="default" variant="tertiary" />
        <Button size="micro" textAlign="center" tone="default" variant="monochromePlain" />
        <Button size="micro" textAlign="center" tone="critical" variant="plain" />
        <Button size="micro" textAlign="center" tone="critical" variant="primary" />
        <Button size="micro" textAlign="center" tone="critical" variant="secondary" />
        <Button size="micro" textAlign="center" tone="critical" variant="tertiary" />
        <Button size="micro" textAlign="center" tone="critical" variant="monochromePlain" />
        <Button size="micro" textAlign="center" tone="success" variant="plain" />
        <Button size="micro" textAlign="center" tone="success" variant="primary" />
        <Button size="micro" textAlign="center" tone="success" variant="secondary" />
        <Button size="micro" textAlign="center" tone="success" variant="tertiary" />
        <Button size="micro" textAlign="center" tone="success" variant="monochromePlain" />
        <Button size="micro" textAlign="start" tone="default" variant="plain" />
        <Button size="micro" textAlign="start" tone="default" variant="primary" />
        <Button size="micro" textAlign="start" tone="default" variant="secondary" />
        <Button size="micro" textAlign="start" tone="default" variant="tertiary" />
        <Button size="micro" textAlign="start" tone="default" variant="monochromePlain" />
        <Button size="micro" textAlign="start" tone="critical" variant="plain" />
        <Button size="micro" textAlign="start" tone="critical" variant="primary" />
        <Button size="micro" textAlign="start" tone="critical" variant="secondary" />
        <Button size="micro" textAlign="start" tone="critical" variant="tertiary" />
        <Button size="micro" textAlign="start" tone="critical" variant="monochromePlain" />
        <Button size="micro" textAlign="start" tone="success" variant="plain" />
        <Button size="micro" textAlign="start" tone="success" variant="primary" />
        <Button size="micro" textAlign="start" tone="success" variant="secondary" />
        <Button size="micro" textAlign="start" tone="success" variant="tertiary" />
        <Button size="micro" textAlign="start" tone="success" variant="monochromePlain" />
        <Button size="micro" textAlign="end" tone="default" variant="plain" />
        <Button size="micro" textAlign="end" tone="default" variant="primary" />
        <Button size="micro" textAlign="end" tone="default" variant="secondary" />
        <Button size="micro" textAlign="end" tone="default" variant="tertiary" />
        <Button size="micro" textAlign="end" tone="default" variant="monochromePlain" />
        <Button size="micro" textAlign="end" tone="critical" variant="plain" />
        <Button size="micro" textAlign="end" tone="critical" variant="primary" />
        <Button size="micro" textAlign="end" tone="critical" variant="secondary" />
        <Button size="micro" textAlign="end" tone="critical" variant="tertiary" />
        <Button size="micro" textAlign="end" tone="critical" variant="monochromePlain" />
        <Button size="micro" textAlign="end" tone="success" variant="plain" />
        <Button size="micro" textAlign="end" tone="success" variant="primary" />
        <Button size="micro" textAlign="end" tone="success" variant="secondary" />
        <Button size="micro" textAlign="end" tone="success" variant="tertiary" />
        <Button size="micro" textAlign="end" tone="success" variant="monochromePlain" />
        <Button size="slim" textAlign="left" tone="default" variant="plain" />
        <Button size="slim" textAlign="left" tone="default" variant="primary" />
        <Button size="slim" textAlign="left" tone="default" variant="secondary" />
        <Button size="slim" textAlign="left" tone="default" variant="tertiary" />
        <Button size="slim" textAlign="left" tone="default" variant="monochromePlain" />
        <Button size="slim" textAlign="left" tone="critical" variant="plain" />
        <Button size="slim" textAlign="left" tone="critical" variant="primary" />
        <Button size="slim" textAlign="left" tone="critical" variant="secondary" />
        <Button size="slim" textAlign="left" tone="critical" variant="tertiary" />
        <Button size="slim" textAlign="left" tone="critical" variant="monochromePlain" />
        <Button size="slim" textAlign="left" tone="success" variant="plain" />
        <Button size="slim" textAlign="left" tone="success" variant="primary" />
        <Button size="slim" textAlign="left" tone="success" variant="secondary" />
        <Button size="slim" textAlign="left" tone="success" variant="tertiary" />
        <Button size="slim" textAlign="left" tone="success" variant="monochromePlain" />
        <Button size="slim" textAlign="right" tone="default" variant="plain" />
        <Button size="slim" textAlign="right" tone="default" variant="primary" />
        <Button size="slim" textAlign="right" tone="default" variant="secondary" />
        <Button size="slim" textAlign="right" tone="default" variant="tertiary" />
        <Button size="slim" textAlign="right" tone="default" variant="monochromePlain" />
        <Button size="slim" textAlign="right" tone="critical" variant="plain" />
        <Button size="slim" textAlign="right" tone="critical" variant="primary" />
        <Button size="slim" textAlign="right" tone="critical" variant="secondary" />
        <Button size="slim" textAlign="right" tone="critical" variant="tertiary" />
        <Button size="slim" textAlign="right" tone="critical" variant="monochromePlain" />
        <Button size="slim" textAlign="right" tone="success" variant="plain" />
        <Button size="slim" textAlign="right" tone="success" variant="primary" />
        <Button size="slim" textAlign="right" tone="success" variant="secondary" />
        <Button size="slim" textAlign="right" tone="success" variant="tertiary" />
        <Button size="slim" textAlign="right" tone="success" variant="monochromePlain" />
        <Button size="slim" textAlign="center" tone="default" variant="plain" />
        <Button size="slim" textAlign="center" tone="default" variant="primary" />
        <Button size="slim" textAlign="center" tone="default" variant="secondary" />
        <Button size="slim" textAlign="center" tone="default" variant="tertiary" />
        <Button size="slim" textAlign="center" tone="default" variant="monochromePlain" />
        <Button size="slim" textAlign="center" tone="critical" variant="plain" />
        <Button size="slim" textAlign="center" tone="critical" variant="primary" />
        <Button size="slim" textAlign="center" tone="critical" variant="secondary" />
        <Button size="slim" textAlign="center" tone="critical" variant="tertiary" />
        <Button size="slim" textAlign="center" tone="critical" variant="monochromePlain" />
        <Button size="slim" textAlign="center" tone="success" variant="plain" />
        <Button size="slim" textAlign="center" tone="success" variant="primary" />
        <Button size="slim" textAlign="center" tone="success" variant="secondary" />
        <Button size="slim" textAlign="center" tone="success" variant="tertiary" />
        <Button size="slim" textAlign="center" tone="success" variant="monochromePlain" />
        <Button size="slim" textAlign="start" tone="default" variant="plain" />
        <Button size="slim" textAlign="start" tone="default" variant="primary" />
        <Button size="slim" textAlign="start" tone="default" variant="secondary" />
        <Button size="slim" textAlign="start" tone="default" variant="tertiary" />
        <Button size="slim" textAlign="start" tone="default" variant="monochromePlain" />
        <Button size="slim" textAlign="start" tone="critical" variant="plain" />
        <Button size="slim" textAlign="start" tone="critical" variant="primary" />
        <Button size="slim" textAlign="start" tone="critical" variant="secondary" />
        <Button size="slim" textAlign="start" tone="critical" variant="tertiary" />
        <Button size="slim" textAlign="start" tone="critical" variant="monochromePlain" />
        <Button size="slim" textAlign="start" tone="success" variant="plain" />
        <Button size="slim" textAlign="start" tone="success" variant="primary" />
        <Button size="slim" textAlign="start" tone="success" variant="secondary" />
        <Button size="slim" textAlign="start" tone="success" variant="tertiary" />
        <Button size="slim" textAlign="start" tone="success" variant="monochromePlain" />
        <Button size="slim" textAlign="end" tone="default" variant="plain" />
        <Button size="slim" textAlign="end" tone="default" variant="primary" />
        <Button size="slim" textAlign="end" tone="default" variant="secondary" />
        <Button size="slim" textAlign="end" tone="default" variant="tertiary" />
        <Button size="slim" textAlign="end" tone="default" variant="monochromePlain" />
        <Button size="slim" textAlign="end" tone="critical" variant="plain" />
        <Button size="slim" textAlign="end" tone="critical" variant="primary" />
        <Button size="slim" textAlign="end" tone="critical" variant="secondary" />
        <Button size="slim" textAlign="end" tone="critical" variant="tertiary" />
        <Button size="slim" textAlign="end" tone="critical" variant="monochromePlain" />
        <Button size="slim" textAlign="end" tone="success" variant="plain" />
        <Button size="slim" textAlign="end" tone="success" variant="primary" />
        <Button size="slim" textAlign="end" tone="success" variant="secondary" />
        <Button size="slim" textAlign="end" tone="success" variant="tertiary" />
        <Button size="slim" textAlign="end" tone="success" variant="monochromePlain" />
        <Button size="medium" textAlign="left" tone="default" variant="plain" />
        <Button size="medium" textAlign="left" tone="default" variant="primary" />
        <Button size="medium" textAlign="left" tone="default" variant="secondary" />
        <Button size="medium" textAlign="left" tone="default" variant="tertiary" />
        <Button size="medium" textAlign="left" tone="default" variant="monochromePlain" />
        <Button size="medium" textAlign="left" tone="critical" variant="plain" />
        <Button size="medium" textAlign="left" tone="critical" variant="primary" />
        <Button size="medium" textAlign="left" tone="critical" variant="secondary" />
        <Button size="medium" textAlign="left" tone="critical" variant="tertiary" />
        <Button size="medium" textAlign="left" tone="critical" variant="monochromePlain" />
        <Button size="medium" textAlign="left" tone="success" variant="plain" />
        <Button size="medium" textAlign="left" tone="success" variant="primary" />
        <Button size="medium" textAlign="left" tone="success" variant="secondary" />
        <Button size="medium" textAlign="left" tone="success" variant="tertiary" />
        <Button size="medium" textAlign="left" tone="success" variant="monochromePlain" />
        <Button size="medium" textAlign="right" tone="default" variant="plain" />
        <Button size="medium" textAlign="right" tone="default" variant="primary" />
        <Button size="medium" textAlign="right" tone="default" variant="secondary" />
        <Button size="medium" textAlign="right" tone="default" variant="tertiary" />
        <Button size="medium" textAlign="right" tone="default" variant="monochromePlain" />
        <Button size="medium" textAlign="right" tone="critical" variant="plain" />
        <Button size="medium" textAlign="right" tone="critical" variant="primary" />
        <Button size="medium" textAlign="right" tone="critical" variant="secondary" />
        <Button size="medium" textAlign="right" tone="critical" variant="tertiary" />
        <Button size="medium" textAlign="right" tone="critical" variant="monochromePlain" />
        <Button size="medium" textAlign="right" tone="success" variant="plain" />
        <Button size="medium" textAlign="right" tone="success" variant="primary" />
        <Button size="medium" textAlign="right" tone="success" variant="secondary" />
        <Button size="medium" textAlign="right" tone="success" variant="tertiary" />
        <Button size="medium" textAlign="right" tone="success" variant="monochromePlain" />
        <Button size="medium" textAlign="center" tone="default" variant="plain" />
        <Button size="medium" textAlign="center" tone="default" variant="primary" />
        <Button size="medium" textAlign="center" tone="default" variant="secondary" />
        <Button size="medium" textAlign="center" tone="default" variant="tertiary" />
        <Button size="medium" textAlign="center" tone="default" variant="monochromePlain" />
        <Button size="medium" textAlign="center" tone="critical" variant="plain" />
        <Button size="medium" textAlign="center" tone="critical" variant="primary" />
        <Button size="medium" textAlign="center" tone="critical" variant="secondary" />
        <Button size="medium" textAlign="center" tone="critical" variant="tertiary" />
        <Button size="medium" textAlign="center" tone="critical" variant="monochromePlain" />
        <Button size="medium" textAlign="center" tone="success" variant="plain" />
        <Button size="medium" textAlign="center" tone="success" variant="primary" />
        <Button size="medium" textAlign="center" tone="success" variant="secondary" />
        <Button size="medium" textAlign="center" tone="success" variant="tertiary" />
        <Button size="medium" textAlign="center" tone="success" variant="monochromePlain" />
        <Button size="medium" textAlign="start" tone="default" variant="plain" />
        <Button size="medium" textAlign="start" tone="default" variant="primary" />
        <Button size="medium" textAlign="start" tone="default" variant="secondary" />
        <Button size="medium" textAlign="start" tone="default" variant="tertiary" />
        <Button size="medium" textAlign="start" tone="default" variant="monochromePlain" />
        <Button size="medium" textAlign="start" tone="critical" variant="plain" />
        <Button size="medium" textAlign="start" tone="critical" variant="primary" />
        <Button size="medium" textAlign="start" tone="critical" variant="secondary" />
        <Button size="medium" textAlign="start" tone="critical" variant="tertiary" />
        <Button size="medium" textAlign="start" tone="critical" variant="monochromePlain" />
        <Button size="medium" textAlign="start" tone="success" variant="plain" />
        <Button size="medium" textAlign="start" tone="success" variant="primary" />
        <Button size="medium" textAlign="start" tone="success" variant="secondary" />
        <Button size="medium" textAlign="start" tone="success" variant="tertiary" />
        <Button size="medium" textAlign="start" tone="success" variant="monochromePlain" />
        <Button size="medium" textAlign="end" tone="default" variant="plain" />
        <Button size="medium" textAlign="end" tone="default" variant="primary" />
        <Button size="medium" textAlign="end" tone="default" variant="secondary" />
        <Button size="medium" textAlign="end" tone="default" variant="tertiary" />
        <Button size="medium" textAlign="end" tone="default" variant="monochromePlain" />
        <Button size="medium" textAlign="end" tone="critical" variant="plain" />
        <Button size="medium" textAlign="end" tone="critical" variant="primary" />
        <Button size="medium" textAlign="end" tone="critical" variant="secondary" />
        <Button size="medium" textAlign="end" tone="critical" variant="tertiary" />
        <Button size="medium" textAlign="end" tone="critical" variant="monochromePlain" />
        <Button size="medium" textAlign="end" tone="success" variant="plain" />
        <Button size="medium" textAlign="end" tone="success" variant="primary" />
        <Button size="medium" textAlign="end" tone="success" variant="secondary" />
        <Button size="medium" textAlign="end" tone="success" variant="tertiary" />
        <Button size="medium" textAlign="end" tone="success" variant="monochromePlain" />
        <Button size="large" textAlign="left" tone="default" variant="plain" />
        <Button size="large" textAlign="left" tone="default" variant="primary" />
        <Button size="large" textAlign="left" tone="default" variant="secondary" />
        <Button size="large" textAlign="left" tone="default" variant="tertiary" />
        <Button size="large" textAlign="left" tone="default" variant="monochromePlain" />
        <Button size="large" textAlign="left" tone="critical" variant="plain" />
        <Button size="large" textAlign="left" tone="critical" variant="primary" />
        <Button size="large" textAlign="left" tone="critical" variant="secondary" />
        <Button size="large" textAlign="left" tone="critical" variant="tertiary" />
        <Button size="large" textAlign="left" tone="critical" variant="monochromePlain" />
        <Button size="large" textAlign="left" tone="success" variant="plain" />
        <Button size="large" textAlign="left" tone="success" variant="primary" />
        <Button size="large" textAlign="left" tone="success" variant="secondary" />
        <Button size="large" textAlign="left" tone="success" variant="tertiary" />
        <Button size="large" textAlign="left" tone="success" variant="monochromePlain" />
        <Button size="large" textAlign="right" tone="default" variant="plain" />
        <Button size="large" textAlign="right" tone="default" variant="primary" />
        <Button size="large" textAlign="right" tone="default" variant="secondary" />
        <Button size="large" textAlign="right" tone="default" variant="tertiary" />
        <Button size="large" textAlign="right" tone="default" variant="monochromePlain" />
        <Button size="large" textAlign="right" tone="critical" variant="plain" />
        <Button size="large" textAlign="right" tone="critical" variant="primary" />
        <Button size="large" textAlign="right" tone="critical" variant="secondary" />
        <Button size="large" textAlign="right" tone="critical" variant="tertiary" />
        <Button size="large" textAlign="right" tone="critical" variant="monochromePlain" />
        <Button size="large" textAlign="right" tone="success" variant="plain" />
        <Button size="large" textAlign="right" tone="success" variant="primary" />
        <Button size="large" textAlign="right" tone="success" variant="secondary" />
        <Button size="large" textAlign="right" tone="success" variant="tertiary" />
        <Button size="large" textAlign="right" tone="success" variant="monochromePlain" />
        <Button size="large" textAlign="center" tone="default" variant="plain" />
        <Button size="large" textAlign="center" tone="default" variant="primary" />
        <Button size="large" textAlign="center" tone="default" variant="secondary" />
        <Button size="large" textAlign="center" tone="default" variant="tertiary" />
        <Button size="large" textAlign="center" tone="default" variant="monochromePlain" />
        <Button size="large" textAlign="center" tone="critical" variant="plain" />
        <Button size="large" textAlign="center" tone="critical" variant="primary" />
        <Button size="large" textAlign="center" tone="critical" variant="secondary" />
        <Button size="large" textAlign="center" tone="critical" variant="tertiary" />
        <Button size="large" textAlign="center" tone="critical" variant="monochromePlain" />
        <Button size="large" textAlign="center" tone="success" variant="plain" />
        <Button size="large" textAlign="center" tone="success" variant="primary" />
        <Button size="large" textAlign="center" tone="success" variant="secondary" />
        <Button size="large" textAlign="center" tone="success" variant="tertiary" />
        <Button size="large" textAlign="center" tone="success" variant="monochromePlain" />
        <Button size="large" textAlign="start" tone="default" variant="plain" />
        <Button size="large" textAlign="start" tone="default" variant="primary" />
        <Button size="large" textAlign="start" tone="default" variant="secondary" />
        <Button size="large" textAlign="start" tone="default" variant="tertiary" />
        <Button size="large" textAlign="start" tone="default" variant="monochromePlain" />
        <Button size="large" textAlign="start" tone="critical" variant="plain" />
        <Button size="large" textAlign="start" tone="critical" variant="primary" />
        <Button size="large" textAlign="start" tone="critical" variant="secondary" />
        <Button size="large" textAlign="start" tone="critical" variant="tertiary" />
        <Button size="large" textAlign="start" tone="critical" variant="monochromePlain" />
        <Button size="large" textAlign="start" tone="success" variant="plain" />
        <Button size="large" textAlign="start" tone="success" variant="primary" />
        <Button size="large" textAlign="start" tone="success" variant="secondary" />
        <Button size="large" textAlign="start" tone="success" variant="tertiary" />
        <Button size="large" textAlign="start" tone="success" variant="monochromePlain" />
        <Button size="large" textAlign="end" tone="default" variant="plain" />
        <Button size="large" textAlign="end" tone="default" variant="primary" />
        <Button size="large" textAlign="end" tone="default" variant="secondary" />
        <Button size="large" textAlign="end" tone="default" variant="tertiary" />
        <Button size="large" textAlign="end" tone="default" variant="monochromePlain" />
        <Button size="large" textAlign="end" tone="critical" variant="plain" />
        <Button size="large" textAlign="end" tone="critical" variant="primary" />
        <Button size="large" textAlign="end" tone="critical" variant="secondary" />
        <Button size="large" textAlign="end" tone="critical" variant="tertiary" />
        <Button size="large" textAlign="end" tone="critical" variant="monochromePlain" />
        <Button size="large" textAlign="end" tone="success" variant="plain" />
        <Button size="large" textAlign="end" tone="success" variant="primary" />
        <Button size="large" textAlign="end" tone="success" variant="secondary" />
        <Button size="large" textAlign="end" tone="success" variant="tertiary" />
        <Button size="large" textAlign="end" tone="success" variant="monochromePlain" />
    </div>
  ),
};
