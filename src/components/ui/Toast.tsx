import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'danger'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

const AUTO_DISMISS_MS = 5000

const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (item) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...item, id }] }))
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), AUTO_DISMISS_MS)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Fire-and-forget background-event notifications. Call from anywhere, no provider needed. */
export const toast = {
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: 'info' }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  danger: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'danger' }),
}

const variantStyles: Record<ToastVariant, string> = {
  info: 'border-border-strong',
  success: 'border-success',
  danger: 'border-danger',
}

/** Mount once near the app root. Renders whatever `toast.*()` has queued. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto animate-[toastIn_180ms_ease-out] rounded-md border-l-2 bg-surface px-4 py-3 shadow-md ${variantStyles[t.variant]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-text">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12px] text-text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-text-faint transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
