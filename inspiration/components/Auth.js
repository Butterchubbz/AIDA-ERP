// src/components/Auth.js

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from './MessageBox';

const Auth = () => {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { currentUser, signInWithGoogle, signInWithEmail, signUpWithEmail, logOut } = useAuth(); // Changed 'logout' to 'logOut'
  const { showToast } = useMessageBox();

  const handleLogout = async () => {
    setError('');
    setLoading(true);
    try {
      await logOut(); // Changed 'logout()' to 'logOut()'
      // The re-render after logout will handle showing the login form.
      showToast('Successfully signed out!', 'success'); // Add success toast
    } catch (e) {
      console.error('Logout Error:', e); // Explicitly log the error
      setError('Failed to sign out.');
      showToast('Failed to sign out. Please try again.', 'error');
      setLoading(false);
    }
  };

  if (currentUser) {
    return (
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-medium text-white">
            {currentUser.displayName || currentUser.email}
          </p>
          <p className="text-xs text-slate-400">Signed In</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 font-semibold hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
        >
          {loading ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      showToast('Successfully signed in with Google!', 'success');
    } catch (e) {
      console.error('Google Sign-In Error:', e);
      setError('Failed to sign in with Google. Please try again.');
    }
    setLoading(false);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (activeTab === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      try {
        await signUpWithEmail(email, password);
        showToast('Account created successfully! You are now logged in.', 'success');
      } catch (e) {
        console.error('Sign-Up Error:', e);
        setError(e.message || 'Failed to create an account.');
      }
    } else {
      // Sign In
      try {
        await signInWithEmail(email, password);
        showToast('Successfully signed in!', 'success');
      } catch (e) {
        console.error('Sign-In Error:', e);
        setError(e.message || 'Failed to sign in.');
      }
    }
    setLoading(false);
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-300">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      {activeTab === 'signup' && (
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {loading ? (
          <i className="fas fa-spinner fa-spin"></i>
        ) : activeTab === 'signin' ? (
          'Sign In'
        ) : (
          'Sign Up'
        )}
      </button>
    </form>
  );

  return (
    <div className="w-full max-w-md p-6 bg-slate-800 rounded-lg shadow-xl">
      <div className="flex border-b border-slate-600 mb-4">
        <button
          onClick={() => setActiveTab('signin')}
          className={`py-2 px-4 font-medium text-sm w-1/2 ${
            activeTab === 'signin'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab('signup')}
          className={`py-2 px-4 font-medium text-sm w-1/2 ${
            activeTab === 'signup'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign Up
        </button>
      </div>

      {error && <p className="text-red-400 text-center text-sm mb-4">{error}</p>}

      {renderForm()}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-slate-800 text-slate-400">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex justify-center items-center py-2 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
      >
        <i className="fab fa-google mr-2"></i>
        Google
      </button>
    </div>
  );
};

export default Auth;
