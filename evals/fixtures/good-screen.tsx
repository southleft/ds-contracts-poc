/** Canonical adherent screen — every element from the catalog, one primary
 *  action, layout via primitives, zero literals. The judge must pass this. */
import {
  Avatar,
  Badge,
  Button,
  Card,
  Inline,
  Stack,
  Table,
  TableCell,
  TableRow,
} from 'ds-contracts-poc';

export function GoodScreen() {
  return (
    <Stack gap="lg">
      <Inline gap="md">
        <Avatar size="md">TP</Avatar>
        <Badge variant="success">Active</Badge>
      </Inline>
      <Card
        title="Team"
        actions={<Button variant="secondary" size="sm">Manage</Button>}
      >
        Quarterly staffing overview.
      </Card>
      <Table density="compact">
        <TableRow state="selected">
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineering</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Grace Hopper</TableCell>
          <TableCell>Systems</TableCell>
        </TableRow>
      </Table>
      <Inline gap="sm">
        <Button variant="secondary">Cancel</Button>
        <Button>Save</Button>
      </Inline>
    </Stack>
  );
}
