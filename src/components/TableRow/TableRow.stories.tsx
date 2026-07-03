/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-row.contract.json (ds.table-row v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableCell } from '../TableCell';
import { TableRow } from './TableRow';

const meta = {
  title: 'Components/TableRow',
  component: TableRow,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A selectable row of table cells.' } },
  },
  render: (args) => (
    <TableRow {...args}>
      <TableCell>Ada Lovelace</TableCell>
      <TableCell>Engineering</TableCell>
      <TableCell>Active</TableCell>
    </TableRow>
  ),
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'selected'],
      description: 'Data state of the row.',
    },
    children: { control: false },
  },
  args: {
    state: 'default',
  },
} satisfies Meta<typeof TableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};

export const Selected: Story = {
  args: { state: 'selected' },
};
