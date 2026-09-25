import { useEffect, useMemo, useRef, useState } from 'react'
import type { RegistryEntry } from '../../hooks/useIntegrations'

interface ConnectModalProps {
  adapter: RegistryEntry | null
  isOpen: boolean
  onClose: () => void
  onConnected: (credentials: Record<string, string>) => Promise<void>
}

export default function ConnectModal({ adapter, isOpen, onClose, onConnected }: ConnectModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fields = useMemo(() => adapter?.credentialFields ?? [], [adapter])

  useEffect(() => {
    if (!isOpen || !adapter) {
      return
    }

    const initialValues = adapter.credentialFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = ''
      return acc
    }, {})

    setValues(initialValues)
    setErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [adapter, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const firstInput = panelRef.current?.querySelector<HTMLInputElement>('input')
    firstInput?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) {
        return
      }

      const focusableItems = Array.from(focusable).filter((item) => !item.hasAttribute('disabled'))
      if (focusableItems.length === 0) {
        return
      }

      const first = focusableItems[0]
      const last = focusableItems[focusableItems.length - 1]
      const active = document.activeElement

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, submitting])

  if (!isOpen || !adapter) {
    return null
  }

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    for (const field of fields) {
      if (field.required !== false && !values[field.key]?.trim()) {
        nextErrors[field.key] = `${field.label} is required.`
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (submitting) {
      return
    }

    if (!validate()) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const credentials = Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value.trim()
        return acc
      }, {})

      await onConnected(credentials)
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to connect integration')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${adapter.name}`}
        className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl"
      >
        <h2 className="text-xl font-semibold text-cyan-300">Connect {adapter.name}</h2>
        <form
          id={`connect-form-${adapter.id}`}
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="mt-4 space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`integration-field-${field.key}`} className="block text-sm font-semibold text-slate-200">
                  {field.label}{field.required !== false && ' *'}
                </label>
                <input
                  id={`integration-field-${field.key}`}
                  type={field.type}
                  value={values[field.key] ?? ''}
                  autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                  disabled={submitting}
                  placeholder={field.placeholder}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setValues((prev) => ({ ...prev, [field.key]: nextValue }))
                    setErrors((prev) => {
                      if (!prev[field.key]) {
                        return prev
                      }
                      const copy = { ...prev }
                      delete copy[field.key]
                      return copy
                    })
                  }}
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                {field.helpText && <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>}
                {errors[field.key] && <p className="mt-1 text-xs text-red-300">{errors[field.key]}</p>}
              </div>
            ))}
          </div>
        </form>

        <div className="mt-4 rounded-md border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
          <span className="mr-1 font-semibold">Lock:</span>
          Credentials are encrypted on the server and never returned to you.
        </div>

        {submitError && <p className="mt-3 text-sm text-red-300">{submitError}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            form={`connect-form-${adapter.id}`}
            type="submit"
            disabled={submitting}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-60"
          >
            {submitting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
