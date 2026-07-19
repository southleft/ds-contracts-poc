/**
 * journey-engineer eval entry — copied into the eval's work dir (the
 * storybook-skeleton copy), bundled by esbuild and rendered in the
 * real-browser harness. This is the eval's stand-in for Storybook's own
 * story rendering: the dev server / static build is deliberately NOT run
 * (see evals/fixtures/storybook-skeleton/README.md). It imports the story
 * module the CLI just emitted (CSF: default meta + named stories) and
 * renders the Playground story twice — default args, and size="small" —
 * so computed styles can be checked against the Figma ground truth on
 * both sides of the tokensByProp carry.
 *
 * NOT typechecked by the root tsc (evals/fixtures is excluded): the
 * imported module only exists after the eval's generate step.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import * as csf from './src/generated/ButtonBrandPrimary/ButtonBrandPrimary.stories';

interface Meta {
  component?: (props: Record<string, unknown>) => unknown;
  title?: string;
  args?: Record<string, unknown>;
}
interface Story {
  args?: Record<string, unknown>;
}

const mod = csf as unknown as Record<string, Story> & { default?: Meta };
const meta = mod.default;
if (!meta || !meta.component) throw new Error('CSF meta missing default export with a component');
const stories = Object.keys(mod).filter((k) => k !== 'default');
const playground = mod['Playground'];
if (!playground) throw new Error('emitted stories carry no Playground story: ' + stories.join(','));

function render(rootId: string, extra: Record<string, unknown>): void {
  const host = document.getElementById(rootId);
  if (!host) throw new Error('missing host element ' + rootId);
  createRoot(host).render(
    createElement(meta!.component as never, { ...(meta!.args ?? {}), ...(playground.args ?? {}), ...extra }),
  );
}

render('root-default', {});
render('root-small', { size: 'small' });
(window as unknown as { __CSF__: unknown }).__CSF__ = { title: meta.title, stories };
