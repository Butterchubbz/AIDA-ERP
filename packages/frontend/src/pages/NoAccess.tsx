import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NoAccess() {
  return (
    <div
      data-testid="no-access"
      className="flex flex-col items-center justify-center min-h-[60vh] text-slate-100 p-6 text-center"
    >
      <div className="p-4 bg-red-950/40 rounded-full border border-red-800/60 mb-4 text-red-400">
        <ShieldAlert size={48} />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-base text-slate-400 max-w-md mb-6">
        You do not have permission to view this module. Please contact an administrator if you believe this is an error.
      </p>
      <Link
        to="/dashboard"
        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg font-medium transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
