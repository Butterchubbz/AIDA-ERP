import { useAuth } from '../context/AuthContext';
import PageContainer from '../components/common/PageContainer';

const ProfileView = () => {
  const { user, userRoles } = useAuth();

  if (!user) {
    return <p>Loading profile...</p>;
  }

  return (
    <PageContainer title="My Profile">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400">Email</label>
          <p className="text-lg text-slate-200">{user.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400">Role</label>
          <p className="text-lg font-bold text-emerald-400">
            {userRoles?.Admin || userRoles?.Inventory || 'N/A'}
          </p>
        </div>
      </div>
    </PageContainer>
  );
};

export default ProfileView;
