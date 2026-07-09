import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useActiveVault } from '../../stores/activeVault'
import { useCreateNote, useTreeQuery } from '../explorer/useTree'
import { useTabs } from '../tabs/tabs.store'
import { buildCommands } from './commands'
import { rankEntries, rankNotes } from './fuzzyScore'
import { usePaletteStore } from './palette.store'

interface PaletteRow {
  id: string
  primary: string
  secondary?: string
  run: () => void
}

/**
 * Ctrl/Cmd+P (quick switcher) and Ctrl/Cmd+Shift+P (command list),
 * merged into one overlay since they share every bit of chrome —
 * search input, ranked/filtered list, keyboard nav, focus/escape
 * handling — and only differ in what builds the row list. Mounted once
 * near the app root (`AppShell`); owns its own global keydown listener
 * so no other component needs to know it exists to open it.
 */
export function CommandPalette() {
  const mode = usePaletteStore((s) => s.mode)
  const open = usePaletteStore((s) => s.open)
  const close = usePaletteStore((s) => s.close)
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const { data: tree } = useTreeQuery(activeVaultId)
  const createNote = useCreateNote(activeVaultId ?? '')

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const isOpen = mode !== 'closed'

  // Global open shortcuts. Neither Ctrl/Cmd+P nor Ctrl/Cmd+Shift+P is
  // bound by the CM6 editor's own keymap (checked against
  // `buildEditorExtensions`'s keymap — it binds Mod-s, undo/redo,
  // search, bracket-close, completion and markdown list commands, none
  // of which use "p"), so this plain `document` listener never races an
  // editor-focused keystroke. `preventDefault` on both stops the
  // browser's own "Print" dialog either way.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.key.toLowerCase() !== 'p') return
      e.preventDefault()
      open(e.shiftKey ? 'commands' : 'switcher')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(0)
    // Focus after the portal paints.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen, mode])

  const rows = useMemo<PaletteRow[]>(() => {
    if (mode === 'switcher') {
      const notes = tree?.notes.map((n) => ({ noteId: n.id, title: n.title, path: n.path })) ?? []
      const ranked = rankNotes(query, notes, 100)
      return ranked.map(({ item }) => ({
        id: item.noteId,
        primary: item.title,
        secondary: item.path,
        run: () => {
          if (!activeVaultId) return
          useTabs.getState().openTab(activeVaultId, { noteId: item.noteId, path: item.path, title: item.title })
          close()
        },
      }))
    }

    if (mode === 'commands') {
      const rootNoteNames = new Set((tree?.notes ?? []).filter((n) => !n.path.includes('/')).map((n) => n.title))
      const commands = buildCommands({
        vaultId: activeVaultId,
        rootNoteNames,
        createNote: (input, onCreated) => createNote.mutate(input, { onSuccess: onCreated }),
      })
      const ranked = rankEntries(query, commands, (c) => c.label)
      return ranked.map(({ item }) => ({
        id: item.id,
        primary: item.label,
        secondary: item.hint,
        run: () => {
          item.run()
          close()
        },
      }))
    }

    return []
  }, [mode, query, tree, activeVaultId, createNote, close])

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rows[activeIndex]?.run()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'switcher' ? 'Quick switcher' : 'Command palette'}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-[modalIn_180ms_ease-out]"
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'switcher' ? 'Jump to note by title or path…' : 'Run a command…'}
          aria-label={mode === 'switcher' ? 'Jump to note' : 'Run a command'}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-[14px] text-text placeholder:text-text-faint outline-none"
        />
        <div ref={listRef} role="listbox" aria-label={mode === 'switcher' ? 'Notes' : 'Commands'} className="max-h-80 overflow-auto py-1">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-text-faint">
              {mode === 'switcher' ? 'No matching notes.' : 'No matching commands.'}
            </p>
          ) : (
            rows.map((row, index) => (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => row.run()}
                className={
                  'flex w-full min-w-0 items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors duration-150 ease-out ' +
                  (index === activeIndex ? 'bg-surface-hover text-text' : 'text-text-muted')
                }
              >
                <span className="min-w-0 flex-1 truncate text-[13px]">{row.primary}</span>
                {row.secondary && <span className="shrink-0 truncate text-[11px] text-text-faint">{row.secondary}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
