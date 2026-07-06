// FIXTURE: the shadcn-era convention — cva variants + VariantProps
// intersection + an inline literal member. Also one deliberately
// unreadable component (props composed from an imported type) to prove
// unextractable components are REPORTED, never silently dropped.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ExternalProps } from './does-not-exist';

const tagVariants = cva('tag', {
  variants: {
    intent: {
      neutral: 'tag--neutral',
      brand: 'tag--brand',
      danger: 'tag--danger',
    },
    density: {
      cozy: 'tag--cozy',
      compact: 'tag--compact',
    },
  },
  defaultVariants: { intent: 'neutral', density: 'cozy' },
});

export function Tag({
  intent,
  density,
  interactive = false,
  ...rest
}: React.ComponentProps<'span'> & VariantProps<typeof tagVariants> & { interactive?: boolean }) {
  return <span className={tagVariants({ intent, density })} data-interactive={interactive} {...rest} />;
}

export function Opaque(props: ExternalProps) {
  return <div data-opaque {...props} />;
}
