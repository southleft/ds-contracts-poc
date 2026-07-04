/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (ds.spinner v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Animated loading indicator for processes of unknown duration. API mirrors industry convention (Astryx Spinner); the size scale needs per-variant icon sizing and the rotation itself is CSS-only — the canvas shows the static arc.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'What is loading — announced to screen readers.' },
  },
  args: {
    label: 'Loading',
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
