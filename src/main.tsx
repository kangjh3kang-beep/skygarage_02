import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import App from './App';
import { domainDestination } from './lib/domain-routing';
const destination = domainDestination(window.location.hostname, window.location.pathname, import.meta.env.VITE_OFFICIAL_APP_ORIGIN);
if (destination) window.location.replace(destination + window.location.search + window.location.hash);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
