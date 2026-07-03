/**
 * Live rendering of the REAL generated design-system components.
 * The dashboard dogfoods the library it documents: every sample below is the
 * actual component from src/components, driven by contract-legal props only.
 */
import type { ReactNode } from 'react';
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
} from '../../src/components';
import type {
  AvatarProps,
  BadgeProps,
  ButtonProps,
  InlineProps,
  StackProps,
  TableCellProps,
  TableHeaderCellProps,
  TableProps,
  TableRowProps,
} from '../../src/components';

/** Default text children per component, used when no override is supplied. */
export const SAMPLE_TEXT: Record<string, string> = {
  Avatar: 'AB',
  Badge: 'Badge',
  Button: 'Button',
  TableCell: 'Cell',
  TableHeaderCell: 'Header',
};

export function renderSample(
  name: string,
  props: Record<string, unknown> = {},
  childText?: string,
): ReactNode {
  const text = (fallback: string) =>
    childText !== undefined && childText !== '' ? childText : fallback;

  switch (name) {
    case 'Avatar':
      return <Avatar {...(props as AvatarProps)}>{text('AB')}</Avatar>;

    case 'Badge':
      return <Badge {...(props as BadgeProps)}>{text('Badge')}</Badge>;

    case 'Button':
      return <Button {...(props as ButtonProps)}>{text('Button')}</Button>;

    case 'Card': {
      const title = typeof props['title'] === 'string' ? (props['title'] as string) : 'Card title';
      return (
        <Card
          title={title}
          actions={
            <Button variant="secondary" size="sm">
              View report
            </Button>
          }
        >
          Revenue is tracking 12% ahead of plan. Two accounts need follow-up before Friday.
        </Card>
      );
    }

    case 'Inline':
      return (
        <Inline {...(props as InlineProps)}>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </Inline>
      );

    case 'Stack':
      return (
        <Stack {...(props as StackProps)}>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </Stack>
      );

    case 'Table': {
      const density = props['density'] === 'compact' ? 'compact' : 'comfortable';
      return (
        <Table {...(props as TableProps)}>
          <TableRow>
            <TableCell density={density}>Jordan Reyes</TableCell>
            <TableCell density={density}>Engineer</TableCell>
            <TableCell density={density}>Active</TableCell>
          </TableRow>
          <TableRow state="selected">
            <TableCell density={density}>Priya Nair</TableCell>
            <TableCell density={density}>Design</TableCell>
            <TableCell density={density}>Active</TableCell>
          </TableRow>
        </Table>
      );
    }

    case 'TableRow':
      return (
        <TableRow {...(props as TableRowProps)}>
          <TableCell>Jordan Reyes</TableCell>
          <TableCell>Engineer</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
      );

    case 'TableCell':
      return <TableCell {...(props as TableCellProps)}>{text('Cell')}</TableCell>;

    case 'TableHeaderCell':
      return (
        <TableHeaderCell {...(props as TableHeaderCellProps)}>{text('Header')}</TableHeaderCell>
      );

    default:
      return <span className="muted">No sample available.</span>;
  }
}
