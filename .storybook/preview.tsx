import React from 'react';
import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/tokens.dark.css';
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
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
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
