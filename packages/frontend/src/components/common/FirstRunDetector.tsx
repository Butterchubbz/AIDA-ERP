import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { detectFirstRun } from '../../lib/firstRun';

export default function FirstRunDetector() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/setup')) {
      return;
    }

    let isCancelled = false;

    detectFirstRun().then(isFirstRun => {
      if (isCancelled || !isFirstRun) {
        return;
      }

      if (!location.pathname.startsWith('/setup')) {
        navigate('/setup', { replace: true });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, navigate]);

  return null;
}
