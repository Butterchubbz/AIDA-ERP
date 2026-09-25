// Small helper to centralize typed access to Vite environment variables
export interface ViteEnv {
  VITE_API_URL?: string;
  VITE_DEBUG?: string;
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_RELEASE?: string;
  NODE_ENV?: string;
}

export const viteEnv = (import.meta.env as unknown) as ViteEnv;

export const isDebug = () => String(viteEnv.VITE_DEBUG || '').toLowerCase() === 'true';
