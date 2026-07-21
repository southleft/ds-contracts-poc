import type { Preview } from '@storybook/react-vite';
// Astryx StyleX tokens as CSS custom properties (light :root + a dark
// override), built from examples/astryx/tokens/*.dtcg.json by
// ../scripts/build-storybook-tokens.ts. The generated components reference
// these as var(--color-*, --spacing-*, …), so they resolve at render.
import '../src/tokens.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: {
      default: 'astryx-body',
      values: [{ name: 'astryx-body', value: '#F1F4F7' }],
    },
  },
};

export default preview;
