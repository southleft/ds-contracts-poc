import React from 'react';
import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/tokens.dark.css';
import '../src/styles/tokens.brands.css';
import './preview.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Design token mode',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
    brand: {
      description:
        'Brand mode — tokens/modes/brand.*.tokens.json. Two orthogonal dimensions: theme picks the step, brand picks the ramp.',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: ['default', 'aurora'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', brand: 'default' },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      document.documentElement.dataset.brand = context.globals.brand;
      return <Story />;
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
