/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon.contract.json (ds.icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { ArrowArcLeft } from '../ArrowArcLeft';
import { Icon } from './Icon';

const meta = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Reusable icon glyph component used inside Altitude controls. Choose the glyph for its meaning and inherit semantic content color. In code, use al-icon and the documented icon catalog. Decorative icons should be hidden from assistive technology; meaningful icon-only actions need an accessible label on their control.\n\nDocumentation: https://altitude.pages.dev/docs/icons/\n\nDocumentation: https://altitude.pages.dev/docs/icons/',
      },
    },
  },
  render: (args) => (
    <Icon {...args}>
      <ArrowArcLeft />
    </Icon>
  ),
  argTypes: {
    children: { control: false },
  },
  args: {},
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
