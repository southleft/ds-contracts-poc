/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-2.contract.json (ds.tab-2 v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Tab } from './Tab';

const meta = {
  title: 'Components/Tab',
  component: Tab,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Tab" instances of Tabs — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    text: { control: 'text' },
    state: { control: 'select', options: ['default'] },
    active: { control: 'select', options: ['yes', 'no'] },
  },
  args: {
    text: 'Tab label',
    state: 'default',
    active: 'yes',
  },
} satisfies Meta<typeof Tab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Default: Story = {
  args: { state: 'default' },
};
/** Every legal combination the contract defines (state × active). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Tab state="default" active="yes" />
      <Tab state="default" active="no" />
    </div>
  ),
};
