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

interface Member {
  id: string;
  name: string;
  role: string;
  status: string;
  statusTone: 'positive' | 'warning' | 'neutral';
}

const members: Member[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    role: 'Owner',
    status: 'Active',
    statusTone: 'positive',
  },
  {
    id: '2',
    name: 'Jordan Chen',
    role: 'Admin',
    status: 'Active',
    statusTone: 'positive',
  },
  {
    id: '3',
    name: 'Sam Taylor',
    role: 'Member',
    status: 'Pending',
    statusTone: 'warning',
  },
];

const selectedMemberId = '2';

export default function TeamSettings() {
  return (
    <Stack gap="large" style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Card>
        <Stack gap="medium" style={{ padding: 24 }}>
          <Stack gap="small">
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              Team profile
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
              Manage your team's name, description, and general settings. These
              details are visible to all members of your workspace.
            </p>
          </Stack>
          <Inline gap="small">
            <Button variant="primary">Save</Button>
            <Button variant="secondary">Cancel</Button>
          </Inline>
        </Stack>
      </Card>

      <Stack gap="medium">
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Members</h3>
        <Table>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
          {members.map((member) => (
            <TableRow key={member.id} selected={member.id === selectedMemberId}>
              <TableCell>
                <Inline gap="small" align="center">
                  <Avatar name={member.name} />
                  <span>{member.name}</span>
                </Inline>
              </TableCell>
              <TableCell>{member.role}</TableCell>
              <TableCell>
                <Badge tone={member.statusTone}>{member.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Stack>
    </Stack>
  );
}
