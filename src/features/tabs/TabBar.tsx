import { type KeyboardEvent, useState } from 'react'
import { EMPTY_VAULT_TABS, useTabs } from './tabs.store'

export interface TabBarProps {
  vaultId: string
}

/** Open-note tab strip: click to activate, drag to reorder, middle-click or the × to close. */
export function TabBar({ vaultId }: TabBarProps) {
  const tabs = useTabs((s) => s.byVault[vaultId]?.tabs ?? EMPTY_VAULT_TABS.tabs)
  const activeNoteId = useTabs((s) => s.byVault[vaultId]?.activeNoteId ?? null)
  const setActive = useTabs((s) => s.setActive)
  const closeTab = useTabs((s) => s.closeTab)
  const reorder = useTabs((s) => s.reorder)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  if (tabs.length === 0) {
    return <div className="h-9 shrink-0 border-b border-border bg-bg-inset" aria-hidden="true" />
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, noteId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setActive(vaultId, noteId)
    } else if (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault()
      closeTab(vaultId, noteId)
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Open notes"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-bg-inset"
    >
      {tabs.map((tab, index) => {
        const active = tab.noteId === activeNoteId
        return (
          <div
            key={tab.noteId}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIndex !== null && dragIndex !== index) reorder(vaultId, dragIndex, index)
              setDragIndex(null)
            }}
            onDragEnd={() => setDragIndex(null)}
            onClick={() => setActive(vaultId, tab.noteId)}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault() // stop Windows' middle-click autoscroll cursor
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                closeTab(vaultId, tab.noteId)
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, tab.noteId)}
            title={tab.path}
            className={
              'group flex min-w-0 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-[13px] transition-colors duration-150 ease-out ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ' +
              (active ? 'bg-bg text-text' : 'text-text-muted hover:bg-surface-hover hover:text-text')
            }
          >
            {tab.dirty && (
              <span
                aria-label="Unsaved changes"
                role="img"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            )}
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(vaultId, tab.noteId)
              }}
              className={
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-text-faint transition-opacity duration-150 ease-out hover:bg-surface-active hover:text-text ' +
                'focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] ' +
                (active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
              }
            >
              &times;
            </button>
          </div>
        )
      })}
    </div>
  )
}
