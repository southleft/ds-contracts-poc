/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The system\'s action control. It renders a real `<button>` — or an `<a role="button">` when `href` is set — so the element the user actually gets, and the keyboard behaviour that comes with it, follows the props rather than the styling. Everything else about a button is ranking: `variant` says how much weight this action carries against the others on screen.\n\nTag: al-button\n\nProps\n- isDisabled: boolean — Disabled attribute\n- isPill: boolean — Pill shape\n- label — Indicates the aria label to apply to the button.\n- size: sm | lg — Size variant\n  - omitted: renders the default 40px control with 14px text\n- variant: neutral | bare | secondary | tertiary — Style variant — an EMPHASIS axis, strongest to weakest.\n  - default: renders the primary button, the strongest emphasis\n\nSlots\n- (default) — The button text content.\n- after — Content to display after the button text, typically an icon.\n- before — Content to display before the button text, typically an icon.\n\nAccessibility\n- element: <button>\n\nDocs: https://altitude.pages.dev/docs/components/button/\n\nDocumentation: https://altitude.pages.dev/docs/components/button/',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'bare', 'neutral', 'secondary', 'tertiary'],
    },
    size: { control: 'select', options: ['md', 'sm', 'lg'] },
    shape: { control: 'select', options: ['default', 'pill'] },
    text: { control: 'text' },
    slotBefore: { control: 'boolean' },
    slotAfter: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    shape: 'default',
    text: 'Button',
    slotBefore: false,
    slotAfter: false,
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Bare: Story = {
  args: { variant: 'bare' },
};

export const Neutral: Story = {
  args: { variant: 'neutral' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Tertiary: Story = {
  args: { variant: 'tertiary' },
};
export const Disabled: Story = {
  args: { disabled: true },
};
/** Every legal combination the contract defines (variant × size × shape). */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(6, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      <Button variant="primary" size="md" shape="default" />
      <Button variant="primary" size="md" shape="pill" />
      <Button variant="primary" size="sm" shape="default" />
      <Button variant="primary" size="sm" shape="pill" />
      <Button variant="primary" size="lg" shape="default" />
      <Button variant="primary" size="lg" shape="pill" />
      <Button variant="bare" size="md" shape="default" />
      <Button variant="bare" size="md" shape="pill" />
      <Button variant="bare" size="sm" shape="default" />
      <Button variant="bare" size="sm" shape="pill" />
      <Button variant="bare" size="lg" shape="default" />
      <Button variant="bare" size="lg" shape="pill" />
      <Button variant="neutral" size="md" shape="default" />
      <Button variant="neutral" size="md" shape="pill" />
      <Button variant="neutral" size="sm" shape="default" />
      <Button variant="neutral" size="sm" shape="pill" />
      <Button variant="neutral" size="lg" shape="default" />
      <Button variant="neutral" size="lg" shape="pill" />
      <Button variant="secondary" size="md" shape="default" />
      <Button variant="secondary" size="md" shape="pill" />
      <Button variant="secondary" size="sm" shape="default" />
      <Button variant="secondary" size="sm" shape="pill" />
      <Button variant="secondary" size="lg" shape="default" />
      <Button variant="secondary" size="lg" shape="pill" />
      <Button variant="tertiary" size="md" shape="default" />
      <Button variant="tertiary" size="md" shape="pill" />
      <Button variant="tertiary" size="sm" shape="default" />
      <Button variant="tertiary" size="sm" shape="pill" />
      <Button variant="tertiary" size="lg" shape="default" />
      <Button variant="tertiary" size="lg" shape="pill" />
    </div>
  ),
};
