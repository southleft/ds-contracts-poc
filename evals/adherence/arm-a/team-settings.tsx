import {
  Card,
  Button,
  Stack,
  Table,
  TableRow,
  TableCell,
} from 'ds-contracts-poc';

export default function TeamSettings() {
  return (
    <Stack gap="lg">
      <Card
        title="Team profile"
        actions={[
          <Button key="save">Save</Button>,
          <Button key="cancel" variant="secondary">
            Cancel
          </Button>,
        ]}
      >
        Manage your team's name, description, and shared settings. Changes apply
        to everyone on the team.
      </Card>

      {/* GAP: Table exposes no slot/prop to supply column header labels
          (Name, Role, Status); TableHeaderCell cannot be placed because
          Table accepts only TableRow and TableRow accepts only TableCell. */}
      <Table density="comfortable">
        <TableRow>
          <TableCell>Ava Chen</TableCell>
          <TableCell>Owner</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow state="selected">
          <TableCell>Marcus Lee</TableCell>
          <TableCell>Admin</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Priya Nair</TableCell>
          <TableCell>Member</TableCell>
          <TableCell>Invited</TableCell>
        </TableRow>
      </Table>
    </Stack>
  );
}
