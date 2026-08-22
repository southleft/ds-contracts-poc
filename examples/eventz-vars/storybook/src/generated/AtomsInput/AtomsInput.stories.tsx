/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-input.contract.json (ds.atoms-input v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { IconsPlaceholder } from '../IconsPlaceholder';
import { AtomsInput } from './AtomsInput';

const meta = {
  title: 'Components/AtomsInput',
  component: AtomsInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.',
      },
    },
  },
  argTypes: {
    isFilled: { control: 'boolean' },
    hasError: { control: 'boolean' },
    isDisabled: { control: 'boolean' },
    content: { control: 'text' },
    hasLabel: { control: 'boolean' },
    hasStartIcon: { control: 'boolean' },
    hasEndIcon: { control: 'boolean' },
    hasHint: { control: 'boolean' },
    startIcon: { control: false },
    endIcon: { control: false },
  },
  args: {
    isFilled: false,
    hasError: false,
    isDisabled: false,
    content: 'Input content',
    hasLabel: true,
    hasStartIcon: false,
    hasEndIcon: false,
    hasHint: true,
  },
} satisfies Meta<typeof AtomsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "startIcon" slot accepts: anything. */
export const WithStartIcon: Story = {
  render: (args) => (
    <AtomsInput
      {...args}
      startIcon={
        <>
          <IconsPlaceholder size="20" />
        </>
      }
    />
  ),
};
/** The "endIcon" slot accepts: anything. */
export const WithEndIcon: Story = {
  render: (args) => (
    <AtomsInput
      {...args}
      endIcon={
        <>
          <IconsPlaceholder size="20" />
        </>
      }
    />
  ),
};
