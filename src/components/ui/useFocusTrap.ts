import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Capture/trap/restore focus for a portaled `aria-modal="true"` overlay
 * (`Modal`, `CommandPalette`, …):
 *
 * - On open, remembers `document.activeElement` (the trigger).
 * - While open, Tab/Shift+Tab cycles within `containerRef`'s focusable
 *   descendants instead of leaking into the page behind the overlay.
 * - On close (or unmount while still open), refocuses the trigger.
 *
 * Focusable elements are queried live on every Tab press rather than
 * cached, since overlay content (e.g. a filtered result list) can change
 * while open.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, open: boolean) {
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const activeIsInside = active !== null && active !== container && container.contains(active)

      if (e.shiftKey) {
        if (!activeIsInside || active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (!activeIsInside || active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [open, containerRef])
}
