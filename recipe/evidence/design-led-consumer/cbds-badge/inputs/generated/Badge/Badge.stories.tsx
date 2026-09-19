/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A versatile badge component for labeling, categorizing, or highlighting content with support for 6 semantic color types, 3 visual styles, 2 sizes, optional rounded corners, and optional leading/trailing icons. \n\n\nPURPOSE: Badges are non-interactive status indicators used to communicate categorical information, counts, or states at a glance. They support semantic intent through color types (brand, success, warning, danger, neutral, accent) and visual weight through style variants (fill, tonal, outline). \n\n\nBEHAVIOR: This component is purely presentational with no interactive states — it does not respond to hover, focus, or press events. Icon visibility is controlled via boolean toggles for left and right positions independently. \n\n\nCOMPOSITION: Contains two Icon instances (left and right positions, each wrapping a Placeholder instance with a vector icon) and a Label text node. AI code generators should search the codebase for existing Icon and Placeholder sub-components before creating new ones — these are likely shared primitives used across the design system. \n\n\nUSAGE: Use badges to annotate UI elements with status, category, or metadata. Choose 'fill' for high-emphasis labels, 'tonal' for medium-emphasis on light backgrounds, and 'outline' for low-emphasis or when background contrast is a concern. Use 'rounded=true' for pill-style badges common in tag or chip contexts. Prefer 'large' for standalone use and 'small' for dense or inline contexts. \n\n\nCODE GENERATION NOTES: The component produces 72 total variants (6 types × 3 styles × 2 sizes × 2 rounded states). Icon visibility should be implemented via conditional rendering driven by the iconLeft and iconRight boolean props. The iconLeft and iconRight props are booleans that reveal nested Icon instance slots. All 47 design tokens are fully applied with zero hard-coded values, indicating a mature, token-complete component.\n\nACCESSIBILITY: A badge is almost always non-interactive text — it needs no role, but its meaning must not depend on color alone (WCAG 1.4.1). type=success and type=danger differ only by hue, so the label must carry the meaning (\"Active\", \"Failed\"), never a bare color swatch. Ensure the label meets 4.5:1 against the badge fill in all three styles; the outline style is the tightest case. If a badge is dismissible or filterable it becomes a control and needs a button, a name, and a focus state.",
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['brand', 'success', 'warning', 'danger', 'neutral', 'accent'],
    },
    style: { control: 'select', options: ['fill', 'tonal', 'outline'] },
    size: { control: 'select', options: ['large', 'small'] },
    rounded: { control: 'boolean' },
    text: { control: 'text' },
    iconLeft: { control: 'boolean' },
    iconRight: { control: 'boolean' },
  },
  args: {
    type: 'brand',
    style: 'fill',
    size: 'large',
    rounded: false,
    text: 'Label',
    iconLeft: false,
    iconRight: false,
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Brand: Story = {
  args: { type: 'brand' },
};

export const Success: Story = {
  args: { type: 'success' },
};

export const Warning: Story = {
  args: { type: 'warning' },
};

export const Danger: Story = {
  args: { type: 'danger' },
};

export const Neutral: Story = {
  args: { type: 'neutral' },
};

export const Accent: Story = {
  args: { type: 'accent' },
};
/** Every legal combination the contract defines (type × style × size). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(6, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Badge type="brand" style="fill" size="large" />
      <Badge type="brand" style="fill" size="small" />
      <Badge type="brand" style="tonal" size="large" />
      <Badge type="brand" style="tonal" size="small" />
      <Badge type="brand" style="outline" size="large" />
      <Badge type="brand" style="outline" size="small" />
      <Badge type="success" style="fill" size="large" />
      <Badge type="success" style="fill" size="small" />
      <Badge type="success" style="tonal" size="large" />
      <Badge type="success" style="tonal" size="small" />
      <Badge type="success" style="outline" size="large" />
      <Badge type="success" style="outline" size="small" />
      <Badge type="warning" style="fill" size="large" />
      <Badge type="warning" style="fill" size="small" />
      <Badge type="warning" style="tonal" size="large" />
      <Badge type="warning" style="tonal" size="small" />
      <Badge type="warning" style="outline" size="large" />
      <Badge type="warning" style="outline" size="small" />
      <Badge type="danger" style="fill" size="large" />
      <Badge type="danger" style="fill" size="small" />
      <Badge type="danger" style="tonal" size="large" />
      <Badge type="danger" style="tonal" size="small" />
      <Badge type="danger" style="outline" size="large" />
      <Badge type="danger" style="outline" size="small" />
      <Badge type="neutral" style="fill" size="large" />
      <Badge type="neutral" style="fill" size="small" />
      <Badge type="neutral" style="tonal" size="large" />
      <Badge type="neutral" style="tonal" size="small" />
      <Badge type="neutral" style="outline" size="large" />
      <Badge type="neutral" style="outline" size="small" />
      <Badge type="accent" style="fill" size="large" />
      <Badge type="accent" style="fill" size="small" />
      <Badge type="accent" style="tonal" size="large" />
      <Badge type="accent" style="tonal" size="small" />
      <Badge type="accent" style="outline" size="large" />
      <Badge type="accent" style="outline" size="small" />
    </div>
  ),
};
