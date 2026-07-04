/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/breadcrumbs.contract.json (ds.breadcrumbs v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BreadcrumbItem } from '../BreadcrumbItem';
import { Breadcrumbs } from './Breadcrumbs';

const meta = {
  title: 'Components/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Navigation trail from root to the current page. API mirrors industry convention (Astryx Breadcrumbs): a nav landmark holding BreadcrumbItems; keep trails to five levels or fewer.',
      },
    },
  },
  render: (args) => (
    <Breadcrumbs {...args}>
      <BreadcrumbItem label="Home" />
      <BreadcrumbItem label="Components" />
      <BreadcrumbItem label="ProgressBar" />
    </Breadcrumbs>
  ),
  argTypes: {
    label: { control: 'text', description: 'Accessible label for the navigation landmark.' },
    children: { control: false },
  },
  args: {
    label: 'Breadcrumb',
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
