import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadRecaptchaScript } from '@/infrastructure/recaptcha';
import './index.css';

// Precargamos el script de reCAPTCHA apenas arranca la app. Es no-op si
// VITE_RECAPTCHA_ENABLED está en `false`. El catch evita un rechazo no
// manejado: si falla, getRecaptchaToken() reintenta al momento de enviar.
void loadRecaptchaScript().catch(() => undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
