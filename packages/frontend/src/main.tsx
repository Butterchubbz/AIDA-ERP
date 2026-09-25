import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { MessageBoxProvider } from './components/common/MessageBox';

import initSentry from './lib/sentry';

(async () => {
  await initSentry();
  // Render the app and set a global flag once mounted. Tests will wait for this flag.
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <MessageBoxProvider>
            <App />
          </MessageBoxProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  );

  // Small delay to ensure React effects run, then mark ready
  // (helps Playwright avoid racing with async in-app initialization)
  setTimeout(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__AIDA_APP_READY = true;
      console.info('AIDA app ready');
    } catch {
      // ignore
    }
  }, 50);
})();
