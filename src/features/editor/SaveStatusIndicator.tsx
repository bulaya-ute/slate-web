import type { SaveStatus } from '../sync/autosave'

const LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline — changes queued',
  conflict: 'Conflict',
}

const DOT_CLASS: Record<SaveStatus, string> = {
  saved: 'bg-success',
  saving: 'bg-accent animate-pulse',
  offline: 'bg-text-faint',
  conflict: 'bg-danger',
}

export interface SaveStatusIndicatorProps {
  status: SaveStatus
}

/** Header pill for the editor's save loop — saved/saving/offline/conflict, per the sync spec. */
export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${
        status === 'conflict' ? 'text-danger' : 'text-text-muted'
      }`}
      role="status"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[status]}`} aria-hidden="true" />
      {LABEL[status]}
    </span>
  )
}
