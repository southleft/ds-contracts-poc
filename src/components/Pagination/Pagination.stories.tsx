/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/pagination.contract.json (ds.pagination v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pagination } from './Pagination';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Steps through pages of content, below a table or list. API mirrors industry convention (Astryx Pagination) with three display variants; page math and click behavior are declared boundaries — the pages variant shows a representative trail.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['pages', 'compact', 'dots'],
      description: 'Numbered trail, compact page label, or dot indicators.',
    },
    pageLabel: { control: 'text', description: "The compact variant's label text." },
    label: { control: 'text', description: 'Accessible label for the navigation landmark.' },
  },
  args: {
    variant: 'pages',
    pageLabel: 'Page 2 of 10',
    label: 'Pagination',
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Pages: Story = {
  args: { variant: 'pages' },
};

export const Compact: Story = {
  args: { variant: 'compact' },
};

export const Dots: Story = {
  args: { variant: 'dots' },
};
/** Every legal combination the contract defines. */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(1, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Pagination variant="pages" label="Pagination" />
      <Pagination variant="compact" label="Pagination" />
      <Pagination variant="dots" label="Pagination" />
    </div>
  ),
};
