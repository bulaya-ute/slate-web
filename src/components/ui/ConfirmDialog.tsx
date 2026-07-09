import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  /** Red "danger" styling for destructive actions (delete, revoke, disable). Defaults to true. */
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Generic "are you sure?" dialog built on `Modal` (so it inherits focus
 * trap / Escape / backdrop-click behavior for free) — the shared shape
 * behind every destructive-admin-action confirmation (delete user,
 * revoke invite, …) instead of each call site hand-rolling its own.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-text-muted">{description}</p>
    </Modal>
  )
}
