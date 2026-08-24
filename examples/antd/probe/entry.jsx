import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, Button, Tag, Badge, Switch, Checkbox, Radio, Input, Alert, Avatar, Progress, Card, Tooltip, Table, Select } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';

function Set({ id }) {
  return (
    <div id={id} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: '#fff' }}>
      <Button data-probe="btn-default">Button</Button>
      <Button data-probe="btn-primary" type="primary">Primary</Button>
      <Button data-probe="btn-primary-danger" type="primary" danger>Danger</Button>
      <Button data-probe="btn-dashed" type="dashed">Dashed</Button>
      <Button data-probe="btn-link" type="link">Link</Button>
      <Button data-probe="btn-text" type="text">Text</Button>
      <Button data-probe="btn-ghost" ghost type="primary">Ghost</Button>
      <Button data-probe="btn-disabled" disabled>Disabled</Button>
      <Button data-probe="btn-loading" loading>Loading</Button>
      <Button data-probe="btn-icon" icon={<SearchOutlined />}>Icon</Button>
      <Button data-probe="btn-sm-round" size="small" shape="round">Small round</Button>
      <Button data-probe="btn-lg-circle" size="large" shape="circle" icon={<SearchOutlined />} />
      <Tag data-probe="tag">Tag</Tag>
      <Tag data-probe="tag-blue" color="blue">blue</Tag>
      <Tag data-probe="tag-success" color="success">success</Tag>
      <Tag data-probe="tag-closable" closable>closable</Tag>
      <Tag data-probe="tag-bordered-false" bordered={false}>borderless</Tag>
      <Badge data-probe="badge-count" count={5}><Avatar shape="square" icon={<UserOutlined />} /></Badge>
      <Badge data-probe="badge-dot" dot><Avatar shape="square" icon={<UserOutlined />} /></Badge>
      <Badge data-probe="badge-status" status="processing" text="Processing" />
      <Switch data-probe="switch" />
      <Switch data-probe="switch-on" defaultChecked />
      <Switch data-probe="switch-small" size="small" defaultChecked />
      <Switch data-probe="switch-disabled" disabled />
      <Switch data-probe="switch-loading" loading defaultChecked />
      <Checkbox data-probe="checkbox">Checkbox</Checkbox>
      <Checkbox data-probe="checkbox-on" defaultChecked>Checked</Checkbox>
      <Checkbox data-probe="checkbox-ind" indeterminate>Indeterminate</Checkbox>
      <Checkbox data-probe="checkbox-disabled" disabled>Disabled</Checkbox>
      <Radio data-probe="radio">Radio</Radio>
      <Radio data-probe="radio-on" defaultChecked>Checked</Radio>
      <Radio.Button data-probe="radio-button">RadioButton</Radio.Button>
      <Input data-probe="input" placeholder="Input" style={{ width: 160 }} />
      <Input data-probe="input-prefix" prefix={<SearchOutlined />} placeholder="Prefix" style={{ width: 160 }} />
      <Input data-probe="input-error" status="error" placeholder="Error" style={{ width: 160 }} />
      <Input data-probe="input-sm" size="small" placeholder="Small" style={{ width: 160 }} />
      <Input data-probe="input-disabled" disabled placeholder="Disabled" style={{ width: 160 }} />
      <Alert data-probe="alert-info" message="Info" type="info" style={{ width: 280 }} />
      <Alert data-probe="alert-success-icon" message="Success" type="success" showIcon style={{ width: 280 }} />
      <Alert data-probe="alert-error-closable" message="Error" description="Description" type="error" showIcon closable style={{ width: 280 }} />
      <Avatar data-probe="avatar">A</Avatar>
      <Avatar data-probe="avatar-lg-square" size="large" shape="square">B</Avatar>
      <Avatar data-probe="avatar-icon" icon={<UserOutlined />} />
      <Progress data-probe="progress" percent={40} style={{ width: 240 }} />
      <Progress data-probe="progress-success" percent={100} style={{ width: 240 }} />
      <Progress data-probe="progress-exception" percent={60} status="exception" style={{ width: 240 }} />
      <Progress data-probe="progress-circle" type="circle" percent={60} size={64} />
      <Card data-probe="card" title="Card title" size="small" style={{ width: 280 }}>Card body</Card>
      <Card data-probe="card-bordered-false" bordered={false} style={{ width: 280 }}>Borderless</Card>
      <Tooltip data-probe="tooltip" title="Tooltip text" open getPopupContainer={(n) => n.parentElement}><span>Anchor</span></Tooltip>
      <Select data-probe="select" defaultValue="a" options={[{ value: 'a', label: 'Alpha' }]} style={{ width: 120 }} />
      <Table data-probe="table" size="small" pagination={false} columns={[{ title: 'Name', dataIndex: 'n' }, { title: 'Role', dataIndex: 'r' }]} dataSource={[{ key: 1, n: 'Frozen', r: 'Designer' }]} style={{ width: 280 }} />
    </div>
  );
}

const MODE = new URLSearchParams(location.search).get('mode') || 'default';
const THEMES = {
  default: undefined,
  unhashed: { hashed: false },
  cssvar: { cssVar: true, hashed: false },
  cssvarkey: { cssVar: { key: 'antd' }, hashed: false },
  cssvarfont: { cssVar: { key: 'antd' }, hashed: false, token: { fontFamily: 'Roboto, Helvetica, Arial, sans-serif', motion: false } },
};
function App() {
  const theme = THEMES[MODE];
  const wave = MODE === 'cssvarfont' ? { disabled: true } : undefined;
  return <ConfigProvider theme={theme} wave={wave}><Set id={'mode-' + MODE} /></ConfigProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
