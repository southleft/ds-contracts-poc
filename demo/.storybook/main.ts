import type { StorybookConfig } from '@storybook/react-vite';

/**
 * STORYBOOK FOR THE LIVE DEMO — a config the demo owns, NOT a change to the
 * repo's own Storybook.
 *
 * `demo/generated` holds the components the second beat inverts back out of
 * Figma (see parity/receipts/beta/LIVE-DEMO.md). They cannot be folded into
 * the root `.storybook` glob: several of them are named for the same
 * components this repo already ships from `src` (Kbd, Label, HelperText,
 * ToggleSwitch), and the generator titles every story `Components/<Name>`, so
 * one merged index dies on `Duplicate stories with id: components-kbd--playground`.
 * Fixing THAT would mean changing generated story titles — a product change
 * for a demo's benefit, which is the wrong trade.
 *
 * Run it with:  npm run storybook -- -c demo/.storybook -p 6007
 */
const config: StorybookConfig = {
  stories: ['../generated/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;
