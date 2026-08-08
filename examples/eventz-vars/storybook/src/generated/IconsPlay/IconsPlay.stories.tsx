/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icons-play.contract.json (ds.icons-play v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconsPlay } from './IconsPlay';

const meta = {
  title: 'Components/IconsPlay',
  component: IconsPlay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Icons/Play" instances of Atoms/Button — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['20'] },
  },
  args: {
    size: '20',
  },
} satisfies Meta<typeof IconsPlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Size20: Story = {
  args: { size: '20' },
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
      <IconsPlay size="20" />
    </div>
  ),
};
