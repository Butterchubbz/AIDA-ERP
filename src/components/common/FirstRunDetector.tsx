import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { COLLECTIONS } from '../../lib/collections';
import { pb } from '../../lib/pocketbase';

const SETUP_KEY = 'aida_setup_complete';

export default function FirstRunDetector() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isCancelled = false;

    const detectFirstRun = async () => {
      if (location.pathname.startsWith('/setup')) {
        return;
      }

      const setupComplete = localStorage.getItem(SETUP_KEY);
      if (setupComplete === '1') {
        return;
      }

      const timeoutPromise = new Promise<'timeout'>(resolve => {
        window.setTimeout(() => resolve('timeout'), 2000);
      });

      const checkPromise = (async () => {
        try {
          const result = await pb.collection(COLLECTIONS.SUPERUSERS).getList(1, 1);
          if (result.items.length === 0) {
            return 'first-run' as const;
          }
          return 'initialized' as const;
        } catch (error: unknown) {
          if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
            return 'initialized' as const;
          }
          return 'unknown' as const;
        }
      })();

      const outcome = await Promise.race([checkPromise, timeoutPromise]);
      if (isCancelled) return;

      if (outcome === 'first-run') {
        navigate('/setup', { replace: true });
        return;
      }

      if (outcome === 'initialized') {
        localStorage.setItem(SETUP_KEY, '1');
      }
    };

    detectFirstRun();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, navigate]);

  return null;
}
