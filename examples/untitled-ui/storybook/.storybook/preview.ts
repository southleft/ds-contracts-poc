import type { Preview } from '@storybook/react-vite';
// The design system's CSS custom properties. A placeholder ships with the
// skeleton; a real project (and the journey-engineer eval) writes this file
// from its token sources so the generated components' var() refs resolve.
import '../src/tokens.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
