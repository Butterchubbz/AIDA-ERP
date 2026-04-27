import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import brandLogo from '../../assets/logos/aida-brand.svg';

const Header = () => {
  const { user, logout } = useAuth();
  const [isLogoReady, setIsLogoReady] = useState(false);

  useEffect(() => {
    setIsLogoReady(true);
  }, []);

  return (
    <header className="bg-slate-900 shadow-md px-8 flex items-center justify-between h-20 text-slate-100 w-full border-b border-slate-800">
      {/* Left side: logo + brand name */}
      <div className="flex items-center gap-4">
        {isLogoReady ? (
          <img src={brandLogo} alt="AIDA Logo" className="w-[64px] h-[51px] object-contain" loading="lazy" />
        ) : (
          <div className="w-[64px] h-[51px] bg-slate-700 rounded-sm" aria-hidden />
        )}
        <span className="text-2xl font-bold tracking-wide">AIDA</span>
      </div>

      {/* Right side: user + logout */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="font-semibold text-lg">{user.email ?? 'User'}</span>
            <button
              onClick={logout}
              className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white font-bold"
            >
              Logout
            </button>
          </>
        ) : (
          // Placeholder shimmer for loading state
          <div className="w-32 h-8 bg-slate-700 rounded-md animate-pulse"></div>
        )}
      </div>
    </header>
  );
};

export default Header;
