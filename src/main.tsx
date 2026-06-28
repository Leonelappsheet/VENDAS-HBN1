import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support safely
try {
  registerSW({ 
    immediate: true,
    onRegistered(swRegistration) {
      console.log('SW Registered:', swRegistration);
    },
    onRegisterError(error) {
      console.error('SW Registration Error:', error);
    }
  });
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
