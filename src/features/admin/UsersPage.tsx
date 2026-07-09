import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import type { AdminUser, UserRole } from '../../lib/api/types'
import { useAuth } from '../../stores/auth'
import { CreateUserModal } from './CreateUserModal'
import { ResetPasswordModal } from './ResetPasswordModal'
import { useDeleteUserMutation, usePatchUserMutation, useUsersQuery } from './useAdmin'

const ROLES: UserRole[] = ['User', 'Admin']

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export function UsersPage() {
  const { data: users, isLoading, isError, refetch } = useUsersQuery()
  const patchUser = usePatchUserMutation()
  const deleteUser = useDeleteUserMutation()
  const currentUserId = useAuth((s) => s.user?.id)

  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-text">Users</h1>
          <p className="text-[12px] text-text-faint">Create, promote, disable, or remove accounts.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          Create user
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading users">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] text-danger">Couldn&apos;t load users.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : users && users.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-text">No users yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface">
              <tr className="text-left text-text-faint">
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Display name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 text-text">{u.username}</td>
                  <td className="px-3 py-2 text-text-muted">{u.displayName}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) => patchUser.mutate({ userId: u.id, body: { role: e.target.value as UserRole } })}
                      aria-label={`Role for ${u.username}`}
                      className="h-8 rounded-sm border border-border bg-surface px-2 text-[12px] text-text outline-none transition duration-150 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                        (u.isDisabled ? 'bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-danger' : 'text-success')
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${u.isDisabled ? 'bg-danger' : 'bg-success'}`}
                        aria-hidden="true"
                      />
                      {u.isDisabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-faint">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={u.id === currentUserId}
                        onClick={() => patchUser.mutate({ userId: u.id, body: { isDisabled: !u.isDisabled } })}
                      >
                        {u.isDisabled ? 'Enable' : 'Disable'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setResetTarget(u)}>
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={u.id === currentUserId}
                        onClick={() => setDeleteTarget(u)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ResetPasswordModal
        userId={resetTarget?.id ?? null}
        username={resetTarget?.username ?? ''}
        onClose={() => setResetTarget(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user?"
        description={
          deleteTarget
            ? `"${deleteTarget.username}" will be permanently deleted. This can't be undone. If they own any vaults, delete or reassign those first.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteUser.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
