import type { Preview } from '@storybook/react-vite';
// The design system's CSS custom properties — built from the kit's committed
// DTCG trees (captured + minted) by examples/eventz-vars/tokens-css.mts, so
// the generated components' var() refs resolve.
import '../src/tokens.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
