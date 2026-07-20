/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (polaris.button v0.3.2)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Button/Button.tsx (react-tsx adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/button/decisions.md, human-acked; source resolved.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/button.extension.json. Delta ledger: extract/computed/out/button/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md)." } },
  },
  argTypes: {
    size: { control: 'select', options: ['micro', 'slim', 'medium', 'large'], description: 'Changes the size of the button, giving it more or less padding' },
    textAlign: { control: 'select', options: ['left', 'right', 'center', 'start', 'end'], description: 'Changes the inner text alignment of the button' },
    fullWidth: { control: 'boolean', description: 'Allows the button to grow to the width of its container' },
    removeUnderline: { control: 'boolean', description: 'Removes underline from button text (including on interaction)' },
    dataPrimaryLink: { control: 'boolean', description: 'Indicates whether or not the button is the primary navigation link when rendered inside of an `IndexTable.Row`' },
    tone: { control: 'select', options: ['critical', 'success'], description: 'Sets the color treatment of the Button.' },
    variant: { control: 'select', options: ['plain', 'primary', 'secondary', 'tertiary', 'monochromePlain'], description: 'Changes the visual appearance of the Button.' },
    withIcon: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `icon` ({"$import":"@shopify/polaris-icons#PlusCircleIcon"}); the created subtree is carried as parts gated on this prop.' },
  },
  args: {
    size: 'medium',
    textAlign: 'center',
    fullWidth: false,
    removeUnderline: false,
    dataPrimaryLink: false,
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
        gridTemplateColumns: 'repeat(50, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
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
