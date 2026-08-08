/**
 * RECON probe host. NOT the capture harness — the capture harness writes its
 * own entry from the config's `mount` recipe. This app exists to answer the
 * recon's empirical questions (Griffel emission, where the theme's custom
 * properties are declared, portal shape, stable class identity) in a real
 * browser.
 */
import {
  FluentProvider,
  webLightTheme,
  Button,
  Badge,
  Avatar,
  Card,
  CardHeader,
  CardPreview,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Checkbox,
  Switch,
  Input,
  Tab,
  TabList,
  Tooltip,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { CalendarMonthRegular } from '@fluentui/react-icons';

export function App() {
  return (
    <FluentProvider theme={webLightTheme} id="fp">
      <div id="stages">
        <div data-probe="Button">
          <Button appearance="primary" size="medium" shape="rounded" icon={<CalendarMonthRegular />}>
            Button
          </Button>
        </div>
        <div data-probe="Button-subtle">
          <Button appearance="subtle" size="small" shape="circular">
            Button
          </Button>
        </div>
        <div data-probe="Badge">
          <Badge appearance="filled" color="brand" size="medium" shape="circular">
            9
          </Badge>
        </div>
        <div data-probe="Avatar">
          <Avatar name="Fluent Two" size={48} />
        </div>
        <div data-probe="Card">
          <Card>
            <CardPreview>
              <Text>preview</Text>
            </CardPreview>
            <CardHeader header={<Text weight="semibold">Card header</Text>} description={<Text>description</Text>} />
          </Card>
        </div>
        <div data-probe="MessageBar">
          <MessageBar intent="warning">
            <MessageBarBody>
              <MessageBarTitle>Title</MessageBarTitle>
              Message body
            </MessageBarBody>
          </MessageBar>
        </div>
        <div data-probe="Checkbox">
          <Checkbox label="Checkbox" checked id="probe-checkbox" onChange={() => {}} />
        </div>
        <div data-probe="Switch">
          <Switch label="Switch" checked id="probe-switch" onChange={() => {}} />
        </div>
        <div data-probe="Input">
          <Input placeholder="Value" id="probe-input" />
        </div>
        <div data-probe="TabList">
          <TabList selectedValue="tab-1" onTabSelect={() => {}}>
            <Tab value="tab-1">One</Tab>
            <Tab value="tab-2">Two</Tab>
          </TabList>
        </div>
        <div data-probe="Spinner">
          <Spinner size="medium" label="Loading" />
        </div>
        <div data-probe="Tooltip">
          <Tooltip content="Tooltip content" relationship="label" visible positioning="after">
            <Button>trigger</Button>
          </Tooltip>
        </div>
        <div data-probe="Dialog">
          <Dialog open modalType="modal">
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogContent>Dialog content</DialogContent>
                <DialogActions>
                  <Button appearance="primary">OK</Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      </div>
    </FluentProvider>
  );
}
