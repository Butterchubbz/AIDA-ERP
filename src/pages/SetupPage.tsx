import { useState } from 'react';
import PageContainer from '../components/common/PageContainer';

export default function SetupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (msg: string) => setLog(l => [...l, msg]);

  // The automated helpers and import JSON were removed from the repository.
  // This page now provides manual instructions for creating PocketBase collections.
  const createCollectionsViaAdmin = async () => {
    appendLog('Automatic collection creation is not available. Please follow the manual guide.');
  };

  return (
    <PageContainer title="Setup: PocketBase Collections">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">AIDA Setup — Create PocketBase Collections</h1>

        <p className="mb-3">
          Automatic collection creation and import JSON download are not available in this
          repository. Follow the manual PocketBase setup guide in the project root
          (`POCKETBASE_SETUP_GUIDE.md`) to create the required collections using the PocketBase
          Admin UI.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium">Admin Email</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full p-2 bg-slate-900 border rounded"
          />
          <label className="block text-sm font-medium mt-2">Admin Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full p-2 bg-slate-900 border rounded"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={createCollectionsViaAdmin} className="px-4 py-2 bg-blue-600 rounded">
            Open Manual Guide
          </button>
        </div>

        <div className="bg-slate-900 p-4 rounded h-64 overflow-auto">
          <pre className="text-xs text-slate-300">{log.join('\n')}</pre>
        </div>
      </div>
    </PageContainer>
  );
}
