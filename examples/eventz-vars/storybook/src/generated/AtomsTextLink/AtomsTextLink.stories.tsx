/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-text-link.contract.json (ds.atoms-text-link v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtomsTextLink } from './AtomsTextLink';

const meta = {
  title: 'Components/AtomsTextLink',
  component: AtomsTextLink,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Atoms/Text Link" instances of Molecules/Alert — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    hasStartIcon: { control: 'boolean' },
    hasEndIcon: { control: 'boolean' },
    text: { control: 'text' },
    emphasis: { control: 'select', options: ['inverted'] },
    state: { control: 'select', options: ['default'] },
  },
  args: {
    hasStartIcon: false,
    hasEndIcon: false,
    text: 'Label',
    emphasis: 'inverted',
    state: 'default',
  },
} satisfies Meta<typeof AtomsTextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Inverted: Story = {
  args: { emphasis: 'inverted' },
};
/** Every legal combination the contract defines (emphasis × state). */
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
      <AtomsTextLink emphasis="inverted" state="default" />
    </div>
  ),
};
