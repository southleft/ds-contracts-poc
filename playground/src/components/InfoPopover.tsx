import { useEffect, useRef, type ReactNode } from 'react';

/** Small info glyph — a bordered circle-i, Carbon-simple. */
const INFO_GLYPH = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" />
    <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="4.75" r="0.9" fill="currentColor" />
  </svg>
);

/**
 * ⓘ disclosure popover — native <details> for free keyboard semantics
 * (Enter/Space toggles, focusable summary), plus close-on-outside-click and
 * close-on-Escape. Square corners, bordered panel; never a pill.
 */
export function InfoPopover({
  title,
  align = 'end',
  children,
}: {
  /** Accessible name + hover title for the ⓘ button. */
  title: string;
  /** Which edge the panel hangs from. */
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === 'Escape' && el?.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <details className={`ipop ipop--${align}`} ref={ref}>
      <summary className="ipop__btn" title={title} aria-label={title}>
        {INFO_GLYPH}
      </summary>
      <div className="ipop__panel">{children}</div>
    </details>
  );
}
