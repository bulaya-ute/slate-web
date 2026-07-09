import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useFocusTrap } from '../../components/ui/useFocusTrap'
import { useServerCheckQuery } from '../../lib/queries'
import { CLIENT_VERSION } from '../../lib/version'
import { useAuth } from '../../stores/auth'
import { useEditorPrefs } from '../../stores/editorPrefs'
import { useServer } from '../../stores/servers'
import { useTheme, type ThemeOverride } from '../../stores/theme'

export interface SettingsPanelProps {
  onClose: () => void
}

const THEME_OPTIONS: { value: ThemeOverride; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match your OS setting' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
]

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-[13px] font-semibold text-text">{title}</h3>
      {description && <p className="mt-0.5 text-[12px] text-text-faint">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * Full-screen settings overlay — same portaled/focus-trapped shape as
 * `GraphView` (opaque, fills the viewport; there's no dim-backdrop
 * "dialog" reading here either, this is a whole screen of its own).
 * Four sections per the brief: theme, editor prefs, server management,
 * about. Deliberately not a big generic preferences framework — each
 * section reads/writes the one small store that already owns that
 * concern (theme store, editor-prefs store, servers store).
 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useFocusTrap(dialogRef, true)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const override = useTheme((s) => s.override)
  const setOverride = useTheme((s) => s.setOverride)

  const defaultSplitPreview = useEditorPrefs((s) => s.defaultSplitPreview)
  const setDefaultSplitPreview = useEditorPrefs((s) => s.setDefaultSplitPreview)

  const current = useServer((s) => s.current)
  const remembered = useServer((s) => s.remembered)
  const clearCurrent = useServer((s) => s.clearCurrent)
  const forget = useServer((s) => s.forget)
  const clearAuth = useAuth((s) => s.clear)
  const user = useAuth((s) => s.user)

  const { data: serverCheck, isLoading: serverCheckLoading } = useServerCheckQuery(current)
  const serverInfo = serverCheck?.status === 'ok' || serverCheck?.status === 'incompatible' ? serverCheck.info : null
  const currentServerName = remembered.find((s) => s.url === current)?.name ?? serverInfo?.serverName ?? null

  // "Switch server": credentials are per-server, so this always logs out
  // — it clears the active pointer but leaves the server in "Recent
  // servers" on Connect for a quick reconnect. "Disconnect" additionally
  // forgets it outright. Both are judgment calls (the brief only says
  // "disconnect/switch server, reusing existing server store actions");
  // documented here rather than silently invented.
  function handleSwitchServer() {
    clearAuth()
    clearCurrent()
    onClose()
    navigate('/connect')
  }

  function handleDisconnect() {
    clearAuth()
    if (current) forget(current)
    else clearCurrent()
    onClose()
    navigate('/connect')
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-bg outline-none animate-[fadeIn_150ms_ease-out]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-[14px] font-semibold text-text">Settings</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
          <SectionCard title="Theme" description="Applies immediately and persists on this device.">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={override === opt.value}
                  onClick={() => setOverride(opt.value)}
                  className={
                    'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition duration-150 ease-out ' +
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] ' +
                    (override === opt.value
                      ? 'border-accent bg-surface-active text-text'
                      : 'border-border text-text-muted hover:bg-surface-hover hover:text-text')
                  }
                >
                  <span className="text-[13px] font-medium">{opt.label}</span>
                  <span className="text-[11px] text-text-faint">{opt.hint}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Editor">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-[13px] text-text">Open notes with split preview by default</span>
              <input
                type="checkbox"
                checked={defaultSplitPreview}
                onChange={(e) => setDefaultSplitPreview(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
            </label>
          </SectionCard>

          <SectionCard title="Server" description="This device's connection.">
            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-border bg-bg-inset px-3 py-2">
                <p className="text-[13px] font-medium text-text">{currentServerName ?? current ?? 'Not connected'}</p>
                {current && <p className="truncate text-[12px] text-text-faint">{current}</p>}
                {user && <p className="mt-1 text-[12px] text-text-faint">Signed in as {user.displayName}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={handleSwitchServer}>
                  Switch server
                </Button>
                <Button size="sm" variant="danger" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="About">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
              <dt className="text-text-faint">Client version</dt>
              <dd className="text-text">{CLIENT_VERSION}</dd>
              <dt className="text-text-faint">Server</dt>
              <dd className="text-text">
                {serverCheckLoading ? (
                  <Spinner size="sm" label="Checking server" />
                ) : serverInfo ? (
                  `${serverInfo.name} ${serverInfo.version} (API v${serverInfo.apiVersion})`
                ) : (
                  '—'
                )}
              </dd>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>,
    document.body,
  )
}
