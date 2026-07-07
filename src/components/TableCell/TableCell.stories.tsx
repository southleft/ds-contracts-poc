/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-cell.contract.json (ds.table-cell v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableCell } from './TableCell';

const meta = {
  title: 'Components/TableCell',
  component: TableCell,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A single data cell in a table row.' } },
  },
  argTypes: {
    density: {
      control: 'select',
      options: ['comfortable', 'compact'],
      description: 'Vertical rhythm, normally driven by the owning Table.',
    },
    children: { control: 'text', description: 'Cell content.' },
  },
  args: {
    density: 'comfortable',
    children: 'Cell',
  },
} satisfies Meta<typeof TableCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Comfortable: Story = {
  args: { density: 'comfortable' },
};

export const Compact: Story = {
  args: { density: 'compact' },
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
      <TableCell density="comfortable">Cell</TableCell>
      <TableCell density="compact">Cell</TableCell>
    </div>
  ),
};
