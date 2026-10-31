import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support and real-time updates
try {
  const updateSW = registerSW({ 
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nova versão detectada pelo Service Worker!');
      window.dispatchEvent(new CustomEvent('app-update-available', { 
        detail: { type: 'sw-update' } 
      }));
    },
    onOfflineReady() {
      console.log('[PWA] Recursos armazenados para uso offline.');
    },
    onRegistered(swRegistration) {
      console.log('SW Registered:', swRegistration);
      if (swRegistration) {
        // Regularly check for Service Worker updates every 30 seconds
        setInterval(() => {
          swRegistration.update().catch(() => {});
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW Registration Error:', error);
    }
  });

  (window as any).__updateSW = updateSW;
} catch (e) {
  console.warn('PWA Registration skipped or failed:', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
