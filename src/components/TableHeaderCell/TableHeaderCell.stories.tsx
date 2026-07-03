/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-header-cell.contract.json (ds.table-header-cell v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableHeaderCell } from './TableHeaderCell';

const meta = {
  title: 'Components/TableHeaderCell',
  component: TableHeaderCell,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A column header cell.' } },
  },
  argTypes: {
    density: {
      control: 'select',
      options: ['comfortable', 'compact'],
      description: 'Vertical rhythm, normally driven by the owning Table.',
    },
    children: { control: 'text', description: 'Column label.' },
  },
  args: {
    density: 'comfortable',
    children: 'Header',
  },
} satisfies Meta<typeof TableHeaderCell>;

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
      <TableHeaderCell density="comfortable">Header</TableHeaderCell>
      <TableHeaderCell density="compact">Header</TableHeaderCell>
    </div>
  ),
};
