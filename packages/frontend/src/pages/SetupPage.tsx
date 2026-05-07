import { useMemo, useState } from 'react';
import PageContainer from '../components/common/PageContainer';
import aidaLogo from '../assets/logos/aida-logo.png';
import SetupProgressBar from '../components/setup/SetupProgressBar';
import StatusIndicator, { type IndicatorState } from '../components/setup/StatusIndicator';
import { apiClient } from '../lib/apiClient';

interface HealthResponse {
  backend: 'ok' | 'fail'
  pocketbase: 'ok' | 'fail'
  setupComplete: boolean
  checks: {
    encryptionKey: 'ok' | 'missing' | 'invalid' | 'fail'
    userPreferences: 'exists' | 'created' | 'missing' | 'failed'
    integrations: 'exists' | 'created' | 'missing' | 'failed'
  }
}

interface InitCollectionsResponse {
  userPreferences: 'exists' | 'created' | 'missing' | 'failed'
  integrations: 'exists' | 'created' | 'missing' | 'failed'
  complete: boolean
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function keyStateToIndicator(state: 'unknown' | 'saved' | 'error'): IndicatorState {
  if (state === 'saved') {
    return 'success'
  }

  if (state === 'error') {
    return 'error'
  }

  return 'idle'
}

export default function SetupPage() {
  const steps = useMemo(
    () => ['Welcome', 'Health Check', 'Generate Key', 'Collections', 'Finish'],
    []
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [keyState, setKeyState] = useState<'unknown' | 'saved' | 'error'>('unknown');
  const [keyMessage, setKeyMessage] = useState<string>('');
  const [collectionResult, setCollectionResult] = useState<InitCollectionsResponse | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setBusy(true);
    setHealthError(null);

    try {
      const response = await apiClient.get<HealthResponse>('/api/setup/check-health');
      setHealth(response);

      if (response.setupComplete) {
        setStepIndex(4);
      }
    } catch (err: unknown) {
      setHealthError((err as { message?: string }).message ?? 'Could not run health check');
    } finally {
      setBusy(false);
    }
  };

  const generateAndSaveKey = async () => {
    setBusy(true);
    setKeyMessage('');
    setKeyState('unknown');

    try {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      const generatedKey = bytesToHex(bytes);

      await apiClient.post<{ status: string }>('/api/setup/save-encryption-key', {
        key: generatedKey,
      });

      sessionStorage.setItem('aida_setup_key_status', 'saved');
      setKeyState('saved');
      setKeyMessage('Your security key is generated and saved on this machine.');
      setStepIndex(3);
    } catch (err: unknown) {
      setKeyState('error');
      setKeyMessage((err as { message?: string }).message ?? 'We could not save the key yet.');
    } finally {
      setBusy(false);
    }
  };

  const initializeCollections = async () => {
    setBusy(true);
    setCollectionError(null);

    try {
      const result = await apiClient.post<InitCollectionsResponse>('/api/setup/init-collections', {});
      setCollectionResult(result);

      if (result.complete) {
        setStepIndex(4);
      }
    } catch (err: unknown) {
      setCollectionError((err as { message?: string }).message ?? 'Collection setup failed');
    } finally {
      setBusy(false);
    }
  };

  const healthReady = health?.backend === 'ok' && health.pocketbase === 'ok';
  const collectionsReady = collectionResult?.complete === true;

  const continueFromHealth = () => {
    setStepIndex(2);
  };

  const completeSetup = () => {
    window.location.assign('/login');
  };

  return (
    <PageContainer title="AIDA Guided Setup">
      <div className="mx-auto max-w-3xl space-y-6">
        <img src={aidaLogo} alt="AIDA" className="h-16 w-auto mx-auto mb-6" />
        <h1 className="text-center text-3xl font-bold text-cyan-300">AIDA Setup Wizard</h1>

        <SetupProgressBar steps={steps} currentStep={stepIndex} />

        {stepIndex === 0 ? (
          <section className="rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Let us set up AIDA</h2>
            <p className="mt-3 text-slate-300">
              We will check your connection, secure your data, and prepare your workspace.
            </p>
            <button
              onClick={() => {
                setStepIndex(1);
                void runHealthCheck();
              }}
              className="mt-5 rounded-md bg-cyan-500 px-5 py-2 font-semibold text-slate-900 hover:bg-cyan-400"
            >
              Start Setup
            </button>
          </section>
        ) : null}

        {stepIndex === 1 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 2: System Health Check</h2>
            <StatusIndicator
              label="Backend API"
              state={health ? (health.backend === 'ok' ? 'success' : 'error') : busy ? 'running' : 'idle'}
              detail="Checks if AIDA backend is reachable"
            />
            <StatusIndicator
              label="PocketBase"
              state={health ? (health.pocketbase === 'ok' ? 'success' : 'error') : busy ? 'running' : 'idle'}
              detail="Checks if your database service is online"
            />

            {healthError ? <p className="text-sm text-rose-300">{healthError}</p> : null}
            {!healthReady ? (
              <p className="text-sm text-slate-300">
                We could not verify everything yet. Please make sure PocketBase is running, then try again.
              </p>
            ) : (
              <p className="text-sm text-emerald-300">Connection looks good. You can continue.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => void runHealthCheck()}
                disabled={busy}
                className="rounded-md bg-slate-600 px-4 py-2 font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
              >
                {busy ? 'Checking...' : 'Try Again'}
              </button>
              <button
                onClick={continueFromHealth}
                disabled={!healthReady || busy}
                className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {stepIndex === 2 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 3: Generate Security Key</h2>
            <p className="text-slate-300">
              This creates your encryption key and saves it to your local environment files automatically.
            </p>
            <StatusIndicator
              label="Encryption Key"
              state={busy ? 'running' : keyStateToIndicator(keyState)}
              detail={keyMessage || 'Key has not been generated yet'}
            />
            <button
              onClick={() => void generateAndSaveKey()}
              disabled={busy}
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Generating...' : keyState === 'saved' ? 'Regenerate Key' : 'Generate Security Key'}
            </button>
            <p className="text-xs text-slate-400">Do not commit your local env files to source control.</p>
          </section>
        ) : null}

        {stepIndex === 3 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 4: Collection Scaffolding</h2>
            <p className="text-slate-300">
              We will make sure required collections exist in PocketBase.
            </p>
            <StatusIndicator
              label="userPreferences"
              state={
                collectionResult
                  ? collectionResult.userPreferences === 'failed'
                    ? 'error'
                    : 'success'
                  : busy
                    ? 'running'
                    : 'idle'
              }
              detail={
                collectionResult
                  ? `Status: ${collectionResult.userPreferences}`
                  : 'Checking and creating if missing'
              }
            />
            <StatusIndicator
              label="integrations"
              state={
                collectionResult
                  ? collectionResult.integrations === 'failed'
                    ? 'error'
                    : 'success'
                  : busy
                    ? 'running'
                    : 'idle'
              }
              detail={
                collectionResult
                  ? `Status: ${collectionResult.integrations}`
                  : 'Checking and creating if missing'
              }
            />
            {collectionError ? <p className="text-sm text-rose-300">{collectionError}</p> : null}
            {!collectionsReady ? (
              <button
                onClick={() => void initializeCollections()}
                disabled={busy}
                className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
              >
                {busy ? 'Configuring...' : 'Initialize Collections'}
              </button>
            ) : (
              <p className="text-sm text-emerald-300">Database setup is complete.</p>
            )}
          </section>
        ) : null}

        {stepIndex === 4 ? (
          <section className="rounded-lg border border-emerald-500/40 bg-emerald-900/20 p-6">
            <h2 className="text-xl font-semibold text-emerald-200">Setup Complete</h2>
            <p className="mt-3 text-emerald-100">AIDA is ready. You can continue to login.</p>
            <button
              onClick={completeSetup}
              className="mt-4 rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-300"
            >
              Go to AIDA
            </button>
          </section>
        ) : null}

        <div className="rounded-md border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
          A quick setup is required before using AIDA.
        </div>
      </div>
    </PageContainer>
  );
}
