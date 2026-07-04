/**
 * Live rendering of the REAL generated design-system components.
 * The dashboard dogfoods the library it documents: every sample below is the
 * actual component from src/components, driven by contract-legal props only.
 */
import type { ReactNode } from 'react';
import {
  AccordionItem,
  Avatar,
  AvatarGroup,
  Badge,
  Banner,
  Blockquote,
  BreadcrumbItem,
  Breadcrumbs,
  Pagination,
  ProgressBar,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  ChatMessage,
  ChatMessageMetadata,
  ChatSystemMessage,
  Citation,
  Field,
  Kbd,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  Section as DsSection,
  SideNavItem,
  Tab,
  TabList,
  Toolbar,
  TopNav,
  TopNavItem,
  TypeaheadItem,
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

    case 'ChatMessage':
      return (
        <ChatMessage
          {...(props as Record<string, unknown>)}
          avatar={<Avatar>AI</Avatar>}
          metadata={<ChatMessageMetadata status="read" timestamp="2:14 PM" />}
        >
          Parity is clean — all three surfaces match the contracts.
        </ChatMessage>
      );

    case 'ChatMessageMetadata':
      return <ChatMessageMetadata {...(props as Record<string, unknown>)} />;

    case 'ChatSystemMessage': {
      const p = props as Record<string, unknown>;
      return <ChatSystemMessage variant="divider" {...p} message={(p.message as string) || 'Today'} />;
    }

    case 'Citation': {
      const p = props as Record<string, unknown>;
      return <Citation {...p} sourceTitle={(p.sourceTitle as string) || 'astryx.atmeta.com'} href="#" />;
    }

    case 'Field': {
      const p = props as Record<string, unknown>;
      return (
        <Field {...p} label={(p.label as string) || 'Workspace name'} inputID="field-control">
          <input
            id="field-control"
            placeholder="Acme Inc."
            style={{ padding: '8px 12px', border: '1px solid var(--color-border-subtle)', borderRadius: 8, font: 'inherit', background: 'var(--color-input-background)', color: 'inherit' }}
          />
        </Field>
      );
    }

    case 'Kbd': {
      const p = props as Record<string, unknown>;
      return <Kbd {...p} keys={(p.keys as string) || '⌘K'} />;
    }

    case 'List':
      return (
        <List {...(props as Record<string, unknown>)}>
          <ListItem label="Design tokens" description="232 governed values" endContent={<Badge variant="success">Synced</Badge>} />
          <ListItem label="Contracts" description="One JSON file per component" />
          <ListItem label="Parity checks" description="Three surfaces, one differ" />
        </List>
      );

    case 'ListItem': {
      const p = props as Record<string, unknown>;
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 240 }}>
          <ListItem {...p} label={(p.label as string) || 'List item'} endContent={<Badge variant="info">3</Badge>} />
        </ul>
      );
    }

    case 'MetadataList':
      return (
        <MetadataList {...(props as Record<string, unknown>)}>
          <MetadataListItem label="Owner" value="Design Infrastructure" />
          <MetadataListItem label="Status" value="Active" />
          <MetadataListItem label="Updated" value="2 hours ago" />
        </MetadataList>
      );

    case 'MetadataListItem': {
      const p = props as Record<string, unknown>;
      return <MetadataListItem {...p} label={(p.label as string) || 'Owner'} />;
    }

    case 'Section':
      return (
        <DsSection {...(props as Record<string, unknown>)}>
          <span style={{ fontSize: 13 }}>Grouped page content lives inside a Section.</span>
        </DsSection>
      );

    case 'SideNavItem': {
      const p = props as Record<string, unknown>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <SideNavItem label="Overview" state="selected" href="#" endContent={<Badge variant="info">4</Badge>} />
          <SideNavItem {...p} label={(p.label as string) || 'Components'} href="#" />
        </div>
      );
    }

    case 'Tab': {
      const p = props as Record<string, unknown>;
      return <Tab {...p} label={(p.label as string) || 'Overview'} />;
    }

    case 'TabList':
      return (
        <TabList {...(props as Record<string, unknown>)}>
          <Tab label="Overview" state="selected" />
          <Tab label="Components" endContent={<Badge variant="info">40</Badge>} />
          <Tab label="Tokens" />
        </TabList>
      );

    case 'Toolbar': {
      const p = props as Record<string, unknown>;
      return (
        <Toolbar
          {...p}
          label={(p.label as string) || 'Document actions'}
          startContent={<><Token label="draft" /><Token label="v1.0.0" color="blue" /></>}
          endContent={<Button variant="primary" size="sm">Publish</Button>}
        />
      );
    }

    case 'TopNav': {
      const p = props as Record<string, unknown>;
      return (
        <TopNav
          {...p}
          label={(p.label as string) || 'Main'}
          heading={<strong style={{ fontSize: 14 }}>Contract Hub</strong>}
          startContent={<><TopNavItem label="Overview" state="selected" href="#" /><TopNavItem label="Components" href="#" /></>}
          endContent={<Avatar>TJ</Avatar>}
        />
      );
    }

    case 'TopNavItem': {
      const p = props as Record<string, unknown>;
      return <TopNavItem {...p} label={(p.label as string) || 'Overview'} href="#" />;
    }

    case 'TypeaheadItem': {
      const p = props as Record<string, unknown>;
      return <TypeaheadItem {...p} label={(p.label as string) || 'Jordan Reyes'} description={(p.description as string) ?? 'Engineer · Platform'} icon={<Avatar size="sm">JR</Avatar>} />;
    }

    case 'AccordionItem': {
      const p = props as Record<string, unknown>;
      return (
        <AccordionItem state="open" {...p} title={(p.title as string) || 'What is a contract?'}>
          A versioned JSON file both surfaces are generated from.
        </AccordionItem>
      );
    }

    case 'AvatarGroup':
      return (
        <AvatarGroup {...(props as Record<string, unknown>)}>
          <Avatar>AB</Avatar>
          <Avatar>CD</Avatar>
          <Avatar>EF</Avatar>
        </AvatarGroup>
      );

    case 'BreadcrumbItem': {
      const p = props as Record<string, unknown>;
      return <BreadcrumbItem {...p} label={(p.label as string) || 'Components'} href="#" />;
    }

    case 'Breadcrumbs': {
      const p = props as Record<string, unknown>;
      return (
        <Breadcrumbs {...p} label={(p.label as string) || 'Breadcrumb'}>
          <BreadcrumbItem label="Home" hasSeparator={false} href="#" />
          <BreadcrumbItem label="Components" href="#" />
          <BreadcrumbItem label="ProgressBar" href="#" />
        </Breadcrumbs>
      );
    }

    case 'Pagination': {
      const p = props as Record<string, unknown>;
      return <Pagination {...p} label={(p.label as string) || 'Pagination'} />;
    }

    case 'ProgressBar': {
      const p = props as Record<string, unknown>;
      return (
        <div style={{ width: '100%', minWidth: 220 }}>
          <ProgressBar {...p} label={(p.label as string) || 'Sync progress'} />
        </div>
      );
    }

    case 'Skeleton':
      return <Skeleton {...(props as Record<string, unknown>)} />;

    case 'Slider': {
      const p = props as Record<string, unknown>;
      return (
        <div style={{ width: '100%', minWidth: 220 }}>
          <Slider {...p} label={(p.label as string) || 'Volume'} />
        </div>
      );
    }

    case 'Spinner': {
      const p = props as Record<string, unknown>;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Spinner {...p} label={(p.label as string) || 'Loading'} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </span>
      );
    }

    case 'Switch': {
      const p = props as Record<string, unknown>;
      return <Switch value="on" {...p} label={(p.label as string) || 'Enable notifications'} />;
    }

    default:
      return <span className="muted">No sample available.</span>;
  }
}
