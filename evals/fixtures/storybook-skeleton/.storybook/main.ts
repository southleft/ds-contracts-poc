import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Smallest viable Storybook config for ds-contracts output:
 * `ds-contracts generate <contracts..> --out src/generated --stories`
 * lands *.stories.tsx files that this glob picks up unchanged.
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
