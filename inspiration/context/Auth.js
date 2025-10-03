// src/components/Auth.js

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Import the custom useAuth hook

const Auth = () => {
  // Destructure necessary values and functions from the authentication context
  const { currentUser, loadingAuth, authError, signInWithGoogle, logout } = useAuth();

  // Show a loading indicator while authentication status is being determined
  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-gray-600">Loading authentication status...</p>
      </div>
    );
  }

  // Render based on authentication status
  return (
    <div className="flex items-center space-x-4">
      {currentUser ? (
        // If a user is logged in
        <div className="flex items-center space-x-2">
          {/* Display user's email or a generic identifier if no email */}
          <span className="text-gray-700 text-sm font-medium">
            {currentUser.email || currentUser.uid}
          </span>
          {/* Display user ID for multi-user apps (as per instructions) */}
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
            ID: {currentUser.uid}
          </span>
          {/* Logout button */}
          <button
            onClick={logout}
            className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="Sign out"
          >
            Sign Out
          </button>
        </div>
      ) : (
        // If no user is logged in
        <div>
          {/* Display authentication error if any */}
          {authError && <p className="text-red-600 text-sm mb-2">{authError}</p>}
          {/* Google Sign-in button */}
          <button
            onClick={signInWithGoogle}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center space-x-2"
            aria-label="Sign in with Google"
          >
            <i className="fab fa-google"></i> {/* Google icon from Font Awesome */}
            <span>Sign In with Google</span>
          </button>
          {/* Note: Anonymous sign-in happens automatically via AuthContext if no token */}
        </div>
      )}
    </div>
  );
};

export default Auth;
