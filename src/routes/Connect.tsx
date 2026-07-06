import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthScreenLayout } from '../components/AuthScreenLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { CLIENT_API_VERSION, checkServer, type ServerCheckResult } from '../lib/api/client'
import { useConfigQuery } from '../lib/queries'
import { useServer } from '../stores/servers'

type Phase = 'idle' | 'checking' | 'ok' | 'unreachable' | 'incompatible'

/** Self-hosted servers are often bare host:port — default to http:// rather than force https. */
function ensureScheme(raw: string): string {
  const trimmed = raw.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

export function Connect() {
  const navigate = useNavigate()
  const { data: config, isLoading: configLoading } = useConfigQuery()
  const remembered = useServer((s) => s.remembered)
  const setCurrent = useServer((s) => s.setCurrent)
  const forget = useServer((s) => s.forget)

  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ServerCheckResult | null>(null)
  const [leaving, setLeaving] = useState(false)

  const suggested = config?.serverUrl ?? null

  async function attemptConnect(rawUrl: string) {
    const target = ensureScheme(rawUrl)
    setPhase('checking')
    setResult(null)
    const check = await checkServer(target)
    setResult(check)
    if (check.status === 'ok') {
      setPhase('ok')
      setCurrent(target, check.info.serverName)
      setLeaving(true)
      window.setTimeout(() => navigate('/login'), 220)
    } else {
      setPhase(check.status)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!url.trim() || phase === 'checking') return
    void attemptConnect(url)
  }

  return (
    <AuthScreenLayout
      subtitle="Connect to your Slate server"
      footer={
        <span>
          Don&apos;t have a server yet? See the{' '}
          <a
            href="https://github.com/bulaya-ute/slate-server"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            self-hosting guide
          </a>
          .
        </span>
      }
    >
      <div
        className={
          'transition-all duration-200 ease-out ' +
          (leaving ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100')
        }
      >
        {configLoading ? (
          <div className="flex flex-col gap-3" aria-label="Loading" role="status">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-28" />
          </div>
        ) : (
          <>
            {remembered.length > 0 && (
              <div className="mb-5 flex flex-col gap-2">
                <p className="text-[12px] font-medium uppercase tracking-wide text-text-faint">
                  Recent servers
                </p>
                {remembered.map((s) => (
                  <div
                    key={s.url}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-inset px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-text">{s.name ?? s.url}</p>
                      <p className="truncate text-[12px] text-text-faint">{s.url}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => void attemptConnect(s.url)}>
                        Connect
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Forget ${s.name ?? s.url}`}
                        onClick={() => forget(s.url)}
                      >
                        Forget
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                label="Server address"
                placeholder={suggested ?? 'https://slate.example.com'}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (phase !== 'checking') setPhase('idle')
                }}
                autoFocus
                autoComplete="url"
                error={
                  phase === 'unreachable'
                    ? "Couldn't reach that server. Check the address and that it's running."
                    : phase === 'incompatible' && result?.status === 'incompatible'
                      ? `This server speaks API v${result.info.apiVersion}; this client needs v${CLIENT_API_VERSION}. Update the server or the client.`
                      : undefined
                }
                hint={phase === 'idle' || phase === 'checking' ? 'Include http:// or https://' : undefined}
              />
              <Button type="submit" loading={phase === 'checking'} disabled={phase === 'ok'}>
                {phase === 'ok' ? 'Connected' : phase === 'checking' ? 'Checking…' : 'Connect'}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthScreenLayout>
  )
}
