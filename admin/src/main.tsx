import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { EnvProvider } from './context/EnvContext';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EnvProvider>
          <App />
        </EnvProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
