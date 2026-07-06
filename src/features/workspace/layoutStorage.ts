/** Panel-id → percentage-of-group map, matching react-resizable-panels' `Layout` shape. */
export type WorkspaceLayout = Record<string, number>

const STORAGE_KEY = 'slate.workspace.layout'

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = { sidebar: 22, main: 78 }

function isWorkspaceLayout(value: unknown): value is WorkspaceLayout {
  if (!value || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
}

/** Reads the persisted panel layout, falling back to the default on any missing/malformed data. */
export function loadWorkspaceLayout(storage: Pick<Storage, 'getItem'> = localStorage): WorkspaceLayout {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WORKSPACE_LAYOUT
    const parsed: unknown = JSON.parse(raw)
    return isWorkspaceLayout(parsed) ? parsed : DEFAULT_WORKSPACE_LAYOUT
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT
  }
}

/** Persists the panel layout; silently no-ops if storage is unavailable (private-mode quota, etc). */
export function saveWorkspaceLayout(
  layout: WorkspaceLayout,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Layout just won't persist this session.
  }
}
