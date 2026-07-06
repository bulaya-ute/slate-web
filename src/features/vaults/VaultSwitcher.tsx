import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveVault } from '../../stores/activeVault'
import { CreateVaultModal } from './CreateVaultModal'
import { useVaultsQuery } from './useVaults'

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Vault list/switch UI, plus the entry point for creating a vault.
 * Handles all three vault-count states: loading (skeleton), empty (a
 * guided "create your first vault" CTA — no dropdown to open), and
 * populated (dropdown of vaults + "New vault").
 */
export function VaultSwitcher() {
  const { data: vaults, isLoading, isError, refetch } = useVaultsQuery()
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const setActiveVaultId = useActiveVault((s) => s.setActiveVaultId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep the active vault valid: auto-select the first vault when none is
  // chosen yet, or when the previously-active one no longer exists.
  useEffect(() => {
    if (!vaults || vaults.length === 0) return
    const stillExists = vaults.some((v) => v.id === activeVaultId)
    if (!stillExists) setActiveVaultId(vaults[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaults, activeVaultId])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2" role="status" aria-label="Loading vaults">
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-[12px] text-danger">Couldn&apos;t load vaults.</p>
        <Button size="sm" variant="ghost" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!vaults || vaults.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-3 py-3">
        <p className="text-[13px] font-medium text-text">No vaults yet</p>
        <p className="text-[12px] text-text-faint">Create a vault to start collecting notes.</p>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <PlusIcon />
          Create vault
        </Button>
        <CreateVaultModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(vault) => setActiveVaultId(vault.id)}
        />
      </div>
    )
  }

  const active = vaults.find((v) => v.id === activeVaultId) ?? vaults[0]

  return (
    <div className="relative px-2 py-2" ref={containerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <span className="truncate text-[13px] font-semibold text-text">{active.name}</span>
        <span className="shrink-0 text-text-faint">
          <ChevronIcon />
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Vaults"
          className="absolute left-2 right-2 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-surface py-1 shadow-md animate-[modalIn_150ms_ease-out]"
        >
          {vaults.map((vault) => (
            <button
              key={vault.id}
              type="button"
              role="menuitemradio"
              aria-checked={vault.id === active.id}
              onClick={() => {
                setActiveVaultId(vault.id)
                setMenuOpen(false)
              }}
              className={
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ' +
                (vault.id === active.id ? 'text-accent' : 'text-text')
              }
            >
              <span className="truncate">{vault.name}</span>
              <span className="shrink-0 text-[11px] text-text-faint">{vault.noteCount}</span>
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              setModalOpen(true)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <PlusIcon />
            New vault
          </button>
        </div>
      )}

      <CreateVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(vault) => setActiveVaultId(vault.id)}
      />
    </div>
  )
}
