import { useState, useEffect } from 'react';
import { useUsers } from '../hooks/useUsers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import type { User } from '@aida/shared';
import usersLogo from '../assets/logos/generic-users.svg';

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
  const { user } = useAuth(); // Changed from currentUser to user
  const [userRolesState, setUserRolesState] = useState<{
    [key: string]: { [key: string]: string };
  }>({});

  useEffect(() => {
    const initialRoles: { [key: string]: { [key: string]: string } } = {};
    users.forEach((userItem: User) => {
      const userSpecificRoles: { [key: string]: string } = {};
      AIDA_FUNCTIONS.forEach(func => {
        userSpecificRoles[func] = (userItem.roles as Record<string, string>)?.[func] || 'None';
      });
      if (userItem.id) initialRoles[userItem.id] = userSpecificRoles;
    });
    setUserRolesState(initialRoles);
  }, [users]);

  const handleRoleChange = (userId: string, func: string, role: string) => {
    const updatedRoles = {
      ...userRolesState[userId],
      [func]: role,
    };
    setUserRolesState(prev => ({
      ...prev,
      [userId]: updatedRoles,
    }));
  };

  const handleSaveChanges = async (userId: string) => {
    await updateUserRoles(userId, userRolesState[userId]);
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
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3 flex items-center gap-2">
        <img src={usersLogo} alt="User management logo" className="w-7 h-7 object-contain" />
        User Management
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
            {users
              .filter(u => !!u.id)
              .map((userItem: User) => {
                const uid: string = String(userItem.id);
                return (
                  <tr key={uid}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                  {userItem.email}
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
                              name={`${uid}-${func}`}
                              value="None"
                              checked={userRolesState[uid]?.[func] === 'None' || !userRolesState[uid]?.[func]}
                              onChange={() => handleRoleChange(uid, func, 'None')}
                            />
                            None
                          </label>
                          <label className="mr-2">
                            <input
                              type="radio"
                              name={`${uid}-${func}`}
                              value="Viewer"
                              checked={userRolesState[uid]?.[func] === 'Viewer'}
                              onChange={() => handleRoleChange(uid, func, 'Viewer')}
                            />
                            Viewer
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`${uid}-${func}`}
                              value="Editor"
                              checked={userRolesState[uid]?.[func] === 'Editor'}
                              onChange={() => handleRoleChange(uid, func, 'Editor')}
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
                    onClick={() => handleSaveChanges(uid)}
                    disabled={uid === user?.id}
                    className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementView;
