import pb from './pocketbase.js'
import { getAdapter } from '../integrations/registry.js'
import { getIntegrationById, runIntegrationSync, type IntegrationRecord } from './integrationService.js'

const timers = new Map<string, NodeJS.Timeout>()
const inFlight = new Set<string>()

function clearTimer(recordId: string): void {
  const existing = timers.get(recordId)
  if (!existing) {
    return
  }

  clearInterval(existing)
  timers.delete(recordId)
}

async function runScheduledSync(recordId: string): Promise<void> {
  if (inFlight.has(recordId)) {
    return
  }

  inFlight.add(recordId)
  try {
    const record = await getIntegrationById(recordId)
    if (!record || typeof record.syncIntervalHours !== 'number' || record.syncIntervalHours <= 0) {
      clearTimer(recordId)
      return
    }

    const adapter = getAdapter(record.type)
    if (!adapter) {
      clearTimer(recordId)
      return
    }

    await runIntegrationSync(record, adapter)
  } catch (err: unknown) {
    console.error(`[Scheduler] Scheduled sync failed for ${recordId}:`, err)
  } finally {
    inFlight.delete(recordId)
  }
}

function scheduleRecord(record: IntegrationRecord): void {
  clearTimer(record.id)

  if (typeof record.syncIntervalHours !== 'number' || record.syncIntervalHours <= 0) {
    return
  }

  const intervalMs = record.syncIntervalHours * 60 * 60 * 1000
  const timer = setInterval(() => {
    void runScheduledSync(record.id)
  }, intervalMs)

  timers.set(record.id, timer)
}

export async function startIntegrationScheduler(): Promise<void> {
  try {
    const records = (await pb
      .collection('integrations')
      .getFullList({ filter: 'syncIntervalHours != null' })) as IntegrationRecord[]

    for (const record of records) {
      scheduleRecord(record)
    }
  } catch {
    // Collection may not exist yet on first run — scheduler will activate
    // automatically once integrations are created via setup.
    console.log('[Scheduler] Integrations collection not ready — scheduler skipped on startup')
  }
}

export async function rescheduleIntegration(recordId: string): Promise<void> {
  const record = await getIntegrationById(recordId)
  if (!record) {
    clearTimer(recordId)
    return
  }

  scheduleRecord(record)
}

export function unscheduleIntegration(recordId: string): void {
  clearTimer(recordId)
}

export function stopIntegrationScheduler(): void {
  for (const timer of timers.values()) {
    clearInterval(timer)
  }
  timers.clear()
  inFlight.clear()
}
