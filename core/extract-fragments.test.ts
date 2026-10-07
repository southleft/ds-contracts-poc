import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromSource } from './extract-react-tsx.js';
import { tokenIndexFromJson } from './extract-css-module.js';

function extract(body: string) {
  return extractFromSource({
    sourcePath: 'Panel.tsx',
    source: `import type { ReactNode } from 'react';
      import styles from './Panel.module.css';
      interface PanelProps { actions?: ReactNode; children?: ReactNode; enabled?: boolean }
      export function Panel({ actions, children, enabled }: PanelProps) {
        return <article className={styles.root}>${body}</article>;
      }`,
    css: '.root { display: flex; } .header { display: block; } .footer { display: block; }',
  }, () => tokenIndexFromJson([]))[0].anatomy;
}

test('nested shorthand fragments preserve optional slots and sibling order', () => {
  const content = '<header className={styles.header}>Header</header>{children}{actions != null ? <footer className={styles.footer}>{actions}</footer> : null}';
  const plain = extract(content);
  const fragmented = extract('<><header className={styles.header}>Header</header><>{children}<>{actions != null ? <footer className={styles.footer}>{actions}</footer> : null}</></></>');
  assert.deepEqual(fragmented, plain);
  assert.ok(fragmented);
  assert.deepEqual(Object.keys(fragmented.root.parts!), ['header', 'children', 'footer']);
  assert.equal(fragmented.root.parts!.footer.optional, true);
  assert.deepEqual(fragmented.root.parts!.footer.slot, { name: 'actions' });
});

test('fragment traversal retains boolean visibility instead of making content unconditional', () => {
  const anatomy = extract('<>{enabled && <footer className={styles.footer}>{actions}</footer>}</>');
  assert.deepEqual(anatomy?.root.parts?.footer.visibleWhen, { prop: 'enabled' });
});
