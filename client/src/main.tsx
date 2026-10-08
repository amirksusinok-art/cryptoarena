import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { MarketProvider } from './context/MarketContext.js';
import { TradeProvider } from './context/TradeContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <MarketProvider>
        <TradeProvider>
          <App />
        </TradeProvider>
      </MarketProvider>
    </AuthProvider>
  </React.StrictMode>
);
