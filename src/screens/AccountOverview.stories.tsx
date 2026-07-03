import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountOverview } from './AccountOverview';

const meta = {
  title: 'Screens/Account Overview',
  component: AccountOverview,
  parameters: {
    docs: {
      description: {
        component:
          'A full page assembled by a catalog-constrained agent during the adherence eval — every element from the catalog, judged 100/100 (`npm run judge -- src/screens/AccountOverview.tsx`). The header cells exist here because the agent reported the gap and the contract was promoted (ds.table-row v1.1.0).',
      },
    },
  },
} satisfies Meta<typeof AccountOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
