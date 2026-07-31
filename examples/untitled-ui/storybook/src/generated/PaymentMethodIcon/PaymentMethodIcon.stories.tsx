/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/payment-method-icon.contract.json (ds.payment-method-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PaymentMethodIcon } from './PaymentMethodIcon';

const meta = {
  title: 'Components/PaymentMethodIcon',
  component: PaymentMethodIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'STUB contract auto-proposed for the nested "Payment method icon" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm'] },
    paymentMethod: { control: 'select', options: ['mastercard'] },
  },
  args: {
    size: 'sm',
    paymentMethod: 'mastercard',
  },
} satisfies Meta<typeof PaymentMethodIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sm: Story = {
  args: { size: 'sm' },
};
/** Every legal combination the contract defines (size × paymentMethod). */
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
      <PaymentMethodIcon size="sm" paymentMethod="mastercard" />
    </div>
  ),
};
