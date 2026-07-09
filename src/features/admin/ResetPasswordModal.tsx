import { type FormEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api/types'
import { usePatchUserMutation } from './useAdmin'

export interface ResetPasswordModalProps {
  userId: string | null
  username: string
  onClose: () => void
}

export function ResetPasswordModal({ userId, username, onClose }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const patchUser = usePatchUserMutation()

  function handleClose() {
    setPassword('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    try {
      await patchUser.mutateAsync({ userId, body: { newPassword: password } })
      handleClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <Modal open={userId !== null} onClose={handleClose} title={`Reset password for ${username}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          hint={error ? undefined : 'At least 8 characters.'}
          autoFocus
          autoComplete="new-password"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={patchUser.isPending}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
