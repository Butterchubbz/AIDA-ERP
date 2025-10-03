// src/views/ProfileView.js
import React from 'react';
import { useAuth } from '../context/AuthContext';

const ProfileView = () => {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <p>Loading profile...</p>;
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-user-circle text-blue-400 mr-2"></i>My Profile
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400">Email</label>
          <p className="text-lg text-slate-200">{currentUser.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400">Role</label>
          <p className="text-lg font-bold text-emerald-400">{userRole}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
