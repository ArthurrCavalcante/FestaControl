import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { CompanyProvider } from './contexts/CompanyContext';
import { Sentry, sentryEnabled } from './observability';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import PublicProposal from './components/PublicProposal';
import InviteAcceptance from './components/InviteAcceptance';
import ProductPage from './components/ProductPage';

const app = (
  <BrowserRouter>
    <CompanyProvider>
      <Routes>
        <Route path="/" element={<ProductPage />} />
        <Route path="/entrar" element={<App />} />
        <Route path="/convite/:token" element={<InviteAcceptance />} />
        <Route path="/proposta/:token" element={<PublicProposal />} />
        <Route path="/admin" element={<App initialTab="admin" />} />
        <Route path="/app/*" element={<App />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </CompanyProvider>
  </BrowserRouter>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sentryEnabled ? (
      <Sentry.ErrorBoundary fallback={<div role="alert">Algo deu errado. Recarregue a página.</div>}>
        {app}
      </Sentry.ErrorBoundary>
    ) : app}
  </StrictMode>,
);
