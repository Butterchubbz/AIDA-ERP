import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { PERSONAL_MODE_EMAIL } from '../lib/constants';

export type AppMode = 'team' | 'personal';

export const useModeStore = () => {
  const { user } = useAuth();

  return useMemo(() => {
    const email = String(user?.email ?? '').toLowerCase();
    const isPersonal = email === PERSONAL_MODE_EMAIL.toLowerCase();
    const mode: AppMode = isPersonal ? 'personal' : 'team';

    return {
      mode,
      isPersonal,
      isTeam: !isPersonal,
    };
  }, [user]);
};
