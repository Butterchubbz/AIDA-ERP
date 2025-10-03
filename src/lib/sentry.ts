import * as Sentry from '@sentry/browser';
import { BrowserTracing } from '@sentry/tracing';
import { viteEnv } from './env';

export function initSentry() {
  const dsn = viteEnv.VITE_SENTRY_DSN;
  if (!dsn) return;
  const release = viteEnv.VITE_SENTRY_RELEASE || process.env.VITE_SENTRY_RELEASE;
  Sentry.init({
    dsn,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: viteEnv.NODE_ENV || 'production',
    release,
  });
}

export default initSentry;
