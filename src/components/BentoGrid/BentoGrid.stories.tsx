/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/bento-grid.contract.json (ds.bento-grid v1.0.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { BentoGrid } from './BentoGrid';

const meta = {
  title: 'Components/BentoGrid',
  component: BentoGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The span matrix (G2) addressed through named areas (G4): a 3x4 bento whose five regions span rows and columns and whose area names ARE the slot anchors. Mixed px/fr tracks on both axes and independent row/column gaps.',
      },
    },
  },
  argTypes: {
    header: { control: false },
    sidebar: { control: false },
    main: { control: false },
    rail: { control: false },
    footer: { control: false },
  },
  args: {},
} satisfies Meta<typeof BentoGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
