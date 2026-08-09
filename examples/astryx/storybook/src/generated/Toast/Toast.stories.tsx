/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toast.contract.json (astryx.toast v0.2.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Toast } from './Toast';

const meta = {
  title: 'Components/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "PROMOTED from the Phase B composition-tier extraction (round 2, wrapper-ref descent) — the vendor-refereed exhibit: Astryx's own Toast.doc.mjs declares anatomy Body / End content / Dismiss button, and the extraction recovered exactly those three (body slot, endContent slot, ghost dismiss astryx.button with its real props) once the MediaTheme wrapper descended. Curation receipts: (1) the MediaTheme theme-provider ref was dropped and its interior lifted to the root (a theme boundary is a code mechanism, not anatomy); (2) the extracted behavioral props (isAutoHide/autoHideDuration/isExiting) are timing mechanics with no visual projection — dropped from the exhibit, receipted here; (3) root keeps the extracted StyleX token bindings verbatim (padding, radius, shadow, body typography).",
      },
    },
  },
  argTypes: {
    body: {
      control: 'text',
      description: "The toast's primary message content (vendor anatomy: Body, required).",
    },
    endContent: { control: false },
  },
  args: {
    body: 'Saved successfully',
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "endContent" slot accepts: astryx.button. */
export const WithEndContent: Story = {
  render: (args) => <Toast {...args} endContent={<Button label="Button" />} />,
};
