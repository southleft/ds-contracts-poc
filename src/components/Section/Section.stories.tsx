/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/section.contract.json (ds.section v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from './Section';

const meta = {
  title: 'Components/Section',
  component: Section,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The standard way to create page regions and group related content — settings groups, form sections, sidebar areas. API mirrors industry convention (Astryx Section) at the variant level; the transparent variant needs transparent color tokens — a documented gap.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['section', 'muted'],
      description: 'Background treatment. Muted only to call attention.',
    },
    children: { control: 'text' },
  },
  args: {
    variant: 'section',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SectionVariant: Story = {
  args: { variant: 'section' },
};

export const Muted: Story = {
  args: { variant: 'muted' },
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
      <Section variant="section">Section</Section>
      <Section variant="muted">Section</Section>
    </div>
  ),
};
