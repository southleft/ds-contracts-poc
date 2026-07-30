/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/help-icon.contract.json (ds.help-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpIcon } from './HelpIcon';

const meta = {
  title: 'Components/HelpIcon',
  component: HelpIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Help icon" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    open: { control: 'select', options: ['false'] },
    supportingText: { control: 'select', options: ['false'] },
    tooltip: { control: 'select', options: ['topArrow'] },
  },
  args: {
    open: 'false',
    supportingText: 'false',
    tooltip: 'topArrow',
  },
} satisfies Meta<typeof HelpIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const False: Story = {
  args: { open: 'false' },
};
/** Every legal combination the contract defines (open × supportingText × tooltip). */
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
      <HelpIcon open="false" supportingText="false" tooltip="topArrow" />
    </div>
  ),
};
