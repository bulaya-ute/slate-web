import { type FormEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ApiError, type UserRole } from '../../lib/api/types'
import { useCreateInviteMutation } from './useAdmin'

export interface CreateInviteModalProps {
  open: boolean
  onClose: () => void
}

const ROLES: UserRole[] = ['User', 'Admin']

export function CreateInviteModal({ open, onClose }: CreateInviteModalProps) {
  const [role, setRole] = useState<UserRole>('User')
  const [error, setError] = useState<string | null>(null)
  const createInvite = useCreateInviteMutation()

  function handleClose() {
    setRole('User')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createInvite.mutateAsync(role)
      handleClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create invite">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="create-invite-role" className="text-[13px] font-medium text-text-muted">
            Role granted
          </label>
          <select
            id="create-invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-[14px] text-text outline-none transition duration-150 ease-out hover:border-border-strong focus-visible:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createInvite.isPending}>
            Create invite
          </Button>
        </div>
      </form>
    </Modal>
  )
}
