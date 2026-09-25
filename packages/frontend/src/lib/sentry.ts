import * as Sentry from '@sentry/browser';
import { browserTracingIntegration } from '@sentry/browser';
import { viteEnv } from './env';

export function initSentry() {
  const dsn = viteEnv.VITE_SENTRY_DSN;
  if (!dsn) return;
  const release = viteEnv.VITE_SENTRY_RELEASE || process.env.VITE_SENTRY_RELEASE;
  Sentry.init({
    dsn,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: viteEnv.NODE_ENV || 'production',
    release,
  });
}

export default initSentry;
