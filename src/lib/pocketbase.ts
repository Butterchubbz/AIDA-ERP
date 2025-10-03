import PocketBase from 'pocketbase';
import { viteEnv } from './env';

// Singleton PocketBase client. The base URL should be provided via Vite env (VITE_PB_URL)
// for production deployments. Falls back to localhost for development.
class PocketBaseSingleton {
  private static instance: PocketBase;

  private constructor() {}

  public static getInstance(): PocketBase {
    if (!PocketBaseSingleton.instance) {
      const base = viteEnv.VITE_PB_URL || 'http://127.0.0.1:8090';
      PocketBaseSingleton.instance = new PocketBase(String(base));
      PocketBaseSingleton.instance.autoCancellation(false);
    }
    return PocketBaseSingleton.instance;
  }
}

export const pb = PocketBaseSingleton.getInstance();
