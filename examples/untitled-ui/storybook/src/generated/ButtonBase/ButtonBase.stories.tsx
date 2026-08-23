/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-base.contract.json (ds.button-base v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ButtonBase } from './ButtonBase';

const meta = {
  title: 'Components/ButtonBase',
  component: ButtonBase,
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
    size: { control: 'select', options: ['md', 'lg', 'xl', 'sm'] },
    icon: { control: 'select', options: ['leading', 'only', 'false', 'trailing', 'dot'] },
  },
  args: {
    size: 'md',
    icon: 'leading',
  },
} satisfies Meta<typeof ButtonBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Md: Story = {
  args: { size: 'md' },
};

export const Lg: Story = {
  args: { size: 'lg' },
};

export const Xl: Story = {
  args: { size: 'xl' },
};

export const Sm: Story = {
  args: { size: 'sm' },
};
/** Every legal combination the contract defines (size × icon). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(5, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <ButtonBase size="md" icon="leading" />
      <ButtonBase size="md" icon="only" />
      <ButtonBase size="md" icon="false" />
      <ButtonBase size="md" icon="trailing" />
      <ButtonBase size="md" icon="dot" />
      <ButtonBase size="lg" icon="leading" />
      <ButtonBase size="lg" icon="only" />
      <ButtonBase size="lg" icon="false" />
      <ButtonBase size="lg" icon="trailing" />
      <ButtonBase size="lg" icon="dot" />
      <ButtonBase size="xl" icon="leading" />
      <ButtonBase size="xl" icon="only" />
      <ButtonBase size="xl" icon="false" />
      <ButtonBase size="xl" icon="trailing" />
      <ButtonBase size="xl" icon="dot" />
      <ButtonBase size="sm" icon="leading" />
      <ButtonBase size="sm" icon="only" />
      <ButtonBase size="sm" icon="false" />
      <ButtonBase size="sm" icon="trailing" />
      <ButtonBase size="sm" icon="dot" />
    </div>
  ),
};
