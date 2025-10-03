import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

function LoginView() {
  const { login, isLoggedIn } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(identity, password, isAdmin);
    } catch (error: unknown) {
      const e = error as { message?: string };
      setError(e.message || 'Failed to login. Please try again.');
      console.error('Login error:', error);
    }
  }

  if (isLoggedIn) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="identity" className="block mb-1">
            Email
          </label>
          <input
            id="identity"
            type="text"
            value={identity}
            onChange={e => setIdentity(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter email"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter password"
          />
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              className="mr-2"
            />
            Login as Admin
          </label>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default LoginView;
