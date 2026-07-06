/**
 * DTOs for the Slate REST API. JSON on the wire is camelCase; every
 * endpoint lives under `/api`. This file mirrors
 * `global-context.md`'s "Shared API contract" exactly — the server may
 * add fields later but will never rename existing ones, so widen these
 * types rather than replace them when that happens.
 */

// ---- System -------------------------------------------------------

export interface SystemInfo {
  name: string
  version: string
  apiVersion: number
  serverName: string | null
  setupRequired: boolean
}

export interface SetupRequest {
  username: string
  password: string
  displayName: string
}

// ---- Auth -----------------------------------------------------------

export type UserRole = 'Admin' | 'User'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  isDisabled: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export interface RegisterRequest {
  inviteToken: string
  username: string
  password: string
  displayName: string
}

// ---- Vaults ---------------------------------------------------------

export interface Vault {
  id: string
  name: string
  role: 'owner' | 'edit' | 'read'
  noteCount: number
  sizeBytes: number
  createdAt: string
}

export interface CreateVaultRequest {
  name: string
}

export interface NoteMeta {
  id: string
  path: string
  title: string
  hasConflict: boolean
  sizeBytes: number
  updatedAt: string
}

export interface VaultTree {
  folders: string[]
  notes: NoteMeta[]
}

export interface CreateNoteRequest {
  path: string
  content?: string
}

// ---- Notes ------------------------------------------------------------

export interface PutNoteContentRequest {
  content: string
  baseRevId: string
  deviceId: string
}

export interface PutNoteContentResponse {
  revId: string
  contentHash: string
}

export interface NoteConflictResponse {
  headRevId: string
  conflictRevId: string
}

export interface RenameNoteRequest {
  newPath: string
}

// ---- Folders ------------------------------------------------------------

export interface CreateFolderRequest {
  path: string
}

export interface RenameFolderRequest {
  path: string
  newPath: string
}

// ---- Sync / changes -----------------------------------------------------

export type RevisionKind =
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'resolve'
  | 'attach'

export interface Revision {
  seq: number
  noteId: string
  kind: RevisionKind
  path: string
  oldPath?: string
  contentHash: string
  deviceId: string
  isConflict: boolean
  createdAt: string
}

export interface ChangesResponse {
  results: Revision[]
  lastSeq: number
}

export interface ConflictEntry {
  revId: string
  deviceId: string
  createdAt: string
}

export interface NoteConflicts {
  noteId: string
  path: string
  conflicts: ConflictEntry[]
}

export interface ResolveNoteRequest {
  content: string
  resolvedRevIds: string[]
}

export interface ResolveNoteResponse {
  revId: string
}

// ---- Search / tags / graph ------------------------------------------------

export interface SearchResult {
  noteId: string
  path: string
  title: string
  snippetHtml: string
  score: number
}

export interface TagCount {
  name: string
  count: number
}

export interface Backlink {
  noteId: string
  path: string
  title: string
  contextSnippet: string
}

export interface GraphNode {
  id: string
  path: string
  title: string
  linkCount: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ---- Attachments --------------------------------------------------------

export interface AttachmentMeta {
  path: string
  sizeBytes: number
  mime: string
}

// ---- Admin ----------------------------------------------------------------

export interface AdminUser extends User {
  createdAt: string
}

export interface CreateUserRequest {
  username: string
  password: string
  displayName: string
  role: UserRole
}

export interface PatchUserRequest {
  role?: UserRole
  isDisabled?: boolean
  newPassword?: string
}

export interface Invite {
  token: string
  expiresAt: string
  role: UserRole
}

export interface CreateInviteRequest {
  role: UserRole
}

export interface SystemHealth {
  [key: string]: unknown
}

export interface AdminStats {
  [key: string]: unknown
}

// ---- Errors ---------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

/** Thrown by the API client for any non-2xx response. */
export class ApiError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
