import { type FormEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { toast } from '../../components/ui/Toast'
import { ApiError, type Vault } from '../../lib/api/types'
import { useCreateVaultMutation } from './useVaults'

export interface CreateVaultModalProps {
  open: boolean
  onClose: () => void
  /** Called with the newly created vault so the caller can switch to it. */
  onCreated: (vault: Vault) => void
}

export function CreateVaultModal({ open, onClose, onCreated }: CreateVaultModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createVault = useCreateVaultMutation()

  function handleClose() {
    setName('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the vault a name.')
      return
    }
    setError(null)
    try {
      const vault = await createVault.mutateAsync(trimmed)
      toast.success(`"${vault.name}" created`)
      onCreated(vault)
      handleClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create a vault">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Vault name"
          placeholder="My notes"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createVault.isPending}>
            Create vault
          </Button>
        </div>
      </form>
    </Modal>
  )
}
