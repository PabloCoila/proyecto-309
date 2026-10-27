import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from '@/context/session';
import { ToastProvider } from '@/components/ui/Toast';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el nodo #root');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
