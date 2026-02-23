import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import { BrowserRouter } from 'react-router-dom';
import '@/styles/index.css';
import '@/styles/responsive-auto-clean.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
