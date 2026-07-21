import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Astryx dev-journey Storybook. The ds-contracts CLI lands
 * `*.stories.tsx` under src/generated/ (see the fixture's `generate`
 * script); this glob picks them up unchanged — the same layout the
 * journey-engineer eval and evals/fixtures/storybook-skeleton pin.
 */
const config: StorybookConfig = {
  stories: ['../src/generated/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
