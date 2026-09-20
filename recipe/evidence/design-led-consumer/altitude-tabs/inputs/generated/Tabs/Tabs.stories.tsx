/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (ds.tabs v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tag: al-tabs\n\nProps\n- variant — Tabs variant\n  - default: Tabs are left-aligned, and the width of each tab is defined by the length of its content\n  - stretch: Tabs stretch horizontally to have equal widths, which is calculated by the width of the screen divided by the number of tabs\n\nSlots\n- (default) — The tab items for the tabs\n- panel — The tab panels that correspond to the slotted tab items\n\nAccessibility\n- element: <div>\n- key ArrowRight: Activates the next tab.\n- key ArrowLeft: Activates the previous tab.\n- key Home: Activates the first tab.\n- key End: Activates the last tab.\n- focus: Roving focus across the tab list: the arrow keys move focus and activation together, so the list is a single tab stop and the panel is the next one.\n\nDocs: https://altitude.pages.dev/docs/components/tabs/\n\nDocumentation: https://altitude.pages.dev/docs/components/tabs/',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['default', 'stretch'] },
    items: { control: false },
  },
  args: {
    variant: 'default',
    items: [{ text: 'Tab label' }, { text: 'Tab label' }, { text: 'Tab label' }],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { variant: 'default' },
};

export const Stretch: Story = {
  args: { variant: 'stretch' },
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
      <Tabs variant="default" />
      <Tabs variant="stretch" />
    </div>
  ),
};
