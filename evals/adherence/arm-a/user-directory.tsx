import {
  Card,
  Stack,
  Badge,
  Table,
  TableRow,
  TableCell,
} from 'ds-contracts-poc';

/**
 * UserDirectory — a directory panel listing members in a table.
 *
 * Slot notes:
 * - Card body (default slot) holds a Stack of the member-count Badge and the Table.
 * - Table children are TableRow only; TableRow children are TableCell only.
 */
export function UserDirectory() {
  return (
    <Card title="Directory">
      <Stack gap="md">
        <Badge variant="info">42 members</Badge>
        <Table density="comfortable">
          {/* GAP: Table exposes no way to supply column headers — TableHeaderCell
              has no reachable parent slot (Table accepts only TableRow; TableRow
              accepts only TableCell). Column labels rendered as a leading data
              row of TableCells instead. */}
          <TableRow state="default">
            <TableCell>Name</TableCell>
            <TableCell>Department</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
          <TableRow state="default">
            <TableCell>Ada Lovelace</TableCell>
            <TableCell>Engineering</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
          <TableRow state="default">
            <TableCell>Grace Hopper</TableCell>
            <TableCell>Research</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
          <TableRow state="default">
            <TableCell>Alan Turing</TableCell>
            <TableCell>Mathematics</TableCell>
            <TableCell>Away</TableCell>
          </TableRow>
          <TableRow state="default">
            <TableCell>Katherine Johnson</TableCell>
            <TableCell>Operations</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </Table>
      </Stack>
    </Card>
  );
}
