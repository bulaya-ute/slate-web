import { type FormEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { ApiError, type UserRole } from '../../lib/api/types'
import { useCreateUserMutation } from './useAdmin'

export interface CreateUserModalProps {
  open: boolean
  onClose: () => void
}

const ROLES: UserRole[] = ['User', 'Admin']

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('User')
  const [error, setError] = useState<string | null>(null)
  const createUser = useCreateUserMutation()

  function handleClose() {
    setUsername('')
    setDisplayName('')
    setPassword('')
    setRole('User')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !displayName.trim() || !password) {
      setError('Fill in every field.')
      return
    }
    setError(null)
    try {
      await createUser.mutateAsync({ username: username.trim(), displayName: displayName.trim(), password, role })
      handleClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create user">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" />
        <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="create-user-role" className="text-[13px] font-medium text-text-muted">
            Role
          </label>
          <select
            id="create-user-role"
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
          <Button type="submit" loading={createUser.isPending}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  )
}
