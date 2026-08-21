import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { CompanyProvider } from './contexts/CompanyContext';
import { Sentry, sentryEnabled } from './observability';

const app = (
  <CompanyProvider>
    <App />
  </CompanyProvider>
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
