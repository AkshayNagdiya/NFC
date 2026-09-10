import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './routes/router';
import { applyTheme, useUiStore } from './stores/uiStore';

const qc = new QueryClient();
applyTheme(useUiStore.getState().theme);

// Offline-first kiosk: cache the app shell so /scanner loads with no network.
// Queue flush still happens in-tab (auth token lives in memory, not in the SW).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
