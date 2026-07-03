import {
  Avatar,
  Badge,
  Button,
  Card,
  Inline,
  Stack,
  Table,
  TableRow,
  TableCell,
} from 'ds-contracts-poc';

export default function AccountOverview() {
  return (
    <Stack gap="lg">
      {/* Identity header: avatar + account name + status badge */}
      <Inline gap="md">
        <Avatar size="md">AC</Avatar>
        Acme Corporation
        <Badge variant="success">Active</Badge>
      </Inline>

      {/* Summary cards: Plan, Seats, Billing — each with a body and one secondary action */}
      <Inline gap="md">
        <Card
          title="Plan"
          actions={<Button variant="secondary">Change plan</Button>}
        >
          Enterprise plan billed annually. Renews on Jan 1, 2027.
        </Card>
        <Card
          title="Seats"
          actions={<Button variant="secondary">Manage seats</Button>}
        >
          42 of 50 seats in use across your organization.
        </Card>
        <Card
          title="Billing"
          actions={<Button variant="secondary">View invoices</Button>}
        >
          Visa ending 4242. Next charge of $4,800 on Jan 1, 2027.
        </Card>
      </Inline>

      {/* Members table with header row and 3 rows (one selected) */}
      {/* GAP: TableHeaderCell has no legal parent slot (Table accepts only TableRow,
          TableRow accepts only TableCell), so the header row uses TableCell. */}
      <Table density="comfortable">
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Role</TableCell>
        </TableRow>
        <TableRow state="default">
          <TableCell>Jordan Reyes</TableCell>
          <TableCell>jordan@acme.com</TableCell>
          <TableCell>Owner</TableCell>
        </TableRow>
        <TableRow state="selected">
          <TableCell>Priya Nair</TableCell>
          <TableCell>priya@acme.com</TableCell>
          <TableCell>Admin</TableCell>
        </TableRow>
        <TableRow state="default">
          <TableCell>Sam Whitfield</TableCell>
          <TableCell>sam@acme.com</TableCell>
          <TableCell>Member</TableCell>
        </TableRow>
      </Table>

      {/* Page-level footer action row */}
      <Inline gap="sm">
        <Button variant="secondary">Export</Button>
        <Button>Invite member</Button>
      </Inline>
    </Stack>
  );
}
