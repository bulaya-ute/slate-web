import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import type { Invite } from '../../lib/api/types'
import { useServer } from '../../stores/servers'
import { CreateInviteModal } from './CreateInviteModal'
import { useDeleteInviteMutation, useInvitesQuery } from './useAdmin'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function isExpired(iso: string): boolean {
  const t = Date.parse(iso)
  return Number.isFinite(t) && t < Date.now()
}

/** `/register?token=…` — the shareable join link's target route per the `POST /auth/register` contract (invite token required). */
function buildInviteLink(serverUrl: string | null, token: string): string {
  const base = serverUrl ?? window.location.origin
  return `${base}/register?token=${encodeURIComponent(token)}`
}

export function InvitesPage() {
  const { data: invites, isLoading, isError, refetch } = useInvitesQuery()
  const deleteInvite = useDeleteInviteMutation()
  const serverUrl = useServer((s) => s.current)

  const [showCreate, setShowCreate] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)

  async function handleCopy(invite: Invite) {
    const link = buildInviteLink(serverUrl, invite.token)
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Invite link copied')
    } catch {
      toast.danger('Could not copy link', 'Copy it manually instead.')
    }
  }

  function handleConfirmRevoke() {
    if (!revokeTarget) return
    deleteInvite.mutate(revokeTarget.token, { onSuccess: () => setRevokeTarget(null) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-text">Invites</h1>
          <p className="text-[12px] text-text-faint">One-time links for new users to join without an open registration page.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          Create invite
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading invites">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] text-danger">Couldn&apos;t load invites.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : invites && invites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-text">No active invites</p>
          <p className="text-[12px] text-text-faint">Create one to let a new user join with a link instead of a manually-created account.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface">
              <tr className="text-left text-text-faint">
                <th className="px-3 py-2 font-medium">Token</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites?.map((inv) => {
                const used = Boolean(inv.usedAt)
                const expired = !used && isExpired(inv.expiresAt)
                return (
                  <tr key={inv.token} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-[12px] text-text-muted">{inv.token.slice(0, 12)}…</td>
                    <td className="px-3 py-2 text-text">{inv.role}</td>
                    <td className="px-3 py-2 text-text-faint">{formatDate(inv.expiresAt)}</td>
                    <td className="px-3 py-2">
                      <span className={used ? 'text-text-faint' : expired ? 'text-danger' : 'text-success'}>
                        {used ? 'Used' : expired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" disabled={used} onClick={() => void handleCopy(inv)}>
                          Copy link
                        </Button>
                        <Button size="sm" variant="danger" disabled={used} onClick={() => setRevokeTarget(inv)}>
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateInviteModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke invite?"
        description="This link stops working immediately. Anyone who already has it won't be able to use it to join."
        confirmLabel="Revoke"
        loading={deleteInvite.isPending}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
