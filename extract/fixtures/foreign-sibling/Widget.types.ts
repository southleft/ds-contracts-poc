/**
 * FIXTURE: the sibling type file (`<X>.types.ts` convention). Holds an alias
 * behind the size axis (one-hop resolution must still work through the merged
 * table) and an intersection with one UNREADABLE generic member —
 * `ComponentProps<WidgetSlots>` — which must be receipted by name, its
 * members never guessed.
 */
import type { ComponentProps } from './fake-utilities';

export type WidgetSlots = {
  root: unknown;
  icon?: unknown;
};

export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetProps = ComponentProps<WidgetSlots> & {
  /** Emphasis of the widget. */
  appearance?: 'primary' | 'outline' | 'subtle';
  /** Disable interaction. */
  disabled?: boolean;
  /** A widget supports different sizes. */
  size?: WidgetSize;
};
