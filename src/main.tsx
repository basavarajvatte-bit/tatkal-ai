import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startClock } from './lib/clock';
import './styles.css';

startClock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('/sw.js').catch(() => {});
  });
}
