/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-panel.contract.json (ds.tab-panel v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { TabPanel } from './TabPanel';

const meta = {
  title: 'Components/TabPanel',
  component: TabPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tag: al-tab-panel\n\nSlots\n- (default) — The tab panel content\n\nAccessibility\n- element: <div>\n\nDocs: https://altitude.pages.dev/docs/components/tab-panel/\n\nDocumentation: https://altitude.pages.dev/docs/components/tab-panel/',
      },
    },
  },
  argTypes: {},
  args: {},
} satisfies Meta<typeof TabPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
