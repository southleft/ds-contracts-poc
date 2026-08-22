/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/circle.contract.json (ds.circle v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Circle } from './Circle';

const meta = {
  title: 'Components/Circle',
  component: Circle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "circle" instances of _Button base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {},
  args: {},
} satisfies Meta<typeof Circle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
