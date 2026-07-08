import { useMemo } from 'react'
import { normalizeServerUrl } from '../../lib/url'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { useTreeQuery } from '../explorer/useTree'
import { useVaultTags } from '../tags/useVaultTags'
import { useTabs } from '../tabs/tabs.store'
import type { EditorContextValue, NoteIndexEntry } from './editorContext'

function stripMdExtension(path: string): string {
  return path.replace(/\.md$/i, '')
}

function normalizeTarget(target: string): string {
  return target.trim().replace(/^\//, '').toLowerCase()
}

/**
 * Builds the `EditorContextValue` the CM6 facet needs, sourced from data
 * the app already fetches elsewhere — the vault tree backs the note
 * index + wikilink resolution, the tags endpoint backs `#` autocomplete.
 * The editor itself owns no server state of its own.
 */
export function useEditorContextValue(vaultId: string): EditorContextValue {
  const { data: tree } = useTreeQuery(vaultId)
  const { data: tagCounts } = useVaultTags(vaultId)
  const serverUrl = useServer((s) => s.current)
  const accessToken = useAuth((s) => s.accessToken)

  const noteIndex = useMemo<NoteIndexEntry[]>(
    () => tree?.notes.map((n) => ({ noteId: n.id, path: n.path, title: n.title })) ?? [],
    [tree],
  )
  const tagIndex = useMemo(() => tagCounts?.map((t) => t.name) ?? [], [tagCounts])

  return useMemo<EditorContextValue>(() => {
    const byPath = new Map<string, NoteIndexEntry>()
    const byTitle = new Map<string, NoteIndexEntry>()
    for (const entry of noteIndex) {
      byPath.set(normalizeTarget(entry.path), entry)
      byPath.set(normalizeTarget(stripMdExtension(entry.path)), entry)
      byTitle.set(normalizeTarget(entry.title), entry)
    }

    return {
      vaultId,
      resolveWikilink: (target) => {
        const key = normalizeTarget(target)
        return byPath.get(key) ?? byTitle.get(key) ?? null
      },
      getNoteIndex: () => noteIndex,
      getTagIndex: () => tagIndex,
      resolveAttachmentSrc: (path) => {
        if (!serverUrl) return ''
        const base = normalizeServerUrl(serverUrl)
        const encodedPath = path
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/')
        const tokenParam = accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : ''
        return `${base}/api/vaults/${vaultId}/files/${encodedPath}${tokenParam}`
      },
      onOpenNote: (noteId, opts) => {
        const note = tree?.notes.find((n) => n.id === noteId)
        if (!note) return
        useTabs
          .getState()
          .openTab(vaultId, { noteId: note.id, path: note.path, title: note.title }, { activate: !opts.newTab })
      },
    }
  }, [vaultId, noteIndex, tagIndex, serverUrl, accessToken, tree])
}
