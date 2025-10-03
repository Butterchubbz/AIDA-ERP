// src/views/UserManagementView.js
import React, { useState, useEffect } from 'react';
import { useUsers } from '../hooks/useUsers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const AIDA_FUNCTIONS = [
  'Inventory',
  'Forecasting',
  'Amazon',
  'Orders',
  'Inbound Shipments',
  'RMA Tracker',
];

const UserManagementView = () => {
  const { users, loading, error, updateUserRoles } = useUsers();
  const { currentUser } = useAuth();
  const [userRoles, setUserRoles] = useState({});

  useEffect(() => {
    const initialRoles = {};
    users.forEach(user => {
      initialRoles[user.id] = user.roles || {};
    });
    setUserRoles(initialRoles);
  }, [users]);

  const handleRoleChange = (userId, func, role) => {
    const updatedRoles = {
      ...userRoles[userId],
      [func]: role,
    };
    setUserRoles(prev => ({
      ...prev,
      [userId]: updatedRoles,
    }));
  };

  const handleSaveChanges = async userId => {
    await updateUserRoles(userId, userRoles[userId]);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-users-cog text-purple-400 mr-2"></i>User Management
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                User Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {users.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    {AIDA_FUNCTIONS.map(func => (
                      <div key={func} className="flex items-center">
                        <span className="font-semibold mr-2">{func}:</span>
                        <div className="flex items-center">
                          <label className="mr-2">
                            <input
                              type="radio"
                              name={`${user.id}-${func}`}
                              value="None"
                              checked={
                                (userRoles[user.id] && userRoles[user.id][func] === 'None') ||
                                !userRoles[user.id] ||
                                !userRoles[user.id][func]
                              }
                              onChange={() => handleRoleChange(user.id, func, 'None')}
                            />
                            None
                          </label>
                          <label className="mr-2">
                            <input
                              type="radio"
                              name={`${user.id}-${func}`}
                              value="Viewer"
                              checked={userRoles[user.id] && userRoles[user.id][func] === 'Viewer'}
                              onChange={() => handleRoleChange(user.id, func, 'Viewer')}
                            />
                            Viewer
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`${user.id}-${func}`}
                              value="Editor"
                              checked={userRoles[user.id] && userRoles[user.id][func] === 'Editor'}
                              onChange={() => handleRoleChange(user.id, func, 'Editor')}
                            />
                            Editor
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleSaveChanges(user.id)}
                    disabled={user.id === currentUser.uid}
                    className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementView;
