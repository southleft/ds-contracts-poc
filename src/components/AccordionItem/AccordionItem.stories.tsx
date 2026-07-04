/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/accordion-item.contract.json (ds.accordion-item v1.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccordionItem } from './AccordionItem';

const meta = {
  title: 'Components/AccordionItem',
  component: AccordionItem,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible content row: trigger with a state chevron, content revealed when open. API mirrors industry convention (Astryx Collapsible) with the open state flattened to a closed/open enum so both surfaces render both states; the toggle itself is contract-declared (onToggle + aria-expanded, generated); richer behavior stays a declared boundary.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['closed', 'open'],
      description:
        'Closed shows only the trigger; open reveals the content and rotates the chevron.',
    },
    title: { control: 'text', description: 'The always-visible trigger text.' },
    onToggle: {
      control: false,
      description:
        'Fires when the trigger is activated; uncontrolled instances flip state closed/open themselves.',
    },
    children: { control: 'text' },
  },
  args: {
    title: 'Section title',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof AccordionItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Closed: Story = {
  args: { state: 'closed' },
};

export const Open: Story = {
  args: { state: 'open' },
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
      <AccordionItem state="closed" title="Section title">
        AccordionItem
      </AccordionItem>
      <AccordionItem state="open" title="Section title">
        AccordionItem
      </AccordionItem>
    </div>
  ),
};
