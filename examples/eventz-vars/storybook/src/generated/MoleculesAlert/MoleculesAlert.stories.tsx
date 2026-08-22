/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/molecules-alert.contract.json (ds.molecules-alert v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { MoleculesAlert } from './MoleculesAlert';

const meta = {
  title: 'Components/MoleculesAlert',
  component: MoleculesAlert,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['success', 'info', 'warning', 'danger'] },
    titleText: { control: 'text' },
    descriptionText: { control: 'text' },
    hasIcon: { control: 'boolean' },
    hasLink: { control: 'boolean' },
    isDismissible: { control: 'boolean' },
  },
  args: {
    variant: 'success',
    titleText: 'Title',
    descriptionText: 'Description',
    hasIcon: true,
    hasLink: true,
    isDismissible: true,
  },
} satisfies Meta<typeof MoleculesAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Success: Story = {
  args: { variant: 'success' },
};

export const Info: Story = {
  args: { variant: 'info' },
};

export const Warning: Story = {
  args: { variant: 'warning' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
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
      <MoleculesAlert variant="success" />
      <MoleculesAlert variant="info" />
      <MoleculesAlert variant="warning" />
      <MoleculesAlert variant="danger" />
    </div>
  ),
};
