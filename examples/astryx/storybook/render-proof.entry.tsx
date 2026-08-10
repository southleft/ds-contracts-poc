/**
 * Astryx dev-journey render proof — the entry bundled (esbuild) and rendered
 * in the real-browser harness by ../scripts/render-proof.ts.
 *
 * This is the self-contained stand-in for a full Storybook boot (which needs
 * a network install): it imports EVERY generated CSF story module the CLI
 * emitted, renders each component's Playground story into its own host, and
 * exposes the CSF metas on window so the driver can assert titles + that each
 * component actually mounted with the StyleX token styling applied.
 *
 * Not typechecked by the root tsc (examples/astryx/storybook/src/generated
 * only exists after `generate`); bundled with jsx:automatic.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import * as badge from './src/generated/Badge/Badge.stories';
import * as banner from './src/generated/Banner/Banner.stories';
import * as button from './src/generated/Button/Button.stories';
import * as card from './src/generated/Card/Card.stories';
import * as checkbox from './src/generated/CheckboxInput/CheckboxInput.stories';
import * as progress from './src/generated/ProgressBar/ProgressBar.stories';
import * as slider from './src/generated/Slider/Slider.stories';
import * as toggle from './src/generated/Switch/Switch.stories';
import * as textInput from './src/generated/TextInput/TextInput.stories';
import * as token from './src/generated/Token/Token.stories';

interface Meta {
  component?: (props: Record<string, unknown>) => unknown;
  title?: string;
  args?: Record<string, unknown>;
}
interface Story {
  args?: Record<string, unknown>;
}
type Module = Record<string, Story> & { default?: Meta };

const modules: Array<{ key: string; mod: Module }> = [
  { key: 'badge', mod: badge as unknown as Module },
  { key: 'banner', mod: banner as unknown as Module },
  { key: 'button', mod: button as unknown as Module },
  { key: 'card', mod: card as unknown as Module },
  { key: 'checkbox', mod: checkbox as unknown as Module },
  { key: 'progress', mod: progress as unknown as Module },
  { key: 'slider', mod: slider as unknown as Module },
  { key: 'toggle', mod: toggle as unknown as Module },
  { key: 'textInput', mod: textInput as unknown as Module },
  { key: 'token', mod: token as unknown as Module },
];

const csf: Record<string, { title?: string; stories: string[] }> = {};

for (const { key, mod } of modules) {
  const meta = mod.default;
  if (!meta || !meta.component) throw new Error(`${key}: CSF meta missing default export with a component`);
  const stories = Object.keys(mod).filter((k) => k !== 'default');
  const playground = mod['Playground'] ?? mod[stories[0]];
  csf[key] = { title: meta.title, stories };

  const host = document.createElement('div');
  host.id = `host-${key}`;
  host.setAttribute('data-component', key);
  document.body.appendChild(host);
  createRoot(host).render(
    createElement(meta.component as never, { ...(meta.args ?? {}), ...(playground?.args ?? {}) }),
  );
}

// ONE EXTRA HOST, MOUNTED FROM A REAL STORY.
//
// The token spot-check used to take the Playground button (whose meta args pin
// `variant: 'secondary'`) and REWRITE its className to `variant-primary`, then
// read the computed background in the SAME TASK. That silently stopped
// measuring what it claimed: the emitted `.root` now carries
// `transition-duration: 0.175s` on `background-color`, so a synchronous read
// after a class swap returns the colour the button is transitioning FROM — the
// secondary value. It reported the right answer for one commit only because the
// generated CSS carried no transition when the receipt was first shot.
//
// `Button.stories.tsx` already exports `Primary` with `args: { variant:
// 'primary' }`. Mounting it is simpler and honest: no string munging, no
// dependence on a hashed class name surviving a regex, and nothing to go stale
// when the emitter changes how variants are spelled.
const primaryStory = (button as unknown as Module)['Primary'];
if (button.default?.component && primaryStory) {
  const host = document.createElement('div');
  host.id = 'host-button-primary';
  host.setAttribute('data-component', 'button-primary');
  document.body.appendChild(host);
  createRoot(host).render(
    createElement(button.default.component as never, {
      ...(button.default.args ?? {}),
      ...(primaryStory.args ?? {}),
    }),
  );
}

(window as unknown as { __ASTRYX_CSF__: unknown }).__ASTRYX_CSF__ = csf;
