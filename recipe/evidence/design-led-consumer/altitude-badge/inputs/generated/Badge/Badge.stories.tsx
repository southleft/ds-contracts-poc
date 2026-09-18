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
          'Tag: al-badge\n\nProps\n- isDot: boolean — isDot boolean\n- variant: info | success | warning | danger — State variant\n  - default: Displays a badge with the default state\n\nSlots\n- (default) — The badge content\n\nAccessibility\n- element: <div>\n\nDocs: https://altitude.pages.dev/docs/components/badge/\n\nDocumentation: https://altitude.pages.dev/docs/components/badge/',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['neutral', 'danger', 'info', 'success', 'warning'] },
    shape: { control: 'select', options: ['label', 'dot'] },
    text: { control: 'text' },
  },
  args: {
    variant: 'neutral',
    shape: 'label',
    text: 'Badge',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Neutral: Story = {
  args: { variant: 'neutral' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
};

export const Info: Story = {
  args: { variant: 'info' },
};

export const Success: Story = {
  args: { variant: 'success' },
};

export const Warning: Story = {
  args: { variant: 'warning' },
};
/** Every legal combination the contract defines (variant × shape). */
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
      <Badge variant="neutral" shape="label" />
      <Badge variant="neutral" shape="dot" />
      <Badge variant="danger" shape="label" />
      <Badge variant="danger" shape="dot" />
      <Badge variant="info" shape="label" />
      <Badge variant="info" shape="dot" />
      <Badge variant="success" shape="label" />
      <Badge variant="success" shape="dot" />
      <Badge variant="warning" shape="label" />
      <Badge variant="warning" shape="dot" />
    </div>
  ),
};
