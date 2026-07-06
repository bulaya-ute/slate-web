import { api } from '../../lib/api/client'
import type {
  CreateFolderRequest,
  CreateNoteRequest,
  NoteMeta,
  RenameFolderRequest,
  RenameNoteRequest,
  VaultTree,
} from '../../lib/api/types'

export function fetchTree(vaultId: string): Promise<VaultTree> {
  return api.get<VaultTree>(`/api/vaults/${vaultId}/tree`)
}

export function createNote(vaultId: string, body: CreateNoteRequest): Promise<NoteMeta> {
  return api.post<NoteMeta>(`/api/vaults/${vaultId}/notes`, body)
}

export function createFolder(vaultId: string, body: CreateFolderRequest): Promise<void> {
  return api.post<void>(`/api/vaults/${vaultId}/folders`, body)
}

export function renameNote(noteId: string, body: RenameNoteRequest): Promise<NoteMeta> {
  return api.post<NoteMeta>(`/api/notes/${noteId}/rename`, body)
}

export function renameFolder(vaultId: string, body: RenameFolderRequest): Promise<void> {
  return api.post<void>(`/api/vaults/${vaultId}/folders/rename`, body)
}

export function deleteNote(noteId: string): Promise<void> {
  return api.del<void>(`/api/notes/${noteId}`)
}

export function deleteFolder(vaultId: string, path: string): Promise<void> {
  return api.del<void>(`/api/vaults/${vaultId}/folders?path=${encodeURIComponent(path)}`)
}
