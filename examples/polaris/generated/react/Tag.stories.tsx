/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tag.contract.json (polaris.tag v0.4.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Tag } from './Tag';

const meta = {
  title: 'Components/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: "PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Tag/Tag.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow." } },
  },
  argTypes: {
    disabled: { control: 'boolean', description: 'Disables the tag' },
    accessibilityLabel: { control: 'text', description: 'A string to use when tag has more than textual content' },
    url: { control: 'text', description: 'Url to navigate to when tag is clicked or keypressed.' },
    size: { control: 'select', options: ['none', 'large'], description: 'Tag size (round 4: real Tag API — only \'large\' exists; unset renders the default compact size).' },
    removable: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `onRemove` ({"$callback":true}); the created subtree is carried as parts gated on this prop.' },
    clickable: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `onClick` ({"$callback":true}); the created subtree is carried as parts gated on this prop.' },
    linked: { control: 'boolean', description: 'Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library\'s `url` ("https://example.com"); the created subtree is carried as parts gated on this prop.' },
    children: { control: 'text', description: 'Promoted from the computed floor: the mounted children render as this part\'s text (captured mount proof).' },
  },
  args: {
    disabled: false,
    size: 'none',
    removable: false,
    clickable: false,
    linked: false,
    children: 'Wholesale',
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const None: Story = {
  args: { size: 'none' },
};

export const Large: Story = {
  args: { size: 'large' },
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
        <Tag size="none">Wholesale</Tag>
        <Tag size="large">Wholesale</Tag>
    </div>
  ),
};
