import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import logoWebp from '../../../inspiration/assets/logo_big.webp';
import logoAvif from '../../../inspiration/assets/logo_big.avif';

const Header = () => {
  const { user, logout } = useAuth();
  const [pngFallback, setPngFallback] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // Only load the original PNG as a fallback for browsers that don't support
    // AVIF/WebP. This keeps the heavier PNG off the initial bundle for modern browsers.
    import('../../../inspiration/assets/logo_big.png')
      .then(mod => {
        if (mounted) {
          // The dynamic import can return either the asset string or an object with a default property
          const m = mod as { default?: string } | string | undefined;
          const val = typeof m === 'string' ? m : (m && m.default) ? m.default : undefined;
          setPngFallback(val || null);
        }
      })
      .catch(err => {
        console.error('Failed to load logo PNG fallback dynamically', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="bg-slate-900 shadow-md px-8 flex items-center justify-between h-20 text-slate-100 w-full border-b border-slate-800">
      {/* Left side: logo + brand name */}
      <div className="flex items-center gap-4">
        <picture>
          <source srcSet={logoAvif} type="image/avif" />
          <source srcSet={logoWebp} type="image/webp" />
          {pngFallback ? (
            <img src={pngFallback} alt="AIDA Logo" className="w-[64px] h-[51px] object-contain" loading="lazy" />
          ) : (
            <div className="w-[64px] h-[51px] bg-slate-700 rounded-sm" aria-hidden />
          )}
        </picture>
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
