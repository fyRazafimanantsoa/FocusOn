import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely intercept and ignore HMR websocket/Vite connection failures in preview sandbox
if (typeof window !== 'undefined') {
  const handleBenignRejection = (event: PromiseRejectionEvent) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (
      msg.toLowerCase().includes('websocket') || 
      msg.toLowerCase().includes('vite') || 
      msg.toLowerCase().includes('hmr')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleBenignError = (event: ErrorEvent) => {
    const msg = String(event.message || '');
    if (
      msg.toLowerCase().includes('websocket') || 
      msg.toLowerCase().includes('vite') || 
      msg.toLowerCase().includes('hmr')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener('unhandledrejection', handleBenignRejection, true);
  window.addEventListener('error', handleBenignError, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
