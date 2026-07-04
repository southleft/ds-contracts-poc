/**
 * Live rendering of the REAL generated design-system components.
 * The dashboard dogfoods the library it documents: every sample below is the
 * actual component from src/components, driven by contract-legal props only.
 */
import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Banner,
  Blockquote,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  EmptyState,
  IconButton,
  Inline,
  Stack,
  StatusDot,
  Table,
  TableCell,
  TableHeaderCell,
  TableRow,
  TextArea,
  TextField,
  Toast,
  Token,
} from '../../src/components';
import type {
  AvatarProps,
  BadgeProps,
  BannerProps,
  ButtonProps,
  CheckboxProps,
  DividerProps,
  IconButtonProps,
  InlineProps,
  StackProps,
  StatusDotProps,
  TableCellProps,
  TableHeaderCellProps,
  TableProps,
  TableRowProps,
  TextAreaProps,
  TextFieldProps,
  ToastProps,
  TokenProps,
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

    case 'Banner': {
      const p = props as Partial<BannerProps>;
      return (
        <Banner
          {...p}
          title={typeof p.title === 'string' && p.title !== '' ? p.title : 'Scheduled maintenance'}
          description={
            typeof p.description === 'string'
              ? p.description
              : 'Contract sync pauses Saturday 02:00–03:00 UTC while tokens republish.'
          }
          endContent={
            <Button variant="secondary" size="sm">
              Learn more
            </Button>
          }
        />
      );
    }

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

    case 'Blockquote':
      return (
        <Blockquote cite="Design Systems Handbook">
          The contract is the source of truth; both surfaces are renderers.
        </Blockquote>
      );

    case 'Checkbox': {
      const p = props as Partial<CheckboxProps>;
      return <Checkbox {...p} label={p.label || 'Email me weekly summaries'} description={p.description ?? 'Sent every Monday morning.'} />;
    }

    case 'Code':
      return <Code {...props}>{text('npm run parity')}</Code>;

    case 'Divider':
      return (
        <div style={{ width: '100%', minWidth: 200 }}>
          <Divider {...(props as DividerProps)} />
        </div>
      );

    case 'EmptyState': {
      const p = props as Partial<React.ComponentProps<typeof EmptyState>>;
      return (
        <EmptyState
          {...p}
          title={p.title || 'No reports yet'}
          description={p.description ?? 'Run your first parity check to see results here.'}
          actions={<Button variant="secondary" size="sm">Run check</Button>}
        />
      );
    }

    case 'IconButton': {
      const p = props as Partial<IconButtonProps>;
      return (
        <IconButton
          {...p}
          label={p.label || 'Search'}
          icon={
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="9" cy="9" r="5.5" />
              <line x1="13.2" y1="13.2" x2="16.5" y2="16.5" strokeLinecap="round" />
            </svg>
          }
        />
      );
    }

    case 'StatusDot': {
      const p = props as Partial<StatusDotProps>;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <StatusDot {...p} label={p.label || 'Online'} />
          <span style={{ fontSize: 13 }}>{p.label || 'Online'}</span>
        </span>
      );
    }

    case 'TextArea': {
      const p = props as Partial<TextAreaProps>;
      return <TextArea {...p} label={p.label || 'Feedback'} />;
    }

    case 'TextField': {
      const p = props as Partial<TextFieldProps>;
      return <TextField {...p} label={p.label || 'Email address'} />;
    }

    case 'Toast':
      return (
        <Toast {...(props as ToastProps)} endContent={<Button variant="secondary" size="sm">Undo</Button>}>
          {text('Contract v1.1.0 published.')}
        </Toast>
      );

    case 'Token': {
      const p = props as Partial<TokenProps>;
      return <Token {...p} label={p.label || 'design-tokens'} />;
    }

    default:
      return <span className="muted">No sample available.</span>;
  }
}
