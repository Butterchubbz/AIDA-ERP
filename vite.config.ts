/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Optionally enable bundle visualizer when ANALYZE=true
// We use an async config factory so we can dynamically import the visualizer if requested.
const createConfig = async () => {
  let visualizerPlugin: unknown = null;
  if (process.env.ANALYZE === 'true') {
    try {
      const rpv = await import('rollup-plugin-visualizer').catch(() => null);
      const mod = rpv && ((rpv as unknown as { default?: unknown })?.default || rpv);
      const creator = (mod as unknown as { visualizer?: unknown })?.visualizer || mod;
      if (typeof creator === 'function') {
        // Call the dynamic creator with a safely-typed signature.
        visualizerPlugin = (creator as (...args: unknown[]) => unknown)({ filename: 'dist/stats.html', open: false, gzipSize: true });
      }
    } catch {
      // plugin not available — ignore
      console.warn('Visualizer plugin not available. Install `rollup-plugin-visualizer` to enable bundle analysis.');
    }
  }

  return defineConfig({
  plugins: [react(), ...(visualizerPlugin ? [(visualizerPlugin as Plugin)] : [])],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('pocketbase')) return 'vendor-pocketbase';
              if (id.includes('lodash')) return 'vendor-lodash';
              if (id.includes('papaparse')) return 'vendor-papaparse';
            }
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  });
};

export default createConfig();

// https://vitejs.dev/config/
