import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { RouterProvider } from './router';

const container = document.getElementById('root');
if (!container) throw new Error('Contract Playground: #root element not found');

createRoot(container).render(
  <StrictMode>
    <RouterProvider>
      <App />
    </RouterProvider>
  </StrictMode>,
);
