import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/tokens.dark.css';
import './app.css';
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
