import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

export interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/**
 * Small floating action menu, portaled to `document.body` and positioned
 * at a fixed point (the right-click coordinates). Used for the
 * explorer's folder/note context menu (new note/folder, rename, delete).
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  // Clamp so the menu never renders off the right/bottom edge of the viewport.
  const MENU_WIDTH = 180
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(y, window.innerHeight - items.length * 32 - 16)

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-50 rounded-md border border-border bg-surface py-1 shadow-md animate-[modalIn_150ms_ease-out]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={
            'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ' +
            (item.danger ? 'text-danger' : 'text-text')
          }
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
