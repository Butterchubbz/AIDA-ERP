import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoWebp from '../../inspiration/assets/logo_big.webp';
import logoAvif from '../../inspiration/assets/logo_big.avif';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [pngFallback, setPngFallback] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    import('../../inspiration/assets/logo_big.png')
      .then(mod => {
        const m = mod as { default?: string } | string | undefined;
        const value = typeof m === 'string' ? m : (m && m.default) ? m.default : undefined;
        if (mounted) setPngFallback(value || null);
      })
      .catch(err => {
        console.error('Failed to load logo PNG fallback dynamically', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password, false);
      navigate('/'); // Redirect to dashboard on successful login
    } catch (err: unknown) {
      // For UX and tests we show a generic message rather than propagating internal error messages
      setError('Failed to login. Please check your credentials.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex flex-col items-center mb-4">
          <picture>
            <source srcSet={logoAvif} type="image/avif" />
            <source srcSet={logoWebp} type="image/webp" />
            {pngFallback ? (
              <img src={pngFallback} alt="AIDA Logo" className="w-24 h-20 object-contain mb-2" loading="lazy" />
            ) : (
              <div className="w-24 h-20 bg-slate-700 rounded-sm mb-2" aria-hidden />
            )}
          </picture>
          <h1 className="text-3xl font-bold text-cyan-400 mb-2 text-center">AIDA Login</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-100"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-100"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
