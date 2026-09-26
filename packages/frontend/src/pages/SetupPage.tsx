import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageContainer from '../components/common/PageContainer';
import aidaLogo from '../assets/logos/aida-logo.png';
import SetupProgressBar from '../components/setup/SetupProgressBar';
import StatusIndicator, { type IndicatorState } from '../components/setup/StatusIndicator';
import { apiClient, isApiError } from '../lib/apiClient';

type CollectionCheck = 'exists' | 'created' | 'missing' | 'failed'

interface HealthResponse {
  backend: 'ok' | 'fail'
  pocketbase: 'ok' | 'fail'
  setupComplete: boolean
  checks: {
    encryptionKey: 'ok' | 'missing' | 'invalid' | 'fail'
    userPreferences: CollectionCheck
    integrations: CollectionCheck
    inventoryDevice: CollectionCheck
    inventoryComponent: CollectionCheck
    inventoryAccessory: CollectionCheck
    stockHistory: CollectionCheck
    wcUnknownSkus: CollectionCheck
    inventoryWorkspaces: CollectionCheck
    inventoryItems: CollectionCheck
    euReturns: CollectionCheck
    shippingHistory: CollectionCheck
  }
}

interface InitCollectionsResponse {
  userPreferences: CollectionCheck
  integrations: CollectionCheck
  inventoryDevice: CollectionCheck
  inventoryComponent: CollectionCheck
  inventoryAccessory: CollectionCheck
  stockHistory: CollectionCheck
  wcUnknownSkus: CollectionCheck
  inventoryWorkspaces: CollectionCheck
  inventoryItems: CollectionCheck
  euReturns: CollectionCheck
  shippingHistory: CollectionCheck
  complete: boolean
}

type ProbeStatus = 'ok' | 'fail' | 'timeout'
type ConnectivityIssue = 'none' | 'backend-unreachable' | 'pocketbase-unreachable' | 'both-unreachable'

interface ConnectivityDebugResult {
  backend: ProbeStatus
  pocketbase: ProbeStatus
  issue: ConnectivityIssue
  summary: string
  suggestions: string[]
  backendUrl: string
  pocketbaseUrl: string
  timestamp: string
  rawErrors: string[]
}

const BACKEND_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const POCKETBASE_BASE_URL = 'http://localhost:8090'
const CONNECTIVITY_TIMEOUT_MS = 5000

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

function probeStatusToIndicator(status: ProbeStatus | undefined): IndicatorState {
  if (status === 'ok') {
    return 'success'
  }

  if (status === 'fail' || status === 'timeout') {
    return 'error'
  }

  return 'idle'
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`
  }

  return String(err)
}

function isFailedToFetchError(err: unknown): boolean {
  return err instanceof TypeError && /failed to fetch/i.test(err.message)
}

function classifyConnectivityIssue(backend: ProbeStatus, pocketbase: ProbeStatus): ConnectivityIssue {
  const backendDown = backend !== 'ok'
  const pocketbaseDown = pocketbase !== 'ok'

  if (backendDown && pocketbaseDown) {
    return 'both-unreachable'
  }

  if (backendDown) {
    return 'backend-unreachable'
  }

  if (pocketbaseDown) {
    return 'pocketbase-unreachable'
  }

  return 'none'
}

function issueSummary(issue: ConnectivityIssue): string {
  if (issue === 'backend-unreachable') {
    return 'Backend API not responding on localhost:3001.'
  }

  if (issue === 'pocketbase-unreachable') {
    return 'PocketBase not found on localhost:8090.'
  }

  if (issue === 'both-unreachable') {
    return 'Backend API and PocketBase are not responding.'
  }

  return 'All connectivity checks passed.'
}

function issueSuggestions(issue: ConnectivityIssue): string[] {
  if (issue === 'backend-unreachable') {
    return [
      'Start the backend API service and confirm it is listening on localhost:3001.',
      'Check firewall or port conflicts, then select Retry.',
    ]
  }

  if (issue === 'pocketbase-unreachable') {
    return [
      'Check if pocketbase.exe is running.',
      'Confirm PocketBase is listening on localhost:8090, then select Retry.',
    ]
  }

  if (issue === 'both-unreachable') {
    return [
      'Start both Backend API (localhost:3001) and PocketBase (localhost:8090).',
      'After both services are running, select Retry.',
    ]
  }

  return []
}

function appendSuggestions(existing: string[], next: string[]): string[] {
  return Array.from(new Set([...existing, ...next]))
}

function getSetupHealthSuggestions(err?: unknown): string[] {
  if (isApiError(err) && err.status === 401) {
    return [
      'The backend is reachable but rejected the setup request with 401 Unauthorized.',
      'Confirm /api/setup/check-health is registered before requireAuth middleware.',
      'Check whether a reverse proxy or gateway is adding authentication in front of the backend.',
    ]
  }

  if (isApiError(err) && err.status === 404) {
    return [
      'Verify VITE_API_URL points to the backend service you started.',
      'Confirm the backend registered /api/setup/check-health.',
    ]
  }

  if (isApiError(err) && err.status === 500) {
    return [
      'Inspect backend terminal logs for the crash or thrown startup dependency error.',
      'Confirm PocketBase admin authentication and required environment variables are loaded.',
    ]
  }

  if (isApiError(err) && err.status === 403) {
    return [
      'Check CORS settings in .env and confirm ALLOWED_ORIGIN matches the active frontend URL.',
      'Confirm the browser origin, including port, exactly matches the backend CSRF allow-list.',
    ]
  }

  if (isFailedToFetchError(err)) {
    return [
      'Check that Backend API and PocketBase are both running and reachable on localhost.',
      'Check CORS settings in .env and compare ALLOWED_ORIGIN to the frontend port shown in the browser.',
    ]
  }

  return []
}

async function probeEndpoint(url: string): Promise<{ status: ProbeStatus; error?: string }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })

    if (!response.ok) {
      return { status: 'fail', error: `HTTP ${response.status}` }
    }

    return { status: 'ok' }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'timeout', error: `Timed out after ${CONNECTIVITY_TIMEOUT_MS}ms` }
    }

    return { status: 'fail', error: safeErrorMessage(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

async function runConnectivityDebugger(): Promise<ConnectivityDebugResult> {
  const backendUrl = `${BACKEND_BASE_URL}/api/health`
  const pocketbaseUrl = `${POCKETBASE_BASE_URL}/api/health`

  const [backendProbe, pocketbaseProbe] = await Promise.all([
    probeEndpoint(backendUrl),
    probeEndpoint(pocketbaseUrl),
  ])

  const issue = classifyConnectivityIssue(backendProbe.status, pocketbaseProbe.status)
  const rawErrors: string[] = []

  if (backendProbe.error) {
    rawErrors.push(`Backend probe: ${backendProbe.error}`)
  }

  if (pocketbaseProbe.error) {
    rawErrors.push(`PocketBase probe: ${pocketbaseProbe.error}`)
  }

  return {
    backend: backendProbe.status,
    pocketbase: pocketbaseProbe.status,
    issue,
    summary: issueSummary(issue),
    suggestions: issueSuggestions(issue),
    backendUrl,
    pocketbaseUrl,
    timestamp: new Date().toISOString(),
    rawErrors,
  }
}

function buildHealthErrorMessage(debug: ConnectivityDebugResult, err?: unknown): string {
  if (debug.issue !== 'none') {
    return debug.summary
  }

  if (isApiError(err) && err.status === 401) {
    return 'Backend Reachable (Unauthorized) — the setup endpoint returned 401. The backend is running but the request was rejected. Verify the setup route is registered without requireAuth and no proxy is enforcing authentication.'
  }

  if (isApiError(err) && err.status === 404) {
    return 'Setup health endpoint returned 404. Verify VITE_API_URL points to the backend and confirm /api/setup/check-health is registered.'
  }

  if (isApiError(err) && err.status === 500) {
    return 'Backend returned 500 during setup health check. The server is reachable but crashed while processing the request. Inspect backend logs for the failing dependency or startup error.'
  }

  if (isApiError(err) && err.status === 403) {
    return 'Setup health request was rejected with 403. Verify CORS and ALLOWED_ORIGIN settings match the frontend URL exactly.'
  }

  if (isFailedToFetchError(err)) {
    return 'Network request failed before the server returned a response. Check that Backend API and PocketBase are running, and verify CORS/ALLOWED_ORIGIN matches the frontend URL.'
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  return 'Could not run health check'
}

function buildErrorLog(
  debug: ConnectivityDebugResult | null,
  healthError: string | null,
  err?: unknown
): string {
  const payload = {
    timestamp: new Date().toISOString(),
    route: '/setup',
    issue: debug?.issue ?? 'unknown',
    summary: debug?.summary ?? healthError ?? 'Unknown setup health error',
    backend: {
      status: debug?.backend ?? 'unknown',
      url: debug?.backendUrl ?? `${BACKEND_BASE_URL}/api/health`,
    },
    pocketbase: {
      status: debug?.pocketbase ?? 'unknown',
      url: debug?.pocketbaseUrl ?? `${POCKETBASE_BASE_URL}/api/health`,
    },
    suggestions: debug?.suggestions ?? [],
    rawErrors: [
      ...(debug?.rawErrors ?? []),
      ...(err ? [safeErrorMessage(err)] : []),
    ],
  }

  return JSON.stringify(payload, null, 2)
}

export default function SetupPage() {
  const [searchParams] = useSearchParams();
  const steps = useMemo(
    () => ['Welcome', 'Health Check', 'Superuser', 'Generate Key', 'Collections', 'Workspace', 'Admin Account', 'Finish'],
    []
  );
  const rerunMode = searchParams.get('rerun') === '1';
  const returnTo = searchParams.get('returnTo') || '/data';

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hasHealthAttempted, setHasHealthAttempted] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [connectivityDebug, setConnectivityDebug] = useState<ConnectivityDebugResult | null>(null);
  const [healthErrorLog, setHealthErrorLog] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [keyState, setKeyState] = useState<'unknown' | 'saved' | 'error'>('unknown');
  const [keyMessage, setKeyMessage] = useState<string>('');
  const [superuserState, setSuperuserState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [superuserMessage, setSuperuserMessage] = useState<string>('');
  const [superuserEmail, setSuperuserEmail] = useState<string>('');
  const [superuserPassword, setSuperuserPassword] = useState<string>('');
  const [superuserConfirmPassword, setSuperuserConfirmPassword] = useState<string>('');
  const [adminState, setAdminState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [adminMessage, setAdminMessage] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [collectionResult, setCollectionResult] = useState<InitCollectionsResponse | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<'solo' | 'team' | null>(null);
  const [workspaceSaveState, setWorkspaceSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const runHealthCheck = async () => {
    setBusy(true);
    setHasHealthAttempted(true);
    setHealthError(null);
    setCopyStatus('idle');
    let latestDebug: ConnectivityDebugResult | null = null

    try {
      const debug = await runConnectivityDebugger();
      latestDebug = debug
      setConnectivityDebug(debug);

      if (debug.issue === 'backend-unreachable' || debug.issue === 'both-unreachable') {
        const message = buildHealthErrorMessage(debug);
        setHealth(null);
        setHealthError(message);
        setHealthErrorLog(buildErrorLog(debug, message));
        return;
      }

      const response = await apiClient.get<HealthResponse>('/api/setup/check-health');
      setHealth(response);

      if (response.backend !== 'ok' || response.pocketbase !== 'ok') {
        const issue = response.backend !== 'ok' ? 'backend-unreachable' : 'pocketbase-unreachable'
        const mergedDebug: ConnectivityDebugResult = {
          ...debug,
          backend: response.backend === 'ok' ? 'ok' : debug.backend,
          pocketbase: response.pocketbase === 'ok' ? 'ok' : debug.pocketbase,
          issue,
          summary: issueSummary(issue),
          suggestions: issueSuggestions(issue),
        }

        const message = buildHealthErrorMessage(mergedDebug)
        setConnectivityDebug(mergedDebug)
        setHealthError(message)
        setHealthErrorLog(buildErrorLog(mergedDebug, message))
      } else {
        setHealthError(null)
        setHealthErrorLog('')
      }

      if (response.setupComplete && !rerunMode) {
        setStepIndex(7);
      }
    } catch (err: unknown) {
      const fallbackDebug =
        latestDebug ??
        connectivityDebug ?? {
          backend: 'fail' as ProbeStatus,
          pocketbase: 'fail' as ProbeStatus,
          issue: 'both-unreachable' as ConnectivityIssue,
          summary: 'Backend API and PocketBase are not responding.',
          suggestions: issueSuggestions('both-unreachable'),
          backendUrl: `${BACKEND_BASE_URL}/api/health`,
          pocketbaseUrl: `${POCKETBASE_BASE_URL}/api/health`,
          timestamp: new Date().toISOString(),
          rawErrors: [],
        }

      const message = buildHealthErrorMessage(fallbackDebug, err)
      const suggestions = appendSuggestions(fallbackDebug.suggestions, getSetupHealthSuggestions(err))
      setHealthError(message)
      setConnectivityDebug({
        ...fallbackDebug,
        suggestions,
        rawErrors: [...fallbackDebug.rawErrors, safeErrorMessage(err)],
      })
      setHealthErrorLog(
        buildErrorLog(
          {
            ...fallbackDebug,
            suggestions,
            rawErrors: [...fallbackDebug.rawErrors, safeErrorMessage(err)],
          },
          message,
          err
        )
      )

      if (isFailedToFetchError(err)) {
        setConnectivityDebug({
          ...fallbackDebug,
          suggestions,
          rawErrors: [...fallbackDebug.rawErrors, safeErrorMessage(err)],
        })
      }
    } finally {
      setBusy(false);
    }
  };

  const copyErrorLog = async () => {
    if (!healthError && !connectivityDebug) {
      return
    }

    const log = healthErrorLog || buildErrorLog(connectivityDebug, healthError)

    try {
      await navigator.clipboard.writeText(log)
      setCopyStatus('success')
    } catch {
      setCopyStatus('failed')
    }
  }

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
      setStepIndex(4);
    } catch (err: unknown) {
      setKeyState('error');
      setKeyMessage((err as { message?: string }).message ?? 'We could not save the key yet.');
    } finally {
      setBusy(false);
    }
  };

  const createSuperuser = async () => {
    if (superuserPassword !== superuserConfirmPassword) {
      setSuperuserState('error');
      setSuperuserMessage('Passwords do not match.');
      return;
    }

    setBusy(true);
    setSuperuserState('saving');
    setSuperuserMessage('');

    try {
      await apiClient.post('/api/setup/superuser-bootstrap', {
        email: superuserEmail.trim(),
        password: superuserPassword,
      });

      setSuperuserState('saved');
      setSuperuserMessage('PocketBase superuser created.');
      setSuperuserPassword('');
      setSuperuserConfirmPassword('');
      setStepIndex(3);
    } catch (err: unknown) {
      setSuperuserState('error');
      setSuperuserMessage((err as { message?: string }).message ?? 'Could not create the superuser.');
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
        setStepIndex(5);
      }
    } catch (err: unknown) {
      setCollectionError((err as { message?: string }).message ?? 'Collection setup failed');
    } finally {
      setBusy(false);
    }
  };

  const saveWorkspaceModeFn = async () => {
    if (!workspaceMode) return;
    setBusy(true);
    setWorkspaceSaveState('saving');
    try {
      await apiClient.post('/api/setup/set-workspace-mode', { mode: workspaceMode });
      setWorkspaceSaveState('saved');
      setStepIndex(6);
    } catch {
      setWorkspaceSaveState('error');
    } finally {
      setBusy(false);
    }
  };

  const healthReady = health?.backend === 'ok' && health.pocketbase === 'ok';
  const collectionsReady = collectionResult?.complete === true;
  const showHealthActions = hasHealthAttempted && (!healthReady || Boolean(healthError));

  const continueFromHealth = async () => {
    setBusy(true);
    try {
      const status = await apiClient.get<{ available: boolean }>('/api/setup/superuser-bootstrap-status');
      setStepIndex(status.available ? 2 : 3);
    } catch {
      // If the status check itself fails, fall through to the encryption key
      // step — the superuser step is only ever a wizard convenience, never
      // the sole path to a working install.
      setStepIndex(3);
    } finally {
      setBusy(false);
    }
  };

  const createAdminAccount = async () => {
    if (adminPassword !== adminConfirmPassword) {
      setAdminState('error');
      setAdminMessage('Passwords do not match.');
      return;
    }

    setBusy(true);
    setAdminState('saving');
    setAdminMessage('');

    try {
      await apiClient.post('/api/setup/create-first-admin', {
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      });

      setAdminState('saved');
      setAdminMessage('Admin account created.');
      setAdminPassword('');
      setAdminConfirmPassword('');
      setStepIndex(7);
    } catch (err: unknown) {
      setAdminState('error');
      setAdminMessage((err as { message?: string }).message ?? 'Could not create the admin account.');
    } finally {
      setBusy(false);
    }
  };

  const completeSetup = async () => {
    try {
      await apiClient.post('/api/setup/complete', {});
    } catch {
      // Ignore if setup completion lock cannot be posted; proceed to navigation
    }
    window.location.assign(rerunMode ? returnTo : '/login');
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
              {rerunMode
                ? 'We will re-run your system checks and let you repeat setup steps without clearing the existing installation.'
                : 'We will check your connection, secure your data, and prepare your workspace.'}
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
              state={
                health
                  ? health.backend === 'ok'
                    ? 'success'
                    : 'error'
                  : busy
                    ? 'running'
                    : probeStatusToIndicator(connectivityDebug?.backend)
              }
              detail="Checks if AIDA backend is reachable"
            />
            <StatusIndicator
              label="PocketBase"
              state={
                health
                  ? health.pocketbase === 'ok'
                    ? 'success'
                    : 'error'
                  : busy
                    ? 'running'
                    : probeStatusToIndicator(connectivityDebug?.pocketbase)
              }
              detail="Checks if your database service is online"
            />

            {healthError ? (
              <p className="text-sm text-rose-300" role="status" aria-live="assertive">
                {healthError}
              </p>
            ) : null}
            {!healthReady ? (
              <p className="text-sm text-slate-300">
                We could not verify everything yet. Use Retry after you confirm the services are running.
              </p>
            ) : (
              <p className="text-sm text-emerald-300">Connection looks good. You can continue.</p>
            )}

            {connectivityDebug?.suggestions.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200" role="status" aria-live="polite">
                {connectivityDebug.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            ) : null}

            {showHealthActions ? (
              <details className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-300">
                <summary className="cursor-pointer font-semibold text-slate-200">Diagnostic Details</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-300">
                  {healthErrorLog || buildErrorLog(connectivityDebug, healthError)}
                </pre>
              </details>
            ) : null}

            <div className="flex gap-3">
              <button
                onClick={() => void runHealthCheck()}
                disabled={busy}
                className="rounded-md bg-slate-600 px-4 py-2 font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
              >
                {busy ? 'Checking...' : 'Retry'}
              </button>
              {showHealthActions ? (
                <button
                  onClick={() => void copyErrorLog()}
                  disabled={busy}
                  className="rounded-md border border-slate-500 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  Copy Error Log
                </button>
              ) : null}
              <button
                onClick={() => void continueFromHealth()}
                disabled={!healthReady || busy}
                className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
            {copyStatus === 'success' ? (
              <p className="text-xs text-emerald-300">Copied. Share this with support.</p>
            ) : null}
            {copyStatus === 'failed' ? (
              <p className="text-xs text-rose-300">Could not copy to clipboard. Open Diagnostic Details and copy manually.</p>
            ) : null}
          </section>
        ) : null}

        {stepIndex === 2 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 3: Create Database Superuser</h2>
            <p className="text-slate-300">
              Choose an email and password for the PocketBase superuser account that manages your data.
              This account is only created once — it will not be offered again after this step.
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Email
                <input
                  type="email"
                  value={superuserEmail}
                  onChange={(e) => setSuperuserEmail(e.target.value)}
                  autoComplete="username"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Password
                <input
                  type="password"
                  value={superuserPassword}
                  onChange={(e) => setSuperuserPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Confirm Password
                <input
                  type="password"
                  value={superuserConfirmPassword}
                  onChange={(e) => setSuperuserConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">Password must be at least 10 characters.</p>
            {superuserMessage ? (
              <p className={`text-sm ${superuserState === 'error' ? 'text-rose-300' : 'text-emerald-300'}`} role="status">
                {superuserMessage}
              </p>
            ) : null}
            <button
              onClick={() => void createSuperuser()}
              disabled={
                busy ||
                !superuserEmail.trim() ||
                superuserPassword.length < 10 ||
                superuserPassword !== superuserConfirmPassword
              }
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Creating...' : 'Create Superuser'}
            </button>
          </section>
        ) : null}

        {stepIndex === 3 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 4: Generate Security Key</h2>
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

        {stepIndex === 4 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 5: Collection Scaffolding</h2>
            <p className="text-slate-300">
              We will create all required collections in PocketBase.
            </p>
            {(
              [
                ['userPreferences', 'User preferences store'],
                ['integrations', 'Integration credentials'],
                ['inventoryDevice', 'Device inventory'],
                ['inventoryComponent', 'Component inventory'],
                ['inventoryAccessory', 'Accessory inventory'],
                ['stockHistory', 'Stock change history'],
                ['wcUnknownSkus', 'WooCommerce SKU review queue'],
                ['inventoryWorkspaces', 'Inventory workspace registry'],
                ['inventoryItems', 'Inventory item ledger'],
                ['euReturns', 'EU returns register'],
                ['shippingHistory', 'Shipping history ledger'],
              ] as [keyof InitCollectionsResponse, string][]
            ).map(([key, label]) => (
              <StatusIndicator
                key={key}
                label={label}
                state={
                  collectionResult
                    ? collectionResult[key] === 'failed'
                      ? 'error'
                      : 'success'
                    : busy
                      ? 'running'
                      : 'idle'
                }
                detail={
                  collectionResult
                    ? `Status: ${collectionResult[key]}`
                    : 'Checking and creating if missing'
                }
              />
            ))}
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

        {stepIndex === 5 ? (
          <section className="space-y-6 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 6: Workspace Mode</h2>
            <p className="text-slate-300">How will AIDA be used?</p>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${workspaceMode === 'solo' ? 'border-cyan-500 bg-slate-700' : 'border-slate-600 hover:border-slate-500'}`}>
                <input
                  type="radio"
                  name="workspace"
                  value="solo"
                  checked={workspaceMode === 'solo'}
                  onChange={() => setWorkspaceMode('solo')}
                  className="mt-1 accent-cyan-500"
                />
                <div>
                  <p className="font-semibold text-slate-100">Solo</p>
                  <p className="text-sm text-slate-400">Just you. User management and role controls are hidden.</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${workspaceMode === 'team' ? 'border-cyan-500 bg-slate-700' : 'border-slate-600 hover:border-slate-500'}`}>
                <input
                  type="radio"
                  name="workspace"
                  value="team"
                  checked={workspaceMode === 'team'}
                  onChange={() => setWorkspaceMode('team')}
                  className="mt-1 accent-cyan-500"
                />
                <div>
                  <p className="font-semibold text-slate-100">Team</p>
                  <p className="text-sm text-slate-400">Multiple users with role-based access controls.</p>
                </div>
              </label>
            </div>
            {workspaceSaveState === 'error' ? (
              <p className="text-sm text-rose-300">Could not save workspace mode. You can change this later in settings.</p>
            ) : null}
            <button
              onClick={() => void saveWorkspaceModeFn()}
              disabled={!workspaceMode || busy}
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Continue'}
            </button>
          </section>
        ) : null}

        {stepIndex === 6 ? (
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/80 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Step 7: Create Admin Account</h2>
            <p className="text-slate-300">
              Create your primary application administrator account. You will use this account to log in to AIDA.
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Name
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Email
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="username"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Confirm Password
                <input
                  type="password"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">Password must be at least 10 characters.</p>
            {adminMessage ? (
              <p className={`text-sm ${adminState === 'error' ? 'text-rose-300' : 'text-emerald-300'}`} role="status">
                {adminMessage}
              </p>
            ) : null}
            <button
              onClick={() => void createAdminAccount()}
              disabled={
                busy ||
                !adminName.trim() ||
                !adminEmail.trim() ||
                adminPassword.length < 10 ||
                adminPassword !== adminConfirmPassword
              }
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Creating...' : 'Create Admin Account'}
            </button>
          </section>
        ) : null}

        {stepIndex === 7 ? (
          <section className="rounded-lg border border-emerald-500/40 bg-emerald-900/20 p-6">
            <h2 className="text-xl font-semibold text-emerald-200">Setup Complete</h2>
            <p className="mt-3 text-emerald-100">
              {rerunMode ? 'Setup checks are complete. You can return to AIDA.' : 'AIDA is ready. You can continue to login.'}
            </p>
            <button
              onClick={() => void completeSetup()}
              className="mt-4 rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-300"
            >
              {rerunMode ? 'Return to AIDA' : 'Go to AIDA'}
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
