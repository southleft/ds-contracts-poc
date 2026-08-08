/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/page-shell.contract.json (ds.page-shell v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidebarLayout } from '../SidebarLayout';
import { TwoColumn } from '../TwoColumn';
import { PageShell } from './PageShell';

const meta = {
  title: 'Components/PageShell',
  component: PageShell,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Composition of compositions: header/aside/main/footer named areas (G4) whose slots accept the other layout contracts. The main slot's accepts list is the nested-composition constraint.",
      },
    },
  },
  argTypes: {
    header: { control: false },
    aside: { control: false },
    main: { control: false },
    footer: { control: false },
  },
  args: {},
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "aside" slot accepts: ds.sidebar-layout. */
export const WithAside: Story = {
  render: (args) => <PageShell {...args} aside={<SidebarLayout />} />,
};
/** The "main" slot accepts: ds.two-column, ds.sidebar-layout, ds.grid-gallery, ds.bento-grid. */
export const WithMain: Story = {
  render: (args) => <PageShell {...args} main={<TwoColumn />} />,
};
/** The "footer" slot accepts: ds.two-column. */
export const WithFooter: Story = {
  render: (args) => <PageShell {...args} footer={<TwoColumn />} />,
};
