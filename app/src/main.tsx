import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { AuthProvider } from './auth/AuthContext';
import { authService } from './auth/service';
import './styles/bushido/index.css';
import './styles/app.css';
import './ops/ops.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider service={authService}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
