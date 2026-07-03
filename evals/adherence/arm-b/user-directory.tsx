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

type Member = {
  name: string;
  department: string;
  status: 'Active' | 'Away' | 'Offline';
};

const MEMBERS: Member[] = [
  { name: 'Ava Chen', department: 'Engineering', status: 'Active' },
  { name: 'Marcus Reid', department: 'Design', status: 'Away' },
  { name: 'Priya Nair', department: 'Marketing', status: 'Active' },
  { name: 'Tom Alvarez', department: 'Sales', status: 'Offline' },
];

const STATUS_TONE: Record<Member['status'], string> = {
  Active: 'success',
  Away: 'warning',
  Offline: 'neutral',
};

export default function UserDirectory() {
  return (
    <Card title="Directory">
      <Stack gap="md">
        <Inline align="center" gap="sm">
          <Badge tone="info">{MEMBERS.length ? '42 members' : '0 members'}</Badge>
        </Inline>

        <Table>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Department</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>

          {MEMBERS.map((member) => (
            <TableRow key={member.name}>
              <TableCell>
                <Inline align="center" gap="sm">
                  <Avatar name={member.name} size="sm" />
                  {member.name}
                </Inline>
              </TableCell>
              <TableCell>{member.department}</TableCell>
              <TableCell>
                <Badge tone={STATUS_TONE[member.status]}>{member.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Stack>
    </Card>
  );
}
