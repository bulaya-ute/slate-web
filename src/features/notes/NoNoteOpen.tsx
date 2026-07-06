/** Center-pane empty state — no tab open (fresh vault, or every tab closed). */
export function NoNoteOpen() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-faint" aria-hidden="true">
            <path
              d="M5 4.5h9L18 8.5v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M13.5 4.5v4a1 1 0 0 0 1 1H18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-text">No note open</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
          Pick a note from the file explorer, or create a new one.
        </p>
      </div>
    </div>
  )
}
