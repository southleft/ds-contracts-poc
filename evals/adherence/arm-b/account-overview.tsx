import {
  Avatar,
  Badge,
  Button,
  Card,
  Inline,
  Stack,
  Table,
  TableCell,
  TableHeaderCell,
  TableRow,
} from 'ds-contracts-poc';

interface SummaryCardData {
  title: string;
  body: string;
  actionLabel: string;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  statusTone: 'success' | 'warning' | 'neutral';
  selected?: boolean;
}

const summaryCards: SummaryCardData[] = [
  {
    title: 'Plan',
    body: 'Business Pro — billed annually. Renews on Aug 1, 2026.',
    actionLabel: 'Change plan',
  },
  {
    title: 'Seats',
    body: '12 of 20 seats in use across your organization.',
    actionLabel: 'Manage seats',
  },
  {
    title: 'Billing',
    body: 'Visa ending in 4242. Next invoice $480.00.',
    actionLabel: 'Update payment',
  },
];

const members: MemberRow[] = [
  {
    id: '1',
    name: 'Ada Lovelace',
    email: 'ada@acme.co',
    role: 'Owner',
    status: 'Active',
    statusTone: 'success',
  },
  {
    id: '2',
    name: 'Grace Hopper',
    email: 'grace@acme.co',
    role: 'Admin',
    status: 'Active',
    statusTone: 'success',
    selected: true,
  },
  {
    id: '3',
    name: 'Alan Turing',
    email: 'alan@acme.co',
    role: 'Member',
    status: 'Invited',
    statusTone: 'warning',
  },
];

export default function AccountOverview() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 24px',
      }}
    >
      <Stack gap="large">
        {/* Identity header */}
        <Inline gap="medium" align="center">
          <Avatar name="Acme Corporation" size="large" />
          <Stack gap="xsmall">
            <Inline gap="small" align="center">
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Acme Corporation
              </h1>
              <Badge tone="success">Active</Badge>
            </Inline>
            <span style={{ color: '#6b7280', fontSize: 14 }}>
              Organization account · acme.co
            </span>
          </Stack>
        </Inline>

        {/* Summary cards */}
        <Inline gap="medium" align="stretch">
          {summaryCards.map((card) => (
            <div key={card.title} style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <Stack gap="small">
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                    {card.title}
                  </h2>
                  <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                    {card.body}
                  </p>
                  <Inline gap="small">
                    <Button variant="secondary">{card.actionLabel}</Button>
                  </Inline>
                </Stack>
              </Card>
            </div>
          ))}
        </Inline>

        {/* Members table */}
        <Stack gap="small">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Members</h2>
          <Card>
            <Table>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
              {members.map((member) => (
                <TableRow key={member.id} selected={member.selected}>
                  <TableCell>
                    <Inline gap="small" align="center">
                      <Avatar name={member.name} size="small" />
                      <span>{member.name}</span>
                    </Inline>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    <Badge tone={member.statusTone}>{member.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>
        </Stack>

        {/* Footer action row */}
        <Inline gap="small" align="center" justify="end">
          <Button variant="secondary">Export</Button>
          <Button variant="primary">Invite member</Button>
        </Inline>
      </Stack>
    </main>
  );
}
