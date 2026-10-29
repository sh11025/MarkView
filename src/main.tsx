import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/app.css';
import './styles/document.css';
import { App } from './app/App';
import { setupPwa } from './app/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPwa();
