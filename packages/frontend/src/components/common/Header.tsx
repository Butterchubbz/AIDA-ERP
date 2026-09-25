import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import aidaLogo from '../../assets/logos/aida-logo.png';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="relative bg-slate-900 shadow-md px-8 flex items-center justify-between h-20 text-slate-100 w-full border-b border-slate-800">
      {/* Centered logo — absolutely positioned so it doesn't shift side elements */}
      <Link
        to="/dashboard"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hover:opacity-80 transition-opacity"
      >
        <img src={aidaLogo} alt="AIDA" className="h-14 w-auto" style={{ height: '56px', width: 'auto' }} />
      </Link>

      {/* Left spacer — keeps justify-between balanced */}
      <div className="w-8" />

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
