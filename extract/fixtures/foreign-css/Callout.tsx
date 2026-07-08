// FIXTURE: a "foreign" component styled with plain CSS — literal colors and
// px values, an unresolvable css var, a data-attribute variant hook, and a
// tailwind-ish string className — to prove anatomy extraction DEGRADES BY
// NAME on code this repo's generator never emitted: extract what is legible
// (structure, slots, content bindings), report the rest per declaration,
// and NEVER turn a raw value into an invented token.
import styles from './Callout.module.css';

interface CalloutProps {
  /** Callout heading text. */
  heading: string;
  tone?: 'info' | 'warning';
  children?: React.ReactNode;
}

export function Callout({ heading, tone = 'info', children }: CalloutProps) {
  return (
    <section className={styles.root} data-tone={tone}>
      <h3 className={styles.heading}>{heading}</h3>
      <span className="badge badge--soft">beta</span>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
