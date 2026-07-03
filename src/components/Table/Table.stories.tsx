/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table.contract.json (ds.table v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableRow } from '../TableRow';
import { TableCell } from '../TableCell';
import { Table } from './Table';

const meta = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Structured data in rows and columns. Composes header cells (with the Table's density mapped into them), and a body slot of rows.",
      },
    },
  },
  render: (args) => (
    <Table {...args}>
      <TableRow>
        <TableCell>Ada Lovelace</TableCell>
        <TableCell>Engineering</TableCell>
        <TableCell>Active</TableCell>
      </TableRow>
      <TableRow state="selected">
        <TableCell>Ada Lovelace</TableCell>
        <TableCell>Engineering</TableCell>
        <TableCell>Active</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Ada Lovelace</TableCell>
        <TableCell>Engineering</TableCell>
        <TableCell>Active</TableCell>
      </TableRow>
    </Table>
  ),
  argTypes: {
    density: {
      control: 'select',
      options: ['comfortable', 'compact'],
      description: 'Vertical rhythm of the whole table; mapped into the fixed header cells.',
    },
    children: { control: false },
  },
  args: {
    density: 'comfortable',
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Comfortable: Story = {
  args: { density: 'comfortable' },
};

export const Compact: Story = {
  args: { density: 'compact' },
};
