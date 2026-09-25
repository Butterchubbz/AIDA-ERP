const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`
  try {
    const err = (await res.json()) as { error?: string }
    if (err.error) message = err.error
  } catch {
    // ignore parse failure
  }
  return new ApiError(message, res.status)
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  }
}

async function request<T>(method: string, path: string, body?: unknown, isRetry = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    if (res.status === 401 && !isRetry) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        return request<T>(method, path, body, true)
      }
    }
    throw await parseError(res)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
