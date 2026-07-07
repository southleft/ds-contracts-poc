import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Dashboard chrome: Tailwind v4 + shadcn theme variables.
import './index.css';
// The design system UNDER INSPECTION: its token custom properties power the
// live component samples (and flip with [data-theme]).
import '../../src/styles/tokens.css';
import '../../src/styles/tokens.dark.css';
import '../../src/styles/tokens.brands.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Contract Hub: #root element not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
